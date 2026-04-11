import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    return _client


# ── jobs ──────────────────────────────────────────────────────────────────────

def insert_jobs_deduplicated(jobs: list[dict]) -> int:
    """Insert jobs, skipping any whose URL already exists. Returns count inserted."""
    db = get_client()
    inserted = 0
    for job in jobs:
        if not job.get("url"):
            continue
        try:
            db.table("jobs").insert(job).execute()
            inserted += 1
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                continue  # already exists — skip silently
            print(f"Insert failed: {e} — {job.get('url')}")
    return inserted


def get_unscored_jobs() -> list[dict]:
    db = get_client()
    return (
        db.table("jobs")
        .select("*")
        .eq("scored", False)
        .eq("scoring_failed", False)
        .execute()
        .data
    )


def mark_job_scored(job_id: str) -> None:
    get_client().table("jobs").update({"scored": True}).eq("id", job_id).execute()


def mark_job_scoring_failed(job_id: str) -> None:
    get_client().table("jobs").update({"scoring_failed": True}).eq("id", job_id).execute()


def get_jobs(
    min_score: int | None = None,
    platform: str | None = None,
    arrangement: str | None = None,
    job_type: str | None = None,
    search: str | None = None,
) -> list[dict]:
    db = get_client()
    query = db.table("jobs").select("*, job_scores(*), applications(*)")

    if platform:
        query = query.eq("platform", platform)
    if arrangement:
        query = query.eq("work_arrangement", arrangement)
    if job_type:
        query = query.eq("job_type", job_type)

    jobs = query.execute().data

    # Client-side filters (search + min_score)
    if search:
        s = search.lower()
        jobs = [
            j for j in jobs
            if s in (j.get("title") or "").lower()
            or s in (j.get("company") or "").lower()
            or s in (j.get("jd_text") or "").lower()
        ]

    if min_score is not None:
        jobs = [
            j for j in jobs
            if j.get("job_scores") and j["job_scores"][0].get("fit_score", 0) >= min_score
        ]

    return jobs


def get_job_by_id(job_id: str) -> dict | None:
    res = get_client().table("jobs").select("*, job_scores(*), applications(*)").eq("id", job_id).execute()
    return res.data[0] if res.data else None


def clear_all_jobs() -> None:
    db = get_client()
    db.table("resume_outputs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("job_scores").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("applications").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    db.table("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()


# ── job_scores ─────────────────────────────────────────────────────────────────

def insert_score(score: dict) -> None:
    get_client().table("job_scores").insert(score).execute()


# ── applications ───────────────────────────────────────────────────────────────

def upsert_application(job_id: str, status: str, notes: str | None = None) -> dict:
    payload: dict = {"job_id": job_id, "status": status}
    if notes is not None:
        payload["notes"] = notes
    res = get_client().table("applications").upsert(payload, on_conflict="job_id").execute()
    return res.data[0]


# ── resume_outputs ─────────────────────────────────────────────────────────────

def upsert_resume_output(record: dict) -> dict:
    res = get_client().table("resume_outputs").upsert(record, on_conflict="job_id").execute()
    return res.data[0]


def get_resume_output(job_id: str) -> dict | None:
    res = get_client().table("resume_outputs").select("*").eq("job_id", job_id).execute()
    return res.data[0] if res.data else None
