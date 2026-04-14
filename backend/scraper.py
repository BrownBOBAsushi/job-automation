import html
import re
import time
import uuid
import requests
import db

MCF_BASE = "https://api.mycareersfuture.gov.sg/v2/jobs"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.mycareersfuture.gov.sg",
    "Referer": "https://www.mycareersfuture.gov.sg/search",
}

DEFAULT_KEYWORDS = [
    "software engineer intern",
    "product manager intern",
    "AI engineer intern",
    "fintech intern",
    "full stack intern",
    "data analyst intern",
]


def _strip_html(raw: str) -> str:
    decoded = html.unescape(raw or "")
    clean = re.sub(r"<[^>]+>", " ", decoded)
    return re.sub(r"\s+", " ", clean).strip()


def _extract_key_skills(skills: list) -> str:
    key = [s["skill"] for s in skills if s.get("isKeySkill")]
    return ", ".join(key) if key else ""


def _infer_job_type(employment_types: list, title: str = "") -> str:
    for et in employment_types:
        et_str = et.get("employmentType", "").lower()
        if "intern" in et_str:
            return "internship"
        if "contract" in et_str:
            return "contract"
        if "part" in et_str:
            return "part-time"
    if "intern" in title.lower():
        return "internship"
    return "full-time"


def fetch_mcf_jobs(keyword: str, limit: int = 100) -> list[dict]:
    params = {"search": keyword, "limit": limit, "page": 0}
    try:
        resp = requests.get(MCF_BASE, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        jobs = []
        for r in results:
            title = r.get("title", "")
            salary = r.get("salary") or {}
            districts = r.get("address", {}).get("districts", [{}])
            region = districts[0].get("region", "Singapore") if districts else "Singapore"
            employment_types = r.get("employmentTypes", [])
            key_skills = _extract_key_skills(r.get("skills", []))
            jd_raw = _strip_html(r.get("description", ""))

            jd_text = jd_raw
            if key_skills:
                jd_text += f"\n\nKey Skills: {key_skills}"

            min_s = salary.get("minimum")
            max_s = salary.get("maximum")
            if min_s and max_s:
                stipend = f"SGD {min_s}–{max_s}/month"
            elif min_s:
                stipend = f"SGD {min_s}+/month"
            else:
                stipend = ""

            job_uuid = r.get("uuid", str(uuid.uuid4()))
            jobs.append({
                "id": job_uuid,
                "platform": "mycareersfuture",
                "title": title,
                "company": r.get("postedCompany", {}).get("name", ""),
                "location": region,
                "work_arrangement": employment_types[0].get("employmentType", "") if employment_types else "",
                "job_type": _infer_job_type(employment_types, title),
                "duration": "",
                "stipend": stipend,
                "jd_text": jd_text,
                "posted_date": r.get("metadata", {}).get("newPostingDate", ""),
                "url": r.get("metadata", {}).get(
                    "jobDetailsUrl",
                    f"https://www.mycareersfuture.gov.sg/job/{job_uuid}",
                ),
            })
        return jobs
    except Exception as e:
        print(f"MCF fetch failed for '{keyword}': {e}")
        return []


def fetch_indeed_jobs(keyword: str, limit: int = 50) -> list[dict]:
    try:
        from jobspy import scrape_jobs
        df = scrape_jobs(
            site_name=["indeed"],
            search_term=keyword,
            location="Singapore",
            results_wanted=limit,
            country_indeed="Singapore",
        )
        jobs = []
        for _, row in df.iterrows():
            url = str(row.get("job_url", ""))
            if not url:
                continue
            min_amt = row.get("min_amount")
            max_amt = row.get("max_amount")
            if min_amt and max_amt:
                stipend = f"SGD {int(min_amt)}–{int(max_amt)}"
            elif min_amt:
                stipend = f"SGD {int(min_amt)}+"
            else:
                stipend = ""
            title = str(row.get("title", ""))
            jobs.append({
                "id": str(uuid.uuid4()),
                "platform": "indeed",
                "title": title,
                "company": str(row.get("company", "")),
                "location": str(row.get("location", "")),
                "work_arrangement": str(row.get("job_type", "")),
                "job_type": _infer_job_type([], title),
                "duration": "",
                "stipend": stipend,
                "jd_text": str(row.get("description", "")),
                "posted_date": "",
                "url": url,
            })
        return jobs
    except Exception as e:
        print(f"JobSpy failed for '{keyword}': {e}")
        return []


def run_scrape(keywords_list: list[str] | None = None) -> dict:
    """MCF primary + Indeed fallback when MCF returns < 10 results."""
    if keywords_list is None:
        keywords_list = DEFAULT_KEYWORDS

    all_jobs: list[dict] = []
    sources: dict[str, int] = {"mycareersfuture": 0, "indeed": 0}

    for keyword in keywords_list:
        print(f"Scraping MCF for '{keyword}'...")
        mcf_results = fetch_mcf_jobs(keyword)
        if len(mcf_results) >= 10:
            all_jobs.extend(mcf_results)
            sources["mycareersfuture"] += len(mcf_results)
        else:
            print(f"MCF returned {len(mcf_results)} for '{keyword}' — using Indeed fallback")
            time.sleep(2)
            indeed_results = fetch_indeed_jobs(keyword)
            all_jobs.extend(indeed_results)
            sources["indeed"] += len(indeed_results)
        time.sleep(1)

    inserted = db.insert_jobs_deduplicated(all_jobs)
    return {"inserted": inserted, "sources": sources}
