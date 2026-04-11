import os
import time
import httpx
from dotenv import load_dotenv
import db

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MAX_RESULTS = 100
DEFAULT_KEYWORDS = [
    "software engineer intern",
    "AI engineer intern",
    "product manager intern",
    "data analyst intern",
    "backend developer intern",
]


# ── MyCareersFuture (primary) ──────────────────────────────────────────────────

def fetch_mcf_jobs(keyword: str, max_results: int = MAX_RESULTS) -> list[dict]:
    jobs = []
    page = 0
    per_page = min(max_results, 100)

    while len(jobs) < max_results:
        try:
            resp = httpx.get(
                "https://api.mycareersfuture.gov.sg/v2/jobs",
                params={"search": keyword, "limit": per_page, "page": page},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Origin": "https://www.mycareersfuture.gov.sg",
                    "Referer": "https://www.mycareersfuture.gov.sg/search",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-site",
                    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if not results:
                break

            for item in results:
                meta = item.get("metadata", {})
                salary = item.get("salary", {})
                uuid = item.get("uuid", "")
                if not uuid:
                    continue

                # Salary/stipend: prefer min monthly amount
                stipend = ""
                if salary:
                    min_s = salary.get("minimum")
                    max_s = salary.get("maximum")
                    if min_s and max_s:
                        stipend = f"SGD {min_s}–{max_s}"
                    elif min_s:
                        stipend = f"SGD {min_s}+"

                jobs.append({
                    "platform": "mycareersfuture",
                    "title": meta.get("jobTitle", ""),
                    "company": item.get("postedCompany", {}).get("name", ""),
                    "location": (meta.get("address") or {}).get("city", "Singapore"),
                    "work_arrangement": meta.get("positionType", ""),
                    "job_type": meta.get("employmentType", [{}])[0].get("salaryType", "") if meta.get("employmentType") else "",
                    "duration": "",
                    "stipend": stipend,
                    "jd_text": item.get("description", ""),
                    "url": f"https://www.mycareersfuture.gov.sg/job/{uuid}",
                    "scored": False,
                    "scoring_failed": False,
                })

            page += 1
            if len(results) < per_page:
                break  # no more pages

        except Exception as e:
            print(f"MCF fetch failed for '{keyword}' page {page}: {e}")
            break

        time.sleep(0.5)

    return jobs[:max_results]


# ── JobSpy / Indeed (fallback) ─────────────────────────────────────────────────

def fetch_indeed_jobs(keyword: str, max_results: int = 50) -> list[dict]:
    try:
        from jobspy import scrape_jobs
        df = scrape_jobs(
            site_name=["indeed"],
            search_term=keyword,
            location="Singapore",
            results_wanted=max_results,
            country_indeed="Singapore",
        )
        jobs = []
        for _, row in df.iterrows():
            url = str(row.get("job_url", ""))
            if not url:
                continue
            min_amt = row.get("min_amount")
            max_amt = row.get("max_amount")
            stipend = ""
            if min_amt and max_amt:
                stipend = f"SGD {int(min_amt)}–{int(max_amt)}"
            elif min_amt:
                stipend = f"SGD {int(min_amt)}+"

            jobs.append({
                "platform": "indeed",
                "title": str(row.get("title", "")),
                "company": str(row.get("company", "")),
                "location": str(row.get("location", "")),
                "work_arrangement": str(row.get("job_type", "")),
                "job_type": "",
                "duration": "",
                "stipend": stipend,
                "jd_text": str(row.get("description", "")),
                "url": url,
                "scored": False,
                "scoring_failed": False,
            })
        return jobs
    except Exception as e:
        print(f"JobSpy failed for '{keyword}': {e}")
        return []


# ── Main scraper ───────────────────────────────────────────────────────────────

def run_scrape(keywords_list: list[str] | None = None) -> dict:
    """
    Scrape Indeed via JobSpy. MCF is deferred (API blocks server-side requests).
    Returns {"inserted": int, "sources": {...}}.
    """
    if keywords_list is None:
        keywords_list = DEFAULT_KEYWORDS

    all_jobs: list[dict] = []
    sources: dict[str, int] = {"indeed": 0}

    for keyword in keywords_list:
        print(f"Scraping Indeed for '{keyword}'...")
        jobs = fetch_indeed_jobs(keyword)
        all_jobs.extend(jobs)
        sources["indeed"] += len(jobs)
        time.sleep(2)  # JobSpy rate limit buffer

    inserted = db.insert_jobs_deduplicated(all_jobs)
    return {"inserted": inserted, "sources": sources}
