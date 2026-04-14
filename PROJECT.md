# PROJECT.md — Personal Internship Intelligence System
# Version: 3.0 (Final pre-build)

## Overview

A fully local, zero-cost personal internship intelligence system for Chye Zhi Hao —
Year 1 Applied Computing in Fintech student at SIT targeting Tech / Product / AI
internships and junior roles in Singapore.

Scrapes jobs from MyCareersFuture (primary) + Indeed via JobSpy (fallback).
Scores each role locally using Ollama (Gemma 4 E4B IT).
Surfaces a ranked two-panel dashboard (SupCareer-inspired, minimalist).
On-demand resume tailoring per role using Ollama (qwen2.5:14b) → HTML → PDF download.

No cloud APIs. No Supabase. No Docker. No LaTeX. Runs entirely on local machine.

---

## Goals

- Aggregate internship/job listings from MCF + Indeed, deduplicated
- Score and rank every role against master resume — ruthlessly honest scoring
- Two-panel UI: job list left, JD detail right (SupCareer layout)
- On-demand per-role resume tailoring → downloadable PDF
- Resume output matches Jake's Resume style (reference: ChyeZhiHao_Aumovio resume)
- Drag-and-drop .docx upload → auto-convert to master_resume.md
- Simple status tracking per job (no kanban — status tag on job card)
- Fully local: SQLite database, Ollama LLM, Playwright PDF generation

---

## Non-Goals (v1)

- Kanban board (deferred to v2 — status tag is sufficient)
- LinkedIn scraping (fragile — deferred to v2)
- Cloud APIs of any kind
- Multi-user support
- Scheduled/cron runs (manual trigger only)
- LaTeX / pdflatex (replaced by HTML → PDF via Playwright)

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Job Sourcing (Primary) | MyCareersFuture public REST API | No auth, structured JSON, SG-specific |
| Job Sourcing (Fallback) | JobSpy (`python-jobspy`) | Scrapes Indeed, no API key |
| Backend | Python (FastAPI) | Local REST API |
| LLM — Scoring | Ollama `gemma4:4b-it-qat` | Fast, fits easily in 8GB VRAM |
| LLM — Resume Tailoring | Ollama `qwen2.5:14b-instruct-q4_K_M` | Better structured output, fits 8GB VRAM |
| PDF Generation | Playwright (headless Chromium) | HTML → PDF, zero compilation failures |
| Database | SQLite (local file) | Zero latency, no account, no network |
| Frontend | React + Vite + TailwindCSS | Two-panel layout, dark mode, minimalist |
| Resume Storage | .docx drag-and-drop → markdown | Stored as `master_resume.md` |

### GPU context (user machine)
- GPU: NVIDIA GeForce RTX 3060 Ti (8GB VRAM)
- RAM: 32GB
- OS: Windows 11 Pro
- gemma4:4b-it-qat: ~3.1GB VRAM — runs great, ~101 tok/s
- qwen2.5:14b at q4_K_M: ~8GB VRAM — fits, slower but acceptable for on-demand use

---

## System Architecture

### Pipeline A — Job Ingestion + Scoring (manual trigger)

```
[User clicks "Run Pipeline"]
        ↓
[scraper.py: fetch MCF jobs for each keyword]
        ↓ (if MCF returns < 10 results for a keyword)
[Fallback: JobSpy scrapes Indeed for that keyword]
        ↓
[Deduplicate by URL → insert new jobs to SQLite]
        ↓
[scorer.py: for each unscored job → Ollama gemma4:4b-it-qat]
        ↓
[Returns: fit_score, matched_skills, gaps, recommendation, reasoning]
        ↓
[Write scores to SQLite → dashboard refreshes ranked list]
```

### Pipeline B — Resume Tailoring (per-job, on-demand)

```
[User clicks "Generate Resume" on a job]
        ↓
[POST /resume/generate/{job_id}]
        ↓
[resume_tailor.py: load master_resume.md + jd_text]
        ↓
[Ollama qwen2.5:14b — Call 1: gap analysis + experience selection + XYZ rewrite]
        ↓
[Ollama qwen2.5:14b — Call 2: generate HTML resume in Jake's Resume style]
        ↓
[Playwright: render HTML → export PDF]
        ↓
[Save PDF → serve via GET /resume/download/{job_id}]
        ↓
[Job panel shows: match score, ATS flags, "Download PDF" button]
```

---

## Ollama Setup (Windows)

```bash
# 1. Install Ollama from https://ollama.com/download
# 2. Pull both models (do this before running Claude Code)
ollama pull gemma4:e4b        # Scoring model — E4B variant, correct tag
ollama pull qwen2.5:14b       # Tailoring model

# 3. Verify both are available
ollama list

# 4. Ollama runs as a local server at http://localhost:11434
# No API key needed — just keep Ollama running in the background
```

### Calling Ollama from Python

```python
import requests, json

OLLAMA_BASE = "http://localhost:11434"

def ollama_chat(model: str, prompt: str, expect_json: bool = True) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,      # Low temp for consistent structured output
            "num_predict": 2048,
        }
    }
    if expect_json:
        payload["format"] = "json"   # Ollama JSON mode — forces valid JSON output

    resp = requests.post(f"{OLLAMA_BASE}/api/generate", json=payload, timeout=120)
    resp.raise_for_status()
    return resp.json()["response"]

# Model routing — use correct model per task
SCORING_MODEL = "gemma4:e4b"
TAILORING_MODEL = "qwen2.5:14b"
```

> **Always use `format: "json"`** for scoring calls. This is Ollama's JSON mode —
> equivalent to OpenAI's response_format. Dramatically reduces malformed output.
> For HTML generation (Call 2 of tailoring), do NOT use JSON mode — set expect_json=False.

---

## Database — SQLite

Single local file. Zero latency. No server process.

```python
# db.py — use sqlite3 (stdlib, no pip install needed)
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "jobs.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Return dict-like rows
    return conn

def init_db():
    """Run once on startup to create tables if not exist."""
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
            matched_skills TEXT,   -- JSON array stored as string
            gaps TEXT,             -- JSON array stored as string
            recommendation TEXT,
            reasoning TEXT,
            scored_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS resume_outputs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT REFERENCES jobs(id),
            match_score INTEGER,
            missing_keywords TEXT, -- JSON array stored as string
            ats_flags TEXT,        -- JSON array stored as string
            html_path TEXT,
            pdf_path TEXT,
            generation_failed INTEGER DEFAULT 0,
            generated_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()
```

> **Windows path note:** always use `os.path.join()` for DB_PATH and all file paths.
> Never hardcode forward slashes anywhere in the codebase.

---

## Job Scraping

### Verify MCF API fields FIRST (before Claude Code writes scraper.py)

Run this in terminal before building and confirm the actual field names:

```bash
curl "https://api.mycareersfuture.gov.sg/v2/jobs?search=software+engineer+intern&limit=3" | python -m json.tool
```

Update the field mapping in scraper.py to match actual response. Do not assume.

### MCF Scraper

Field mapping verified against live API response on 2026-04-12.

```python
import requests, time, uuid, html, re

MCF_BASE = "https://api.mycareersfuture.gov.sg/v2/jobs"
HEADERS = {"User-Agent": "Mozilla/5.0"}

def _strip_html(raw: str) -> str:
    """Strip HTML tags and decode HTML entities from MCF description field."""
    decoded = html.unescape(raw or "")
    clean = re.sub(r"<[^>]+>", " ", decoded)
    return re.sub(r"\s+", " ", clean).strip()

def _extract_key_skills(skills: list) -> str:
    """Extract isKeySkill=True skills as comma-separated string for scoring context."""
    key = [s["skill"] for s in skills if s.get("isKeySkill")]
    return ", ".join(key) if key else ""

def _infer_job_type(employment_types: list, title: str) -> str:
    for et in employment_types:
        et_str = et.get("employmentType", "").lower()
        if "intern" in et_str: return "internship"
        if "contract" in et_str: return "contract"
        if "part" in et_str: return "part-time"
    title_lower = title.lower()
    if "intern" in title_lower: return "internship"
    return "full-time"

def fetch_mcf_jobs(keyword: str, limit: int = 100) -> list:
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

            # Append key skills to JD text for richer scoring context
            jd_text = jd_raw
            if key_skills:
                jd_text += f"\n\nKey Skills: {key_skills}"

            jobs.append({
                "id": r.get("uuid", str(uuid.uuid4())),
                "platform": "mycareersfuture",
                "title": title,
                "company": r.get("postedCompany", {}).get("name", ""),
                "location": region,
                "work_arrangement": employment_types[0].get("employmentType", "") if employment_types else "",
                "job_type": _infer_job_type(employment_types, title),
                "duration": "",           # Not in MCF API — parse from JD if needed
                "stipend": f"SGD {salary.get('minimum', '')}–{salary.get('maximum', '')}/month" if salary.get("minimum") else "",
                "jd_text": jd_text,
                "posted_date": r.get("metadata", {}).get("newPostingDate", ""),
                "url": r.get("metadata", {}).get("jobDetailsUrl", f"https://www.mycareersfuture.gov.sg/job/{r.get('uuid', '')}")
            })
        return jobs
    except Exception as e:
        print(f"MCF fetch failed for '{keyword}': {e}")
        return []
```

### JobSpy Fallback (Indeed)

```python
from jobspy import scrape_jobs

def fetch_indeed_jobs(keyword: str, limit: int = 50) -> list:
    try:
        df = scrape_jobs(
            site_name=["indeed"],
            search_term=keyword,
            location="Singapore",
            results_wanted=limit,
            country_indeed="Singapore"
        )
        jobs = []
        for _, row in df.iterrows():
            jobs.append({
                "id": str(uuid.uuid4()),
                "platform": "indeed",
                "title": row.get("title", ""),
                "company": row.get("company", ""),
                "location": row.get("location", ""),
                "work_arrangement": row.get("job_type", ""),
                "job_type": _infer_job_type(row.get("title", "")),
                "duration": "",
                "stipend": str(row.get("min_amount", "")),
                "jd_text": row.get("description", ""),
                "url": row.get("job_url", "")
            })
        return jobs
    except Exception as e:
        print(f"JobSpy fetch failed for '{keyword}': {e}")
        return []
```

### Pipeline Orchestration

```python
def run_scrape_pipeline(keywords: list[str]) -> int:
    """Returns count of newly inserted jobs."""
    all_jobs = []
    for keyword in keywords:
        mcf_results = fetch_mcf_jobs(keyword)
        if len(mcf_results) >= 10:
            all_jobs.extend(mcf_results)
        else:
            print(f"MCF returned {len(mcf_results)} for '{keyword}' — using Indeed fallback")
            time.sleep(2)
            all_jobs.extend(fetch_indeed_jobs(keyword))
        time.sleep(1)  # Rate limit buffer between keywords

    return db.insert_jobs_deduplicated(all_jobs)
```

---

## Scoring — Ollama (gemma4:4b-it-qat)

```python
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

def score_job(jd_text: str, master_resume: str) -> dict | None:
    if len(jd_text.strip()) < 100:
        return None  # JD too short to score

    prompt = SCORING_PROMPT.format(
        master_resume=master_resume,
        jd_text=jd_text[:3000]  # Truncate very long JDs to fit context window
    )

    try:
        raw = ollama_chat(SCORING_MODEL, prompt, expect_json=True)
        data = json.loads(raw)
        assert all(k in data for k in ["fit_score", "matched_skills", "gaps", "recommendation", "reasoning"])
        return data
    except Exception as e:
        print(f"Scoring failed: {e}\nRaw: {raw[:200]}")
        return None
```

---

## Resume Tailoring — 2-Call Pipeline (qwen2.5:14b)

### Master Experience Pool (hardcoded — DO NOT let the model invent or modify these)

```python
# resume_tailor.py

CANDIDATE_PROFILE = """
Name: Chye Zhi Hao
Contact: +65 88952590 | desmondchye321@gmail.com
LinkedIn: linkedin.com/in/chye-zhi-hao | GitHub: github.com/BrownBOBAsushi

Education:
- Singapore Institute of Technology | B.Sc. Applied Computing in Fintech | Expected June 2028
- Singapore Polytechnic | Diploma in Mechatronics and Robotics Engineering | April 2023
  - Studied sensor systems, actuator control, electromechanical integration

Stack: Python (primary), TypeScript/JavaScript, Java, SQL
AI/LLM: Gemini API, context engineering, prompt design, RAG pipelines, agentic orchestration,
         multimodal analysis, open-source (Llama, Mistral) and closed-source (GPT-4, Gemini) tradeoffs
Tools: Git, Docker, VS Code, MongoDB, Qdrant, Supabase
Languages: English (Native), Chinese (Native), Malay (Professional), Japanese (N4)
"""

# LOCKED experience pool — exact metrics, exact dates, never modify without updating source
MASTER_EXPERIENCE = """
1. ASM Assembly Systems Singapore — PLIC Supplier Management Intern | Sep 2022 – Feb 2023
   - Reduced manual reporting time by 40% by automating KPI dashboards with Excel VBA
   - Partnered with engineering and procurement teams to track quality metrics and surface defect trends
   - Maintained technical documentation for recurring operational processes
   NOTE: This MUST always appear in the resume — it is the only real work experience.

2. SingHacks 2025 — 3rd Place | Agentic AI System (ERC-8004 + X402) | Python, Hedera SDK | Nov 2025
   - Built multi-agent system where AI agents autonomously transact on Hedera testnet, placing Top 3
   - Implemented identity authorization (ERC-8004 registry) and X402 micropayment flows
   - Delivered live technical demo to judges under time pressure

3. BlitzJobz — AI Micro-Shift Marketplace | Gemini 3 Hackathon | Python, Gemini API | Jan 2026
   - Integrated Gemini 3 to generate AI-assisted SOPs for job checklists via context engineering
   - Built multimodal verification pipeline using before/after video analysis to score task completion
   - Defined UAT-style acceptance criteria for matching logic and edge cases

4. EZBiz — Multi-Agent Orchestration Platform | Hello Future Hackathon | Python, Gemini API | Jan 2026
   - Designed Plan/Execute/Monitor agentic loop for autonomous opportunity discovery and execution
   - Implemented verifiable agent authorization using identity registry and micropayment concepts

5. Telegram RAG Bot | Python, Gemini API, Qdrant, MongoDB | Mar 2026
   - Built end-to-end RAG pipeline integrating Qdrant vector search with MongoDB
   - Improved retrieval precision by tuning vector indexing parameters and retrieval depth

6. NUS FinTech Summit 2026 — Ripple Mart | TypeScript, XRPL SDK, Node.js | 2026
   - Engineered TypeScript platform with XRPL SDK, implementing automated escrow flows and merchant DID
"""
```

### Call 1 — Gap Analysis + Experience Selection + XYZ Rewrite

```python
TAILORING_CALL1_PROMPT = """You are a professional resume writer for student internship applications.
Be ruthlessly selective. A bloated resume is a weak resume.

CANDIDATE PROFILE:
{candidate_profile}

MASTER EXPERIENCE POOL:
{master_experience}

JOB DESCRIPTION:
{jd_text}

Instructions:
1. Identify top 5 keywords missing from candidate profile but present in JD
2. Select ONLY the 3-4 most relevant experiences from the master pool for this specific JD
   - ASM internship MUST always be included (only real work experience)
   - Choose remaining 2-3 projects based on JD relevance
3. Rewrite each experience as 2-3 bullets using Google XYZ formula:
   "Accomplished [X], as measured by [Y], by doing [Z]"
   - Use real metrics from the pool — do NOT invent new ones
   - Naturally embed missing keywords where truthful
4. Select 6-8 most relevant technical skills for this JD

Respond in JSON only:
{{
  "missing_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "ats_flags": ["issue1", "issue2"],
  "selected_experiences": [
    {{
      "title": "Role/Project Title",
      "subtitle": "Company/Event | Tech Stack | Date",
      "bullets": ["XYZ bullet 1", "XYZ bullet 2", "XYZ bullet 3"]
    }}
  ],
  "selected_skills": {{
    "programming": ["lang1", "lang2"],
    "ai_llm": ["tool1", "tool2"],
    "tools": ["tool1", "tool2"]
  }},
  "match_score": <0-100>
}}"""
```

### Call 2 — HTML Resume Generation (Jake's Resume Style)

```python
TAILORING_CALL2_PROMPT = """You are a web developer generating a resume as HTML.
The output must look EXACTLY like Jake's Resume template — clean, single column, minimal.

CANDIDATE PROFILE:
{candidate_profile}

SELECTED EXPERIENCES (already written in XYZ format):
{selected_experiences_json}

SELECTED SKILLS:
{selected_skills_json}

JOB APPLYING FOR: {job_title} at {company}

Generate a complete, self-contained HTML file with inline CSS.
The resume must match this exact visual style:
- Background: white (#ffffff)
- Font: 'Times New Roman', serif — 11px base
- Max width: 750px, centered, padding 40px
- Name: 24px bold, centered, black
- Contact line: 10px, centered, gray (#555), links underlined
- Section headers: 13px bold uppercase, black, with full-width bottom border 1px solid black, margin-top 12px
- Company/Project name: bold, float left. Date: float right. Clear float after.
- Role/subtitle: italic, font-size 10px
- Bullets: margin-left 15px, font-size 10px, line-height 1.4, margin-bottom 2px
- Skills section: "Category:" bold inline, then comma-separated values normal weight
- No colors other than black, white, gray
- No tables, no flexbox columns for main content
- Page size: A4 — add CSS: @page {{ size: A4; margin: 15mm; }}

OUTPUT: Complete HTML only — no explanation, no markdown fences, no preamble.
Start with <!DOCTYPE html> and end with </html>."""
```

### Playwright PDF Compilation

```python
# resume_tailor.py
import asyncio, os
from playwright.async_api import async_playwright

async def html_to_pdf(html_content: str, job_id: str) -> str:
    # WINDOWS: always os.path.join — never hardcode slashes
    output_dir = os.path.join("generated_resumes", job_id)
    os.makedirs(output_dir, exist_ok=True)

    html_path = os.path.join(output_dir, "resume.html")
    pdf_path = os.path.join(output_dir, "resume.pdf")

    # Write HTML — encoding="utf-8" mandatory on Windows
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(f"file:///{os.path.abspath(html_path)}")
        await page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "15mm", "bottom": "15mm", "left": "15mm", "right": "15mm"}
        )
        await browser.close()

    if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) == 0:
        raise RuntimeError(f"Playwright PDF generation failed for job {job_id}")

    return pdf_path

def compile_resume(html_content: str, job_id: str) -> str:
    return asyncio.run(html_to_pdf(html_content, job_id))
```

> **Playwright Windows setup (run before Claude Code):**
> ```bash
> pip install playwright
> playwright install chromium
> ```
> This downloads Chromium (~300MB). Do it once before building.

---

## Master Resume Upload (.docx → markdown)

```python
# resume_converter.py
import os
from docx import Document
from markdownify import markdownify

def convert_docx_to_markdown(docx_bytes: bytes) -> str:
    import tempfile
    # Write to temp file — docx library needs a file path
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp.write(docx_bytes)
        tmp_path = tmp.name

    try:
        doc = Document(tmp_path)
        full_text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        return full_text
    finally:
        os.unlink(tmp_path)

def save_master_resume(docx_bytes: bytes) -> None:
    text = convert_docx_to_markdown(docx_bytes)
    resume_path = os.path.join(os.path.dirname(__file__), "master_resume.md")
    with open(resume_path, "w", encoding="utf-8") as f:
        f.write(text)
```

---

## File Structure

```
internship-tracker/
├── backend/
│   ├── main.py                  # FastAPI app — all endpoints
│   ├── scraper.py               # MCF API + JobSpy fallback
│   ├── scorer.py                # Ollama gemma4:4b scoring
│   ├── resume_tailor.py         # 2-call qwen2.5:14b tailoring + Playwright PDF
│   ├── resume_converter.py      # .docx → plain text
│   ├── db.py                    # SQLite — init + all queries
│   ├── jobs.db                  # SQLite database file (auto-created)
│   ├── master_resume.md         # Auto-generated from .docx upload
│   ├── generated_resumes/       # {job_id}/resume.html + resume.pdf
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── JobList.jsx          # Left panel — scrollable job list
│   │   │   ├── JobDetail.jsx        # Right panel — full JD + actions
│   │   │   ├── FilterBar.jsx        # Top filter strip
│   │   │   ├── SearchBar.jsx        # Keyword search
│   │   │   ├── ScoreBadge.jsx       # Fit score chip (green/yellow/red)
│   │   │   ├── PipelineButton.jsx   # Run pipeline + status
│   │   │   ├── ResumeUploader.jsx   # .docx drag-and-drop
│   │   │   └── ResumeGenerator.jsx  # Generate button + download
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Main two-panel view
│   │   │   └── Settings.jsx         # Resume upload + keyword config
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── .env                         # Empty — no API keys needed
└── README.md
```

---

## API Endpoints (FastAPI)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/pipeline/run` | Trigger scrape + score (background task) |
| GET | `/pipeline/status` | idle / scraping / scoring / done |
| GET | `/jobs` | All scored jobs. Params: `min_score`, `platform`, `arrangement`, `job_type`, `search`, `recommendation` |
| GET | `/jobs/{id}` | Single job with score detail |
| PATCH | `/jobs/{id}/status` | Update status tag (new/saved/applied/interviewing/offer) |
| DELETE | `/jobs/clear` | Clear all jobs + scores |
| POST | `/resume/upload` | .docx upload → convert → save master_resume.md |
| GET | `/resume` | Return master_resume.md content + last updated |
| POST | `/resume/generate/{job_id}` | Trigger 2-call tailoring + PDF |
| GET | `/resume/status/{job_id}` | pending / generating / done / failed |
| GET | `/resume/download/{job_id}` | Stream PDF |
| GET | `/settings/keywords` | Get current scrape keyword list |
| POST | `/settings/keywords` | Update scrape keyword list |

---

## Frontend UI — Two Panel Layout (SupCareer-inspired, minimalist)

### Design Principles
- Dark mode default (`#0a0a0a` background, `#1a1a1a` panels)
- Single accent color: indigo/purple (`#6366f1`)
- No gradients, no shadows, minimal borders
- Typography: Inter font
- Reference: SupCareer layout, Linear aesthetic

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Logo | Run Pipeline [btn] | Status chip | Settings     │
├────────────────────────┬────────────────────────────────────────┤
│  FILTER BAR (full width across both panels)                     │
│  Search | Platform | Score | Recommendation | Arrangement | Type│
├────────────────────────┼────────────────────────────────────────┤
│  LEFT PANEL (380px)    │  RIGHT PANEL (flex-1)                  │
│  Scrollable job list   │  Selected job detail                   │
│                        │                                        │
│  [Job Card]            │  Title — Company — Location            │
│  Title                 │  Type badge | Arrangement | Stipend    │
│  Company · Location    │  Posted date | Match score             │
│  Score · Rec badge     │  ─────────────────────────────         │
│  Type · Arrangement    │  Matched Skills (green pills)          │
│  Status tag            │  Gaps (red pills)                      │
│                        │  ─────────────────────────────         │
│  [Job Card]            │  Claude reasoning paragraph            │
│  ...                   │  ─────────────────────────────         │
│                        │  Full JD text (scrollable)             │
│                        │  ─────────────────────────────         │
│                        │  [Apply →] [Generate Resume] [Save]   │
│                        │  Status dropdown                       │
│                        │  (after generation: Download PDF btn)  │
│                        │  ATS flags (shown post-generation)     │
└────────────────────────┴────────────────────────────────────────┘
```

### Job Card (left panel)
- Title bold, 14px
- Company · Location, 12px gray
- Row: ScoreBadge (green/yellow/red) + Recommendation chip + Platform badge
- Row: Job type tag + Arrangement tag
- Status tag (new / saved / applied / interviewing / offer) — colored dot
- Selected state: indigo left border, slightly lighter background
- Hover: subtle background lift

### Filter Bar
- Platform: MCF / Indeed (toggle chips)
- Fit score: min slider 1–10
- Recommendation: Apply / Maybe / Skip (toggle chips)
- Work arrangement: Remote / Hybrid / On-site (toggle chips)
- Job type: Internship / Full-time / Contract (toggle chips)
- All filters client-side — instant, no API call

### Settings Page
- .docx drag-and-drop uploader
- Last updated timestamp
- Read-only preview of master_resume.md
- Editable keyword list (add/remove scrape keywords)
- Default keywords: ["software engineer intern", "product manager intern",
  "AI engineer intern", "fintech intern", "full stack intern", "data analyst intern"]

---

## Build Order for Claude Code

Follow exactly. Verify each step before proceeding.

1. **Pre-flight checks:**
   - `ollama list` — confirm both models are pulled
   - `playwright install chromium` — confirm Chromium installed
   - Curl MCF API and inspect actual JSON field names
   - Update scraper.py field mapping to match real response

2. **Backend: db.py** — SQLite init, all CRUD helpers. Verify `jobs.db` created.

3. **Backend: resume_converter.py** — .docx bytes → plain text via python-docx

4. **Backend: scraper.py** — MCF fetch + JobSpy fallback + deduplication.
   Test: run manually, print first 3 results, verify fields populated.

5. **Backend: scorer.py** — Ollama gemma4:4b scoring with JSON mode.
   Test: score one job manually, verify JSON parses correctly.

6. **Backend: resume_tailor.py** — 2-call qwen2.5:14b pipeline + Playwright PDF.
   Test: run on one real job, verify HTML generated, verify PDF opens correctly.

7. **Backend: main.py** — FastAPI, all endpoints. Pipeline as BackgroundTask.
   Test: curl each endpoint.

8. **Integration test:** Full pipeline A → check SQLite has jobs + scores.
   Full pipeline B → check generated_resumes/{id}/resume.pdf exists and renders.

9. **Frontend: scaffold** — Vite + React + Tailwind. Dark mode. Inter font.

10. **Frontend: Settings page** — ResumeUploader + keyword editor. Test upload flow.

11. **Frontend: Dashboard — left panel** — JobList + JobCard + FilterBar + SearchBar.
    Client-side filtering only. No API call on filter change.

12. **Frontend: Dashboard — right panel** — JobDetail with full JD, score display,
    matched skills, gaps, reasoning, status dropdown.

13. **Frontend: ResumeGenerator** — Generate button, status polling every 3s,
    Download PDF button on completion, ATS flags display.

14. **Frontend: PipelineButton** — trigger + poll /pipeline/status every 5s.

15. **Polish:** Loading skeletons, empty states, error toasts, consistent spacing.

---

## Constraints & Gotchas

- **Ollama must be running** before starting the backend. Add a startup check in main.py:
  ping `http://localhost:11434/api/tags` on FastAPI startup. If unreachable, log clear error.
- **qwen2.5:14b is slow** — resume generation takes 30–90 seconds on RTX 3060 Ti.
  Frontend must show clear "Generating..." state. Never let user think it crashed.
- **JSON mode for scoring** — always pass `format: "json"` to Ollama. Without it, small
  models frequently wrap JSON in markdown fences or add preamble text.
- **HTML generation — no JSON mode** — Call 2 generates HTML, not JSON.
  Set `expect_json=False`. Parse the raw string directly.
- **MCF field names** — verify against live API before coding. Fields like `postedCompany`,
  `position.title`, `employmentTypes` are community-observed, not officially documented.
  They may have changed. Always curl first.
- **ASM internship must always appear** — hardcode this rule in the Call 1 prompt.
  It is the only real work experience and must never be omitted.
- **Do not invent metrics** — the model must only use metrics from MASTER_EXPERIENCE.
  "40% reduction" and "Top 3" are real. Any other numbers are hallucinated.
- **Windows paths** — every file path: `os.path.join()`. Every file open: `encoding="utf-8"`.
  No exceptions anywhere in the codebase.
- **SQLite concurrency** — FastAPI background tasks + main thread both write to SQLite.
  Use `check_same_thread=False` in sqlite3.connect() and add a threading.Lock() around writes.
- **JD truncation** — truncate jd_text to 3000 chars before sending to scoring model.
  Small context windows on 4B models — long JDs cause degraded output.
- **Deduplication** — UNIQUE constraint on `url` in SQLite. Catch `IntegrityError` in
  insert function and skip silently.
- **Pipeline as BackgroundTask** — POST /pipeline/run returns 202 immediately.
  Store pipeline state in a module-level dict, not SQLite (avoid concurrency issues).
- **Resume HTML must be self-contained** — no external fonts, no CDN links.
  Playwright renders offline. Use system fonts (Times New Roman) or base64-embed fonts.

---

## Success Criteria

- MCF API returns ≥ 20 real Singapore listings per pipeline run per keyword
- JobSpy fallback activates automatically when MCF returns < 10 results
- Ollama scoring returns valid JSON for > 90% of JDs (JSON mode enforced)
- Full pipeline A (scrape + score 50 jobs) completes in < 5 minutes
- Resume PDF generated within 90 seconds of button click
- PDF visually matches Jake's Resume style (single column, serif font, section rules)
- ASM internship appears in every generated resume without exception
- All filters work client-side, instant response
- Dashboard renders in < 1 second (all data local, no network)
- Status tags persist across page refresh

---

## Python requirements.txt

```
fastapi
uvicorn
python-jobspy
python-docx
markdownify
python-multipart
playwright
requests
```

> No anthropic, no supabase, no groq. Zero paid dependencies.

## Frontend package.json additions

```
react-router-dom
```

> No @dnd-kit needed — kanban dropped for v1.

---

## Environment Variables

```
# .env is intentionally almost empty
# Ollama runs on localhost:11434 — no key needed
# SQLite is a local file — no connection string needed
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Pre-Build Checklist (complete before opening Claude Code)

- [ ] Ollama installed and running (`ollama serve`)
- [ ] `ollama pull gemma4:e4b` completed (correct tag — NOT gemma4:4b-it-qat)
- [ ] `ollama pull qwen2.5:14b` completed
- [ ] `playwright install chromium` completed
- [ ] MiKTeX NOT needed — LaTeX dropped, using Playwright
- [ ] MCF API field mapping VERIFIED ✅ (done 2026-04-12, fields confirmed)
- [ ] Python 3.10+ installed and in PATH
- [ ] Node 18+ installed (`node --version`)
- [ ] Project folder created: `internship-tracker/`

---

## v2 Backlog

- Kanban board (Saved → Applied → Interviewing → Offer) with drag-and-drop
- LinkedIn scraping (via stickerdaniel/linkedin-mcp-server when Docker is set up)
- JobStreet integration
- Cover letter generation per role
- Interview prep questions per role
- Scheduled pipeline runs
- Browser extension to manually add jobs from any job board
