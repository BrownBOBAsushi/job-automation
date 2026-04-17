import json
import re
import requests
import db

OLLAMA_BASE = "http://localhost:11434"
SCORING_MODEL = "gemma4:e4b"

SCORING_PROMPT = """You are a ruthlessly honest tech recruiter evaluating a student candidate.
This is a Year 1 university student competing against candidates with more experience.
Do NOT inflate scores. A score of 7+ means genuinely strong fit.

CANDIDATE RESUME:
{master_resume}

JOB DESCRIPTION:
{jd_text}

Respond in JSON only:
{{
  "fit_score": <1-10>,
  "matched_skills": ["skill1", "skill2"],
  "gaps": ["gap1", "gap2"],
  "recommendation": "Apply|Maybe|Skip",
  "reasoning": "2-3 honest sentences"
}}

Scoring:
- 8-10: Strong fit, apply immediately
- 5-7: Partial fit, 1-2 gaps, worth reviewing
- 1-4: Weak fit, skip unless dream company

Target: Tech / Product / AI roles in Singapore."""


def _extract_jd_signal(jd_text: str, max_chars: int = 3000) -> str:
    section_patterns = [
        r'(?i)(what\s+we.re\s+looking\s+for)',
        r'(?i)(requirements?)',
        r'(?i)(qualifications?)',
        r'(?i)(what\s+you\s+(will\s+)?(need|bring|have))',
        r'(?i)(must\s+have)',
        r'(?i)(responsibilit)',
        r'(?i)(what\s+you.ll\s+do)',
        r'(?i)(your\s+role)',
        r'(?i)(the\s+role)',
        r'(?i)(job\s+description)',
    ]
    for pattern in section_patterns:
        match = re.search(pattern, jd_text)
        if match and match.start() > 100:
            extracted = jd_text[match.start():]
            return extracted[:max_chars]

    return jd_text[:max_chars]


def ollama_chat(model: str, prompt: str, expect_json: bool = True) -> str:
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_ctx": 8192,   # enough for prompt + full JSON output
            "num_predict": 1024,
        },
    }
    if expect_json:
        payload["format"] = "json"
    resp = requests.post(f"{OLLAMA_BASE}/api/generate", json=payload, timeout=300)
    resp.raise_for_status()
    return resp.json()["response"]


def score_job(jd_text: str, master_resume: str) -> dict | None:
    if len(jd_text.strip()) < 100:
        return None  # JD too short to score reliably

    prompt = SCORING_PROMPT.format(
        master_resume=master_resume[:3000],
        jd_text=_extract_jd_signal(jd_text, max_chars=2500),
    )

    raw = ""
    try:
        raw = ollama_chat(SCORING_MODEL, prompt, expect_json=True)
        data = json.loads(raw)
        assert all(k in data for k in ["fit_score", "matched_skills", "gaps", "recommendation", "reasoning"])
        return data
    except Exception as e:
        print(f"Scoring failed: {e}\nRaw: {raw[:200]}")
        return None


def score_all_unscored(master_resume: str, jobs: list[dict]) -> dict:
    success = 0
    failed = 0

    for job in jobs:
        job_id = job["id"]
        jd_text = job.get("jd_text", "")

        result = score_job(jd_text, master_resume)

        if result is None:
            db.mark_job_scoring_failed(job_id)
            failed += 1
        else:
            db.insert_score({
                "job_id": job_id,
                "fit_score": result["fit_score"],
                "matched_skills": result["matched_skills"],
                "gaps": result["gaps"],
                "recommendation": result["recommendation"],
                "reasoning": result.get("reasoning", ""),
            })
            db.mark_job_scored(job_id)
            success += 1

    return {"scored": success, "failed": failed}
