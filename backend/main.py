import os
import threading
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import db
from resume_converter import save_master_resume, load_master_resume
from scorer import score_all_unscored
from scraper import run_scrape
from resume_tailor import generate_resume


# ── Pipeline state ─────────────────────────────────────────────────────────────

class _State:
    def __init__(self):
        self.status = "idle"
        self.last_run: str | None = None
        self.last_result: dict | None = None
        self._lock = threading.Lock()

    def set(self, status: str):
        with self._lock:
            self.status = status

    def snapshot(self) -> dict:
        with self._lock:
            return {"status": self.status, "last_run": self.last_run, "last_result": self.last_result}


pipeline = _State()
resume_status: dict[str, str] = {}  # job_id → pending|generating|done|failed


# ── Background workers ─────────────────────────────────────────────────────────

def _run_pipeline(keywords: list[str]):
    try:
        pipeline.set("scraping")
        scrape_result = run_scrape(keywords)

        pipeline.set("scoring")
        master_resume = load_master_resume() or ""
        unscored = db.get_unscored_jobs()
        score_result = score_all_unscored(master_resume, unscored)

        pipeline.last_result = {"scrape": scrape_result, "score": score_result}
        pipeline.last_run = datetime.now(timezone.utc).isoformat()
        pipeline.set("done")
    except Exception as e:
        print(f"Pipeline error: {e}")
        pipeline.last_result = {"error": str(e)}
        pipeline.set("error")


def _run_resume(job_id: str, jd_text: str, job_title: str, company: str):
    try:
        resume_status[job_id] = "generating"
        generate_resume(job_id, jd_text, job_title, company)
        resume_status[job_id] = "done"
    except Exception as e:
        import traceback
        print(f"Resume generation failed for {job_id}: {type(e).__name__}: {e}")
        traceback.print_exc()
        resume_status[job_id] = "failed"


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Internship Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pipeline ───────────────────────────────────────────────────────────────────

class PipelineRunBody(BaseModel):
    keywords: list[str] | None = None


@app.post("/pipeline/run", status_code=202)
def trigger_pipeline(body: PipelineRunBody = PipelineRunBody()):
    state = pipeline.snapshot()
    if state["status"] in ("scraping", "scoring"):
        raise HTTPException(status_code=409, detail="Pipeline already running")
    t = threading.Thread(target=_run_pipeline, args=(body.keywords,), daemon=True)
    t.start()
    return {"started": True}


@app.get("/pipeline/status")
def get_pipeline_status():
    return pipeline.snapshot()


# ── Jobs ───────────────────────────────────────────────────────────────────────

@app.get("/jobs")
def list_jobs(
    min_score: int | None = None,
    platform: str | None = None,
    arrangement: str | None = None,
    job_type: str | None = None,
    search: str | None = None,
):
    return db.get_jobs(min_score=min_score, platform=platform, arrangement=arrangement, job_type=job_type, search=search)


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = db.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


class StatusUpdate(BaseModel):
    status: str
    notes: str | None = None


@app.patch("/jobs/{job_id}/status")
def update_status(job_id: str, body: StatusUpdate):
    valid = {"saved", "applied", "interviewing", "offer"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"status must be one of {valid}")
    return db.upsert_application(job_id, body.status, body.notes)


@app.delete("/jobs/clear")
def clear_jobs():
    db.clear_all_jobs()
    return {"cleared": True}


# ── Resume ─────────────────────────────────────────────────────────────────────

@app.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files accepted")
    content = await file.read()
    try:
        save_master_resume(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {e}")
    return {"success": True, "message": "Resume updated — next pipeline run will use new version"}


@app.get("/resume")
def get_resume():
    content = load_master_resume()
    if content is None:
        raise HTTPException(status_code=404, detail="No resume uploaded yet")
    return {"content": content}


@app.post("/resume/generate/{job_id}")
def trigger_resume_generation(job_id: str):
    job = db.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if resume_status.get(job_id) == "generating":
        raise HTTPException(status_code=409, detail="Already generating")

    resume_status[job_id] = "pending"
    t = threading.Thread(
        target=_run_resume,
        args=(job_id, job.get("jd_text", ""), job.get("title", ""), job.get("company", "")),
        daemon=True,
    )
    t.start()
    return {"started": True, "job_id": job_id}


@app.get("/resume/status/{job_id}")
def get_resume_status(job_id: str):
    status = resume_status.get(job_id, "not_started")
    output = db.get_resume_output(job_id) if status == "done" else None
    return {"status": status, "output": output}


@app.get("/resume/download/{job_id}")
def download_resume(job_id: str):
    output = db.get_resume_output(job_id)
    if not output:
        raise HTTPException(status_code=404, detail="No generated resume for this job")
    pdf_path = output.get("pdf_path")
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found on disk")
    return FileResponse(path=pdf_path, media_type="application/pdf", filename=f"resume_{job_id}.pdf")
