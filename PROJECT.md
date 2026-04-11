# PROJECT.md — Personal Internship Intelligence System

## Overview

A personal job intelligence system for Chye Zhi Hao — Year 1 Applied Computing in Fintech student
at SIT targeting Tech / Product / AI internships and junior roles in Singapore. The system scrapes
job listings via LinkedIn MCP + JobSpy (Indeed fallback), scores each role against a master resume
using Claude API, and surfaces a ranked shortlist via a polished React dashboard. For roles the user
is keen on, a single button triggers an automated resume tailoring pipeline — generating an
ATS-optimised, Jake's Resume-formatted PDF compiled server-side from LaTeX.

Inspired by ELZOS but with three key improvements:
- AI-powered fit scoring and ranking (ELZOS has none)
- Per-role resume tailoring with PDF download (ELZOS has none)
- Cleaner, more polished UI with internship-specific filters

---

## Goals

- Aggregate job listings from LinkedIn (via MCP) + Indeed (via JobSpy fallback)
- Score and rank every role against master resume using Claude API — ruthlessly honest, not optimistic
- Surface a ranked shortlist with fit score, matched skills, gaps, and recommendation
- Internship-specific filters: stipend range, duration, work arrangement, job type
- Simple kanban tracker: Saved → Applied → Interviewing → Offer
- On-demand: generate a tailored, ATS-optimised resume as downloadable PDF per role
- Drag-and-drop .docx resume upload → auto-converted to markdown
- Clean, polished UI — significantly better than ELZOS aesthetically

---

## Non-Goals

- Automated job submission / one-click apply
- Vector embeddings or semantic search
- Email/Slack notifications
- Multi-user support
- Scheduled/cron pipeline runs (manual trigger only for now)

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Job Sourcing (Primary) | LinkedIn MCP | Official MCP integration — stable, compliant, no session cookie hacks |
| Job Sourcing (Fallback) | JobSpy (`pip install python-jobspy`) | Scrapes Indeed without API key |
| Backend | Python (FastAPI) | REST API for all pipeline triggers + data access |
| LLM Scoring + Tailoring | Claude API (`claude-sonnet-4-20250514`) | Anthropic SDK, reliable JSON output |
| LaTeX Compiler | MiKTeX (Windows) | Compiles Jake's Resume .tex → PDF server-side |
| Database | Supabase (free tier) | PostgreSQL — jobs, scores, applications, resume outputs |
| Frontend | React + Vite + TailwindCSS | Polished dark-mode dashboard |
| Resume Storage | Drag-and-drop .docx → auto-convert to markdown | Stored as `master_resume.md` |

---

## System Architecture

### Pipeline A — Job Ingestion + Scoring (manual trigger)

```
[User clicks "Run Pipeline" in Dashboard]
        ↓
[Backend calls LinkedIn MCP → fetch job listings]
        ↓ (if LinkedIn MCP fails or returns < 10 results)
[Fallback: JobSpy scrapes Indeed]
        ↓
[Deduplicate by URL → insert new jobs to Supabase]
        ↓
[For each unscored job → Claude API scoring call]
        ↓
[Claude returns: fit_score, matched_skills, gaps, recommendation, reasoning]
        ↓
[Scores written to Supabase → dashboard re-renders ranked list]
```

### Pipeline B — Resume Tailoring (per-job, on-demand)

```
[User clicks "Generate Resume" on a specific job card]
        ↓
[POST /resume/generate/{job_id}]
        ↓
[Backend loads master_resume.md + jd_text for that job]
        ↓
[Claude API — Call 1: match score + top 5 missing keywords + ATS flags]
        ↓
[Claude API — Call 2: select relevant experiences + XYZ bullet rewrite]
        ↓
[Claude API — Call 3: generate full main.tex using Jake's Resume template]
        ↓
[pdflatex compiles main.tex → output.pdf (Windows: MiKTeX)]
        ↓
[PDF served via GET /resume/download/{job_id}]
        ↓
[Job card shows: match score, ATS flags, "Download PDF" button]
```

---

## Data Models

### Supabase SQL — run this in SQL Editor before starting Claude Code

```sql
-- Table 1: jobs
create table jobs (
  id uuid default gen_random_uuid() primary key,
  platform text,
  title text,
  company text,
  location text,
  work_arrangement text,
  job_type text,
  duration text,
  stipend text,
  jd_text text,
  url text unique,
  scraped_at timestamp default now(),
  scored boolean default false,
  scoring_failed boolean default false
);

-- Table 2: job_scores
create table job_scores (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) on delete cascade,
  fit_score integer,
  matched_skills text[],
  gaps text[],
  recommendation text,
  reasoning text,
  scored_at timestamp default now()
);

-- Table 3: applications
create table applications (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) on delete cascade,
  status text default 'saved',
  notes text,
  applied_at timestamp,
  updated_at timestamp default now()
);

-- Table 4: resume_outputs
create table resume_outputs (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) on delete cascade,
  match_score integer,
  missing_keywords text[],
  ats_flags text[],
  latex_path text,
  pdf_path text,
  generation_failed boolean default false,
  generated_at timestamp default now()
);
```

---

## LinkedIn MCP Integration

LinkedIn provides an official MCP server. The backend calls it through the Anthropic SDK's
mcp_servers parameter — no separate MCP client needed.

### Usage in scraper.py

```python
import anthropic, json, os

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def fetch_linkedin_jobs(keywords: str, location: str = "Singapore", max_results: int = 50) -> list:
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""Search LinkedIn for job listings matching: {keywords}
Location: {location}
Max results: {max_results}

Return a JSON array. Each item must have these fields:
title, company, location, work_arrangement, job_type, duration, stipend, jd_text, url

Return ONLY the JSON array, no preamble or markdown fences."""
        }],
        mcp_servers=[{
            "type": "url",
            "url": "https://linkedin.mcp.claude.com/mcp",
            "name": "linkedin"
        }]
    )
    raw = message.content[0].text.strip()
    cleaned = raw.removeprefix("```json").removesuffix("```").strip()
    return json.loads(cleaned)
```

### JobSpy Fallback (Indeed)

```python
from jobspy import scrape_jobs

def fetch_indeed_jobs(keywords: str, location: str = "Singapore", max_results: int = 50) -> list:
    df = scrape_jobs(
        site_name=["indeed"],
        search_term=keywords,
        location=location,
        results_wanted=max_results,
        country_indeed="Singapore"
    )
    jobs = []
    for _, row in df.iterrows():
        jobs.append({
            "platform": "indeed",
            "title": row.get("title", ""),
            "company": row.get("company", ""),
            "location": row.get("location", ""),
            "work_arrangement": row.get("job_type", ""),
            "job_type": "",
            "duration": "",
            "stipend": str(row.get("min_amount", "")),
            "jd_text": row.get("description", ""),
            "url": row.get("job_url", "")
        })
    return jobs
```

### Scraper Logic (scraper.py main function)

```python
def run_scrape(keywords_list: list[str]) -> int:
    """Returns number of new jobs inserted."""
    all_jobs = []
    for keyword in keywords_list:
        try:
            jobs = fetch_linkedin_jobs(keyword)
            if len(jobs) < 10:
                raise ValueError("LinkedIn MCP returned too few results — falling back")
            for j in jobs:
                j["platform"] = "linkedin"
            all_jobs.extend(jobs)
        except Exception as e:
            print(f"LinkedIn MCP failed for '{keyword}': {e} — using JobSpy fallback")
            import time; time.sleep(2)
            all_jobs.extend(fetch_indeed_jobs(keyword))
    return db.insert_jobs_deduplicated(all_jobs)  # returns count of newly inserted
```

---

## Claude API Scoring

```python
SCORING_PROMPT = """You are an expert tech recruiter evaluating a student candidate's fit for a role.
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

Target: Tech / Product / AI roles in Singapore."""

def score_job(jd_text: str, master_resume: str) -> dict | None:
    if len(jd_text.strip()) < 100:
        return None  # JD too short to score reliably
    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": SCORING_PROMPT.format(
                master_resume_text=master_resume,
                jd_text=jd_text
            )}]
        )
        raw = message.content[0].text.strip()
        cleaned = raw.removeprefix("```json").removesuffix("```").strip()
        data = json.loads(cleaned)
        assert all(k in data for k in ["fit_score", "matched_skills", "gaps", "recommendation", "reasoning"])
        return data
    except Exception as e:
        print(f"Scoring failed: {e}")
        return None
```

---

## Resume Tailoring Pipeline

Three sequential Claude API calls. Never merge — each feeds the next.

### Master Experience Pool (hardcoded in resume_tailor.py)

```python
MASTER_EXPERIENCE = """
- ASM internship: Excel VBA automation (40% efficiency gain), KPI tracking,
  cross-functional stakeholder work, quality/metrology checks
- SingHacks 2025 (3rd place): Agentic AI system on Hedera, ERC-8004 identity,
  X402 micropayments, Python
- Gemini 3 Hackathon: BlitzJobz marketplace, AI-assisted SOP generation,
  multimodal verification pipeline, UAT-style validation
- Hello Future Hackathon: EZBiz multi-agent orchestration (Plan->Execute->Monitor),
  competitor research, micropayments
- CFA Investing Simulator: Top 10% global, risk management, market signal interpretation
- NUS FinTech Summit 2026: Ripple Mart, TypeScript, XRPL SDK, escrow flows, merchant DID
- Stock Market Trend Analysis: Python, Streamlit, pandas/NumPy, yfinance, benchmarking
- Java 2D Game Engine: 42-class architecture, SOLID principles, Strategy/Factory/Template patterns
"""

CANDIDATE_PROFILE = """
Chye Zhi Hao — Year 1 Applied Computing in Fintech, SIT, graduating 2028.
Diploma in Mechatronics & Robotics, Singapore Polytechnic (2023).
Stack: Python, TypeScript/JavaScript, Java, React.js, Node.js, SQL, Hedera SDK, XRPL SDK.
Tools: Excel VBA, Docker, Supabase, Git, Figma.
"""
```

### Call 1 — Gap Analysis + ATS Audit

```
You are an expert ATS system and tech recruiter.

CANDIDATE PROFILE:
{candidate_profile}

JOB DESCRIPTION:
{jd_text}

Respond ONLY in valid JSON with no preamble:
{
  "match_score": <integer 0-100>,
  "missing_keywords": [<top 5 keywords from JD absent in candidate profile>],
  "hard_blockers": [<requirements candidate clearly cannot meet>],
  "ats_flags": [<formatting issues or missing sections ATS bots penalise>]
}
```

### Call 2 — Experience Selection + XYZ Rewrite

```
You are a professional resume writer for student internship applications.

CANDIDATE PROFILE: {candidate_profile}
MASTER EXPERIENCE POOL: {master_experience}
JOB DESCRIPTION: {jd_text}
MISSING KEYWORDS TO EMBED: {missing_keywords}

Instructions:
- Select ONLY the 3-4 most relevant experiences from the master pool
- Rewrite each as 2-3 bullets: "Accomplished X, as measured by Y, by doing Z"
- Embed missing keywords where truthful
- Do NOT invent metrics — only use what is in the pool
- Lead with projects/hackathons over internship if role is technical

Respond ONLY in valid JSON:
{
  "selected_experiences": [
    {"title": "<name>", "bullets": ["<bullet 1>", "<bullet 2>"]}
  ],
  "skills_to_highlight": [<8-10 most relevant skills>]
}
```

### Call 3 — LaTeX Generation (Jake's Resume)

```
You are a LaTeX expert. Generate a complete main.tex using Jake's Resume template.

CANDIDATE PROFILE: {candidate_profile}
SELECTED EXPERIENCES: {selected_experiences}
SKILLS: {skills_to_highlight}
APPLYING FOR: {job_title} at {company}

Rules:
- Jake's Resume template sections: Education, Experience, Projects, Technical Skills
- 1 page only
- No tables or multi-column layouts in main content (breaks ATS)
- Standard section headers only
- Do not hallucinate any data not provided
- Output ONLY the complete main.tex — no explanation, no markdown fences

Jake's Resume base (complete the document):
\documentclass[letterpaper,11pt]{article}
\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage[usenames,dvipsnames]{color}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}
\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}
\raggedbottom\raggedright
\setlength{\tabcolsep}{0in}
\pdfgentounicode=1
```

### LaTeX Compilation (Windows-safe)

```python
import subprocess, os

def compile_latex(tex_content: str, job_id: str) -> str:
    # WINDOWS: always os.path.join — never hardcode forward slashes
    output_dir = os.path.join("generated_resumes", job_id)
    os.makedirs(output_dir, exist_ok=True)

    tex_path = os.path.join(output_dir, "main.tex")
    pdf_path = os.path.join(output_dir, "main.pdf")

    # encoding="utf-8" is mandatory on Windows
    with open(tex_path, "w", encoding="utf-8") as f:
        f.write(tex_content)

    # Run twice — LaTeX needs two passes for correct layout
    for _ in range(2):
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode",
             f"-output-directory={output_dir}", tex_path],
            capture_output=True, text=True, timeout=60
        )

    # pdflatex can exit 0 on soft errors — always verify PDF is real
    if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) == 0:
        log_path = os.path.join(output_dir, "main.log")
        log = open(log_path, encoding="utf-8").read() if os.path.exists(log_path) else "No log"
        raise RuntimeError(f"pdflatex produced no valid PDF.\nLog:\n{log}")

    return pdf_path
```

> **Windows — install MiKTeX before running Claude Code:**
> 1. Download from **https://miktex.org/download**
> 2. Run installer → "Install for all users" → set missing packages to **Yes (auto)**
> 3. Open a **new** Command Prompt and run: `pdflatex --version`
>
> All paths in resume_tailor.py must use `os.path.join()`. All file writes must use `encoding="utf-8"`.

---

## File Structure

```
internship-tracker/
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── scraper.py               # LinkedIn MCP + JobSpy fallback
│   ├── scorer.py                # Claude API scoring
│   ├── resume_tailor.py         # 3-step Claude tailoring + pdflatex
│   ├── resume_converter.py      # .docx -> markdown
│   ├── db.py                    # Supabase client + queries
│   ├── master_resume.md         # Auto-generated from .docx upload
│   ├── generated_resumes/       # {job_id}/main.tex + main.pdf
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── JobBoard.jsx
│   │   │   ├── JobCard.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── KanbanBoard.jsx
│   │   │   ├── KanbanCard.jsx
│   │   │   ├── PipelineButton.jsx
│   │   │   ├── ResumeUploader.jsx
│   │   │   └── ResumeGenerator.jsx
│   │   ├── pages/
│   │   │   ├── Jobs.jsx
│   │   │   ├── Applications.jsx
│   │   │   └── Settings.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── .env
└── README.md
```

---

## Environment Variables

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

> No Apify token needed. LinkedIn MCP uses the Anthropic API key. JobSpy needs no key.

---

## API Endpoints (FastAPI)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/pipeline/run` | Trigger scrape + score pipeline (runs as background task) |
| GET | `/pipeline/status` | Idle / Scraping / Scoring / Done |
| GET | `/jobs` | All scored jobs. Params: `min_score`, `platform`, `arrangement`, `job_type`, `search` |
| GET | `/jobs/{id}` | Single job detail |
| PATCH | `/jobs/{id}/status` | Update kanban status |
| DELETE | `/jobs/clear` | Clear all jobs |
| POST | `/resume/upload` | .docx upload → convert → save master_resume.md |
| GET | `/resume` | Return current master_resume.md content |
| POST | `/resume/generate/{job_id}` | Trigger 3-step tailoring pipeline |
| GET | `/resume/status/{job_id}` | pending / generating / done / failed |
| GET | `/resume/download/{job_id}` | Stream PDF for download |

---

## Dashboard UI Requirements

### Design Direction
Dark mode default. Clean card-based layout. Colour-coded scores. Smooth transitions.
Reference aesthetic: Linear, Raycast, Vercel dashboard. Significantly better than ELZOS.

### Page 1 — Jobs
- Top bar: "Run Pipeline" button + last run timestamp + status chip
- Search bar: keyword search across title, company, JD text (client-side, instant)
- Filter bar (collapsible):
  - Platform: LinkedIn / Indeed
  - Fit score: min slider (1–10)
  - Recommendation: Apply / Maybe / Skip (toggle chips)
  - Work arrangement: Remote / Hybrid / On-site
  - Job type: Internship / Full-time / Contract / Part-time
  - Duration: 3 months / 6 months / 12 months
  - Stipend: None / <SGD 1000 / SGD 1000–2000 / >SGD 2000
- Job grid sorted by fit_score descending
- Job card (collapsed): title, company, platform badge, arrangement tag, fit score chip, recommendation badge
- Job card (expanded):
  - Claude reasoning
  - Matched skills (green tags) + Gaps (red tags)
  - Stipend + duration
  - Link to original JD
  - "Generate Resume" button → status polling → "Download PDF" when done
  - ATS flags (shown after generation)
  - "Save to Tracker" button

### Page 2 — Applications (Kanban)
- 4 columns: Saved / Applied / Interviewing / Offer
- Drag-and-drop between columns using @dnd-kit/core
- Card: title, company, fit score, platform badge
- Expanded card: notes, applied date, JD link, PDF link if generated

### Page 3 — Settings
- .docx drag-and-drop uploader
- Last updated timestamp
- Read-only markdown preview of master_resume.md
- Editable keyword list for pipeline scrape (e.g. "software engineer intern", "AI engineer intern")

---

## Build Order for Claude Code

Follow exactly. Do not skip ahead.

1. **System check** — `pdflatex --version`. If missing: halt, tell user to install MiKTeX from https://miktex.org/download
2. **Supabase** — run 4-table SQL above. Confirm tables exist before proceeding.
3. **Backend: db.py** — Supabase client, CRUD helpers for all 4 tables
4. **Backend: resume_converter.py** — .docx → markdown via python-docx + markdownify
5. **Backend: scraper.py** — LinkedIn MCP fetch + JobSpy Indeed fallback + deduplication logic
6. **Backend: scorer.py** — Claude API scoring with JSON parsing + fallback
7. **Backend: resume_tailor.py** — 3 sequential Claude calls + pdflatex. All paths: os.path.join(). All writes: encoding="utf-8"
8. **Backend: main.py** — FastAPI, all endpoints, pipeline as background task
9. **Test Pipeline A** — scrape → check Supabase jobs table → check job_scores table
10. **Test Pipeline B** — /resume/generate/{job_id} → verify PDF in generated_resumes/
11. **Frontend: scaffold** — Vite + React + Tailwind + React Router. Dark mode default.
12. **Frontend: Settings page** — ResumeUploader first (foundation for everything)
13. **Frontend: Jobs page** — JobBoard, JobCard, FilterBar, SearchBar, PipelineButton
14. **Frontend: ResumeGenerator** — button, polling, download
15. **Frontend: Applications page** — KanbanBoard with @dnd-kit/core drag-and-drop
16. **Polish** — loading skeletons, empty states, transitions, consistent spacing

---

## Constraints & Gotchas

- **LinkedIn MCP fallback.** If MCP returns < 10 results or throws, silently fall through to JobSpy. Never surface MCP failure as a user-facing error.
- **JobSpy rate limiting.** `time.sleep(2)` between keyword searches. Max 3 keyword searches per pipeline run.
- **Claude rate limits.** `time.sleep(1)` between scoring calls. Sequential only — never parallelise.
- **JSON parsing.** Strip markdown fences before JSON.loads(). Validate required keys. On failure: scoring_failed=true, log raw, continue.
- **Short JDs.** If jd_text < 100 chars: skip scoring, mark scoring_failed=true with reason "JD too short".
- **Resume tailoring calls are sequential.** Pass Call 1 output into Call 2 prompt. Pass Call 2 output into Call 3 prompt. Never merge or skip.
- **LaTeX from Claude is imperfect.** Run pdflatex twice. If PDF still invalid: generation_failed=true, save .tex for manual debug.
- **Windows paths.** Every path: os.path.join(). Every file open: encoding="utf-8". No exceptions anywhere in the codebase.
- **MiKTeX first run is slow.** It auto-downloads missing LaTeX packages on first compile. Subsequent runs are fast. This is expected behaviour.
- **Deduplication.** Supabase unique constraint on url column handles DB-level dedup. Catch constraint violation in Python and skip silently.
- **master_resume.md.** Read fresh from disk at start of each pipeline run — never cache at startup.
- **Kanban drag-and-drop.** Use @dnd-kit/core — react-beautiful-dnd is unmaintained, do not use it.
- **Pipeline as background task.** POST /pipeline/run must return immediately with 202 Accepted. Run the actual scrape+score as a FastAPI BackgroundTask. Frontend polls /pipeline/status.

---

## Success Criteria

- LinkedIn MCP fetches at least 20 real listings per pipeline run
- JobSpy fallback activates automatically when LinkedIn MCP returns < 10 results
- Claude scoring returns valid JSON for >95% of JDs
- Dashboard renders ranked list within 2 seconds
- All 7 filter types work independently and in combination
- Keyword search returns results within 300ms (client-side)
- Resume PDF generated within 60 seconds of button click
- Kanban drag-and-drop persists to Supabase
- UI is visibly cleaner than ELZOS — dark mode, consistent design language

---

## Python requirements.txt

```
fastapi
uvicorn
supabase
anthropic
python-jobspy
python-docx
markdownify
python-multipart
```

## Frontend package.json additions

```
react-router-dom
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

---

## v2 Ideas (out of scope for now)

- Cover letter generation per role
- Interview prep questions per role
- Scheduled pipeline runs
- JobStreet + MyCareersFuture integration
- Browser extension to manually add jobs from any board
- Email digest of top new roles each morning
