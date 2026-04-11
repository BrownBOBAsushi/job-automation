# Internship Intelligence System

A personal job intelligence system for internship hunting in Singapore. Scrapes listings from MyCareersFuture and Indeed, scores every role against your master resume using Claude AI, and surfaces a ranked shortlist via a polished dark-mode dashboard. For roles you're keen on, one click triggers an automated resume tailoring pipeline — generating an ATS-optimised, LaTeX-compiled PDF.

---

## Features

- **Job aggregation** — MyCareersFuture public API (primary) + Indeed via JobSpy (fallback)
- **AI fit scoring** — Claude evaluates every JD against your resume: fit score 1–10, matched skills, gaps, and a recommendation (Apply / Maybe / Skip)
- **On-demand resume tailoring** — 3-step Claude pipeline rewrites bullets for the specific role and compiles a PDF via pdflatex (Jake's Resume template)
- **Kanban tracker** — drag-and-drop pipeline: Saved → Applied → Interviewing → Offer
- **Internship-specific filters** — stipend range, duration, work arrangement, job type, platform
- **Resume upload** — drag-and-drop `.docx` → auto-converts to markdown, used by every pipeline run

---

## Tech Stack

| Layer | Tool |
|---|---|
| Job sources | MyCareersFuture REST API, Indeed (JobSpy) |
| Backend | Python + FastAPI |
| LLM | Claude API (`claude-sonnet-4-20250514`) |
| PDF compiler | MiKTeX / pdflatex (Windows) |
| Database | Supabase (PostgreSQL) |
| Frontend | React + Vite + TailwindCSS |

---

## Prerequisites

### 1. MiKTeX (Windows — required for PDF generation)

1. Download from [miktex.org/download](https://miktex.org/download)
2. Run installer → "Install for all users" → set missing packages to **Yes (auto-install)**
3. Open a **new** Command Prompt and verify:
   ```
   pdflatex --version
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

### 1. Clone and configure environment variables

Create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=your_anthropic_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

No other keys required. MyCareersFuture needs no auth. JobSpy needs no API key.

### 2. Set up Supabase

Run the following SQL in your Supabase SQL editor:

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

### 3. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
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

### Run the job pipeline

1. Go to **Jobs** page
2. Click **Run Pipeline**
3. The backend scrapes MyCareersFuture + Indeed, deduplicates, then scores every new job against your resume
4. The dashboard re-renders with jobs ranked by fit score

### Filter and search

- Keyword search (client-side, instant) across title, company, and JD text
- Filter by: platform, fit score, recommendation, work arrangement, job type, duration, stipend range

### Generate a tailored resume

1. Click a job card to expand it
2. Click **Generate Resume**
3. The system runs 3 sequential Claude calls:
   - **Call 1** — gap analysis + ATS audit (match score, missing keywords, ATS flags)
   - **Call 2** — experience selection + XYZ bullet rewrite
   - **Call 3** — full LaTeX generation using Jake's Resume template
4. pdflatex compiles the `.tex` file (runs twice for correct layout)
5. Click **Download PDF** when the status shows done

### Track applications

Go to **Applications** page to manage your pipeline with drag-and-drop Kanban:
- Saved → Applied → Interviewing → Offer

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
[Deduplicate by URL → insert new jobs to Supabase]
        ↓
[For each unscored job → Claude API scoring call]
        ↓
[Scores written to Supabase → dashboard re-renders]
```

POST `/pipeline/run` returns **202 Accepted** immediately. The actual scrape + score runs as a background thread. Frontend polls `/pipeline/status`.

### Pipeline B — Resume Tailoring

```
[User clicks "Generate Resume" on a job card]
        ↓
[POST /resume/generate/{job_id}]
        ↓
[Call 1: gap analysis + ATS audit → match_score, missing_keywords, ats_flags]
        ↓
[Call 2: experience selection + XYZ rewrite → selected_experiences, skills]
        ↓
[Call 3: full main.tex generation (Jake's Resume template)]
        ↓
[pdflatex compiles main.tex → main.pdf (two passes)]
        ↓
[GET /resume/download/{job_id} → streams PDF]
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/pipeline/run` | Trigger scrape + score (202, background task) |
| GET | `/pipeline/status` | `idle / scraping / scoring / done / error` |
| GET | `/jobs` | All scored jobs. Query params: `min_score`, `platform`, `arrangement`, `job_type`, `search` |
| GET | `/jobs/{id}` | Single job detail |
| PATCH | `/jobs/{id}/status` | Update kanban status (`saved / applied / interviewing / offer`) |
| DELETE | `/jobs/clear` | Delete all jobs |
| POST | `/resume/upload` | Upload `.docx` → converts to `master_resume.md` |
| GET | `/resume` | Return current `master_resume.md` content |
| POST | `/resume/generate/{job_id}` | Trigger 3-step tailoring pipeline |
| GET | `/resume/status/{job_id}` | `pending / generating / done / failed` |
| GET | `/resume/download/{job_id}` | Stream PDF for download |

---

## File Structure

```
internship-tracker/
├── backend/
│   ├── main.py                  # FastAPI app + all endpoints
│   ├── scraper.py               # MCF API + JobSpy Indeed fallback
│   ├── scorer.py                # Claude API scoring with JSON parsing
│   ├── resume_tailor.py         # 3-step Claude tailoring + pdflatex
│   ├── resume_converter.py      # .docx → markdown (python-docx + markdownify)
│   ├── db.py                    # Supabase client + CRUD helpers
│   ├── master_resume.md         # Auto-generated from .docx upload
│   ├── generated_resumes/       # {job_id}/main.tex + main.pdf
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── JobList.jsx
│   │   │   ├── JobCard.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── SearchBar.jsx
│   │   │   ├── KanbanBoard.jsx
│   │   │   ├── PipelineButton.jsx
│   │   │   ├── ResumeUploader.jsx
│   │   │   ├── ResumeGenerator.jsx
│   │   │   └── StatusBadge.jsx
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

## Scoring Logic

Claude is instructed to score **ruthlessly honestly** — not optimistically. The candidate is a Year 1 university student competing against more experienced candidates.

| Score | Meaning |
|---|---|
| 8–10 | Strong fit — most requirements met, apply immediately |
| 5–7 | Partial fit — worth reviewing, 1–2 key gaps |
| 1–4 | Weak fit — significant gaps, skip unless target company |

---

## Known Constraints

- **Pipeline is manual trigger only** — no scheduled/cron runs
- **JobSpy can break** if Indeed changes their HTML structure — acceptable for a personal tool
- **MiKTeX first run is slow** — it auto-downloads missing LaTeX packages on first compile; subsequent runs are fast
- **Claude scoring calls are sequential** — never parallelised; `time.sleep(1)` between calls to respect rate limits
- **JDs under 100 characters are skipped** — marked `scoring_failed=true`

---

## v2 Ideas

- Cover letter generation per role
- Interview prep questions per role
- Scheduled pipeline runs
- JobStreet integration
- Browser extension to manually add jobs from any board
- Email digest of top new roles
