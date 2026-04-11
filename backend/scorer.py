import os
import json
import time
import anthropic
from dotenv import load_dotenv
import db

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SCORING_PROMPT = """\
You are an expert tech recruiter evaluating a student candidate's fit for a role.
Be ruthlessly honest — do not inflate scores. This candidate is a Year 1 university student
competing against more experienced candidates. A score of 7+ means genuinely strong fit.

CANDIDATE RESUME:
{master_resume_text}

JOB DESCRIPTION:
{jd_text}

Respond ONLY in valid JSON with no preamble or markdown fences:

{{
  "fit_score": <integer 1-10>,
  "matched_skills": [<skills from resume matching JD requirements>],
  "gaps": [<JD requirements absent or weak in resume>],
  "recommendation": "<Apply | Maybe | Skip>",
  "reasoning": "<2-3 sentence honest summary of fit>"
}}

Scoring guide:
- 8-10: Strong fit, most requirements met, apply immediately
- 5-7: Partial fit, worth reviewing, 1-2 key gaps
- 1-4: Weak fit, significant gaps, skip unless target company

Target: Tech / Product / AI roles in Singapore.\
"""


def score_job(jd_text: str, master_resume: str) -> dict | None:
    if len(jd_text.strip()) < 100:
        return None  # JD too short to score reliably

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": SCORING_PROMPT.format(
                master_resume_text=master_resume,
                jd_text=jd_text,
            )}],
        )
        raw = message.content[0].text.strip()
        cleaned = raw.removeprefix("```json").removesuffix("```").strip()
        data = json.loads(cleaned)
        assert all(k in data for k in ["fit_score", "matched_skills", "gaps", "recommendation", "reasoning"])
        return data
    except Exception as e:
        print(f"Scoring failed: {e}")
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

        time.sleep(1)  # Claude rate limit buffer

    return {"scored": success, "failed": failed}
