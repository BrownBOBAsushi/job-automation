# Internship Intelligence System

A personal job intelligence system for internship hunting in Singapore. Scrapes listings from MyCareersFuture and Indeed, scores every role against your master resume using local LLMs via Ollama, and surfaces a ranked shortlist via a dark-mode dashboard. For roles you're keen on, one click triggers a 2-step resume tailoring pipeline — generating a Playwright-compiled PDF using Jake's Resume HTML template.

---

## Features

- **Job aggregation** — MyCareersFuture public API (primary) + Indeed via JobSpy (fallback)
- **AI fit scoring** — local LLM (`gemma4:e4b`) evaluates every JD against your resume: fit score 1–10, matched skills, gaps, recommendation (Apply / Maybe / Skip)
- **JD signal extraction** — requirements/responsibilities section is extracted before truncation so the model sees actual signal, not company blurb
- **On-demand resume tailoring** — 2-step local LLM pipeline: gap analysis + project selection (gemma4:e4b), then XYZ bullet rewrite (qwen2.5:14b), compiled to PDF via Playwright
- **Project category filtering** — Python-side guardrails prevent finance/blockchain projects appearing on tech JDs regardless of model output
- **Skills pool validation** — hallucinated skills are stripped against a known pool before appearing on the resume
- **Post-generation eval warnings** — deterministic checks after each generation (metric preservation, keyword embedding, project rendering) surfaced in the UI
- **Keyword customisation** — configure search terms per pipeline run via Settings
- **Status tracking** — per-job kanban status (New → Saved → Applied → Interviewing → Offer)

---

## Tech Stack

| Layer | Tool |
|---|---|
| Job sources | MyCareersFuture REST API, Indeed (JobSpy) |
| Backend | Python + FastAPI |
| LLM runtime | Ollama (local) |
| Scoring model | `gemma4:e4b` |
| Rewrite model | `qwen2.5:14b` |
| PDF compiler | Playwright (Chromium headless) |
| Database | SQLite (`jobs.db` — no external setup) |
| Frontend | React + Vite + TailwindCSS |

---

## Prerequisites

### 1. Ollama (required for scoring + resume generation)

1. Download from [ollama.com](https://ollama.com)
2. Install and start the Ollama service
3. Pull both models:
   ```
   ollama pull gemma4:e4b
   ollama pull qwen2.5:14b
   ```
4. Verify Ollama is running:
   ```
   curl http://localhost:11434/api/tags
   ```

### 2. Python 3.11+

```
python --version
```

### 3. Node.js 18+

```
node --version
```

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/BrownBOBAsushi/job-automation
cd job-automation
```

No `.env` file required — no external API keys or cloud services.

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install Playwright browser

```bash
playwright install chromium
```

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running the App

### Start the backend

```bash
cd backend
uvicorn main:app --reload
```

API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

The SQLite database (`jobs.db`) is created automatically on first start. If the database schema is missing the `eval_warnings` column (older installs), it is added automatically via migration on startup.

### Start the frontend

```bash
cd frontend
npm run dev
```

Dashboard runs at `http://localhost:5173`.

---

## Usage

### Upload your resume

1. Go to **Settings** page
2. Drag and drop your `.docx` resume
3. The system converts it to markdown and stores it as `master_resume.md`
4. Every pipeline run will use this version automatically

### Configure search keywords

1. Go to **Settings** page
2. Edit the keyword list used for scraping MyCareersFuture
3. Keywords are persisted to `keywords.json`

### Run the job pipeline

1. Go to **Jobs** page
2. Click **Run Pipeline**
3. The backend scrapes MyCareersFuture + Indeed, deduplicates, then scores every new job against your resume using `gemma4:e4b`
4. The dashboard re-renders with jobs ranked by fit score

### Filter and search

- Keyword search (client-side, instant) across title, company, and JD text
- Filter by: platform, fit score, recommendation, work arrangement, job type

### Generate a tailored resume

1. Click a job card to expand it
2. Click **Generate Resume**
3. The system runs 2 sequential LLM calls:
   - **Call 1** (`gemma4:e4b`) — JD signal extraction, gap analysis, project selection (filtered + backfilled in Python), skills validation
   - **Call 2** (`qwen2.5:14b`) — XYZ bullet rewrite for selected projects and ASM internship
4. Python builds the HTML resume from the Jake's Resume template (no LLM involved)
5. Playwright compiles the HTML to PDF
6. Post-generation eval checks run and any warnings are stored
7. Click **Download PDF** — warnings (if any) display below the button in amber

### Track applications

Use the status dropdown on each job card to move it through:
New → Saved → Applied → Interviewing → Offer

---

## Architecture

### Pipeline A — Job Ingestion + Scoring

```
[User clicks "Run Pipeline"]
        ↓
[Scrape MyCareersFuture API for each keyword]
        ↓ (on failure or < 10 results)
[Fallback: JobSpy scrapes Indeed]
        ↓
[Deduplicate by URL → insert new jobs to SQLite]
        ↓
[For each unscored job → _extract_jd_signal() → gemma4:e4b scoring call]
        ↓
[Scores written to SQLite → dashboard re-renders]
```

POST `/pipeline/run` returns **202 Accepted** immediately. Scrape + score runs as a background thread. Frontend polls `/pipeline/status`.

### Pipeline B — Resume Tailoring

```
[User clicks "Generate Resume" on a job card]
        ↓
[POST /resume/generate/{job_id}]
        ↓
[_extract_jd_signal() — seek to Requirements/Responsibilities section]
        ↓
[Call 1: gemma4:e4b — match_score, missing_keywords, ats_flags,
         selected_project_ids, selected_skills]
        ↓
[Python: _filter_and_fill_project_ids() — strip invalid categories, backfill to 3]
[Python: _validate_skills() — remove hallucinated skills against SKILLS_POOL]
        ↓
[Call 2: qwen2.5:14b — rewrite ASM bullets + selected project bullets (XYZ formula)]
        ↓
[Python: _build_html() — assemble Jake's Resume HTML template]
        ↓
[_evaluate_resume() — check metric preservation, keyword embedding, project rendering]
        ↓
[pdf_worker.py: Playwright compiles HTML → PDF]
        ↓
[eval_warnings + paths saved to SQLite]
        ↓
[GET /resume/download/{job_id} → streams PDF]
```

---

## Resume Generation Detail

### Two-call LLM separation

**Call 1 — Analysis only** (`gemma4:e4b`, fast 4B model):
Returns structured JSON: match score, missing keywords, ATS flags, which 3 projects to use, which skills subset to show. No prose writing.

**Call 2 — Writing only** (`qwen2.5:14b`, larger model):
Receives only the 3 selected project bullets + missing keywords to embed. Rewrites using Google XYZ formula. Never sees the full project pool.

### Python-side quality guardrails

| Guardrail | What it prevents |
|---|---|
| `_extract_jd_signal()` | Model reading company blurb instead of requirements |
| `_filter_and_fill_project_ids()` | Finance/blockchain projects on tech JDs |
| `_validate_skills()` | Hallucinated skills (Kubernetes, Rust, etc.) on resume |
| `_build_html()` 40% safety | ASM "40% reduction" metric stripped by model |
| `_evaluate_resume()` | Silent failures only caught by manual PDF inspection |

### Eval warnings

Four deterministic checks run after HTML build (no LLM):
1. ASM 40% metric present in bullet 1
2. All selected project titles rendered in HTML
3. At least one missing keyword embedded somewhere
4. SingHacks "Top 3" metric preserved (if selected)

Warnings are stored in `resume_outputs.eval_warnings` and shown below the Download PDF button in amber. They do not block download.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/pipeline/run` | Trigger scrape + score (202, background task) |
| GET | `/pipeline/status` | `idle / scraping / scoring / done / error` |
| GET | `/jobs` | All jobs. Query: `min_score`, `platform`, `arrangement`, `job_type`, `search`, `recommendation` |
| GET | `/jobs/{id}` | Single job with score attached |
| PATCH | `/jobs/{id}/status` | Update status (`new / saved / applied / interviewing / offer`) |
| DELETE | `/jobs/clear` | Delete all jobs and scores |
| POST | `/resume/upload` | Upload `.docx` → converts to `master_resume.md` |
| GET | `/resume` | Return current `master_resume.md` content |
| POST | `/resume/generate/{job_id}` | Trigger 2-step tailoring pipeline |
| GET | `/resume/status/{job_id}` | `not_started / pending / generating / done / failed` |
| GET | `/resume/download/{job_id}` | Stream PDF for download |
| GET | `/settings/keywords` | Get current scrape keywords |
| POST | `/settings/keywords` | Update scrape keywords |

---

## File Structure

```
job-automation/
├── backend/
│   ├── main.py                  # FastAPI app + all endpoints
│   ├── scraper.py               # MCF API + JobSpy Indeed fallback
│   ├── scorer.py                # Ollama scoring + _extract_jd_signal()
│   ├── resume_tailor.py         # 2-call Ollama pipeline + HTML builder + eval
│   ├── resume_converter.py      # .docx → markdown (python-docx + markdownify)
│   ├── pdf_worker.py            # Playwright subprocess: HTML → PDF
│   ├── db.py                    # SQLite CRUD (jobs, job_scores, resume_outputs)
│   ├── jobs.db                  # Auto-created SQLite database
│   ├── master_resume.md         # Auto-generated from .docx upload
│   ├── keywords.json            # Persisted scrape keywords
│   ├── generated_resumes/       # {job_id}/resume.html + resume.pdf
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── JobList.jsx
│   │   │   ├── JobCard.jsx
│   │   │   ├── JobDetail.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── PipelineButton.jsx
│   │   │   ├── ResumeUploader.jsx
│   │   │   └── ResumeGenerator.jsx
│   │   ├── pages/
│   │   │   ├── Jobs.jsx
│   │   │   └── Settings.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

---

## Scoring Logic

`gemma4:e4b` is instructed to score ruthlessly honestly — not optimistically. The candidate is a Year 1 university student competing against more experienced candidates.

| Score | Meaning |
|---|---|
| 8–10 | Strong fit — most requirements met, apply immediately |
| 5–7 | Partial fit — worth reviewing, 1–2 key gaps |
| 1–4 | Weak fit — significant gaps, skip unless target company |

---

## Known Constraints

- **Ollama must be running** before starting the backend — scoring and resume generation will fail silently otherwise (warning printed at startup)
- **Model cold start is slow** — first Ollama call after a system restart takes 30–60s to load the model into VRAM; subsequent calls are fast
- **Pipeline is manual trigger only** — no scheduled/cron runs
- **JobSpy can break** if Indeed changes their HTML structure — acceptable for a personal tool
- **LLM calls are sequential** — never parallelised; `time.sleep(1)` between Call 1 and Call 2 to avoid GPU contention
- **JDs under 100 characters are skipped** — marked `scoring_failed=1`
- **gemma4:e4b is a 4B model** — Python-side guardrails compensate for occasional category errors and hallucinated skills
