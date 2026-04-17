import os
import sqlite3
import threading
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "jobs.db")
_lock = threading.Lock()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock:
        conn = get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                platform TEXT,
                title TEXT,
                company TEXT,
                location TEXT,
                work_arrangement TEXT,
                job_type TEXT,
                duration TEXT,
                stipend TEXT,
                jd_text TEXT,
                url TEXT UNIQUE,
                posted_date TEXT,
                scraped_at TEXT DEFAULT (datetime('now')),
                scored INTEGER DEFAULT 0,
                scoring_failed INTEGER DEFAULT 0,
                status TEXT DEFAULT 'new'
            );

            CREATE TABLE IF NOT EXISTS job_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT REFERENCES jobs(id),
                fit_score INTEGER,
                matched_skills TEXT,
                gaps TEXT,
                recommendation TEXT,
                reasoning TEXT,
                scored_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS resume_outputs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT REFERENCES jobs(id) UNIQUE,
                match_score INTEGER,
                missing_keywords TEXT,
                ats_flags TEXT,
                eval_warnings TEXT DEFAULT '[]',
                html_path TEXT,
                pdf_path TEXT,
                generation_failed INTEGER DEFAULT 0,
                generated_at TEXT DEFAULT (datetime('now'))
            );
        """)
        conn.commit()
        # Migrate existing DB: add eval_warnings column if missing
        try:
            conn.execute("ALTER TABLE resume_outputs ADD COLUMN eval_warnings TEXT DEFAULT '[]'")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # column already exists
        conn.close()


def insert_jobs_deduplicated(jobs: list[dict]) -> int:
    inserted = 0
    with _lock:
        conn = get_conn()
        try:
            for job in jobs:
                if not job.get("url"):
                    continue
                try:
                    conn.execute(
                        """INSERT INTO jobs
                           (id, platform, title, company, location, work_arrangement,
                            job_type, duration, stipend, jd_text, url, posted_date)
                           VALUES
                           (:id, :platform, :title, :company, :location, :work_arrangement,
                            :job_type, :duration, :stipend, :jd_text, :url, :posted_date)""",
                        job,
                    )
                    inserted += 1
                except sqlite3.IntegrityError:
                    continue  # duplicate URL — skip silently
            conn.commit()
        finally:
            conn.close()
    return inserted


def get_unscored_jobs() -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM jobs WHERE scored=0 AND scoring_failed=0"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def mark_job_scored(job_id: str) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute("UPDATE jobs SET scored=1 WHERE id=?", (job_id,))
            conn.commit()
        finally:
            conn.close()


def mark_job_scoring_failed(job_id: str) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute("UPDATE jobs SET scoring_failed=1 WHERE id=?", (job_id,))
            conn.commit()
        finally:
            conn.close()


def _attach_score(conn: sqlite3.Connection, job: dict) -> dict:
    row = conn.execute(
        "SELECT * FROM job_scores WHERE job_id=? ORDER BY scored_at DESC LIMIT 1",
        (job["id"],),
    ).fetchone()
    if row:
        score = dict(row)
        score["matched_skills"] = json.loads(score.get("matched_skills") or "[]")
        score["gaps"] = json.loads(score.get("gaps") or "[]")
        job["score"] = score
    else:
        job["score"] = None
    return job


def get_jobs(
    min_score: int | None = None,
    platform: str | None = None,
    arrangement: str | None = None,
    job_type: str | None = None,
    search: str | None = None,
    recommendation: str | None = None,
) -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM jobs ORDER BY scraped_at DESC").fetchall()
        jobs = [_attach_score(conn, dict(r)) for r in rows]

        if platform:
            jobs = [j for j in jobs if j.get("platform") == platform]
        if arrangement:
            jobs = [j for j in jobs if j.get("work_arrangement") == arrangement]
        if job_type:
            jobs = [j for j in jobs if j.get("job_type") == job_type]
        if search:
            s = search.lower()
            jobs = [j for j in jobs if
                    s in (j.get("title") or "").lower()
                    or s in (j.get("company") or "").lower()
                    or s in (j.get("jd_text") or "").lower()]
        if min_score is not None:
            jobs = [j for j in jobs if j.get("score") and j["score"].get("fit_score", 0) >= min_score]
        if recommendation:
            jobs = [j for j in jobs if j.get("score") and j["score"].get("recommendation") == recommendation]

        return jobs
    finally:
        conn.close()


def get_job_by_id(job_id: str) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            return None
        return _attach_score(conn, dict(row))
    finally:
        conn.close()


def update_job_status(job_id: str, status: str) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute("UPDATE jobs SET status=? WHERE id=?", (status, job_id))
            conn.commit()
        finally:
            conn.close()


def clear_all_jobs() -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.executescript("""
                DELETE FROM resume_outputs;
                DELETE FROM job_scores;
                DELETE FROM jobs;
            """)
            conn.commit()
        finally:
            conn.close()


def insert_score(score: dict) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute(
                """INSERT INTO job_scores
                   (job_id, fit_score, matched_skills, gaps, recommendation, reasoning)
                   VALUES (:job_id, :fit_score, :matched_skills, :gaps, :recommendation, :reasoning)""",
                {
                    **score,
                    "matched_skills": json.dumps(score.get("matched_skills", [])),
                    "gaps": json.dumps(score.get("gaps", [])),
                },
            )
            conn.commit()
        finally:
            conn.close()


def upsert_resume_output(record: dict) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute(
                """INSERT INTO resume_outputs
                   (job_id, match_score, missing_keywords, ats_flags, eval_warnings, html_path, pdf_path, generation_failed)
                   VALUES (:job_id, :match_score, :missing_keywords, :ats_flags, :eval_warnings, :html_path, :pdf_path, :generation_failed)
                   ON CONFLICT(job_id) DO UPDATE SET
                     match_score=excluded.match_score,
                     missing_keywords=excluded.missing_keywords,
                     ats_flags=excluded.ats_flags,
                     eval_warnings=excluded.eval_warnings,
                     html_path=excluded.html_path,
                     pdf_path=excluded.pdf_path,
                     generation_failed=excluded.generation_failed,
                     generated_at=datetime('now')""",
                {
                    **record,
                    "missing_keywords": json.dumps(record.get("missing_keywords", [])),
                    "ats_flags": json.dumps(record.get("ats_flags", [])),
                    "eval_warnings": json.dumps(record.get("eval_warnings", [])),
                },
            )
            conn.commit()
        finally:
            conn.close()


def get_resume_output(job_id: str) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM resume_outputs WHERE job_id=?", (job_id,)
        ).fetchone()
        if not row:
            return None
        result = dict(row)
        result["missing_keywords"] = json.loads(result.get("missing_keywords") or "[]")
        result["ats_flags"] = json.loads(result.get("ats_flags") or "[]")
        result["eval_warnings"] = json.loads(result.get("eval_warnings") or "[]")
        return result
    finally:
        conn.close()
