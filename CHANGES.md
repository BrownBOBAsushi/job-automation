# CHANGES.md — Decision Log

This file documents every architectural decision made during the PRD discussion,
including what was changed, why, and what was rejected.

---

## [v1.0] Initial PRD

**Date:** Session start

### Decisions made:
- Job scraping via **Apify** (paid actors for LinkedIn, Indeed, JobStreet, MyCareersFuture)
- LLM scoring via **Claude API**
- Output as **React dashboard**
- Manual pipeline trigger only
- **Vector similarity search** initially proposed for job matching

---

## [v1.1] Dropped vector search → Claude API scoring

### What changed:
Replaced vector similarity search with direct Claude API scoring per JD.

### Why:
Vector search finds roles with *similar language* to the resume — not semantic fit.
A role could be a perfect match but use completely different vocabulary.
Claude API scoring provides actual judgment, not surface-level text similarity.
Cost at 50 JDs/run: ~$0.10–0.15. Not worth adding vector DB complexity.

---

## [v1.2] Switched LLM from Claude → Groq (then reverted)

### What changed:
Temporarily switched scoring model to Groq (`llama-3.3-70b-versatile`) for free tier.

### Why it was switched:
User wanted free tier option to avoid API costs.

### Why it was reverted:
User confirmed they have an Anthropic API key.
Claude API was restored as the LLM for both scoring and resume tailoring.
Claude's instruction-following reliability is meaningfully better than Llama for
structured JSON output — fewer parse failures, better scoring consistency.

### Final decision:
**Claude API (`claude-sonnet-4-20250514`)** for all LLM calls.

---

## [v1.3] Added drag-and-drop .docx resume upload

### What changed:
Added `resume_converter.py` backend module and `ResumeUploader.jsx` frontend component.

### Why:
User regularly updates their master resume. Manual file replacement is error-prone.
Drag-and-drop .docx → auto-converts to `master_resume.md` via `python-docx` + `markdownify`.
Pipeline always reads fresh from disk — resume updates take effect on next run without restart.

### Implementation:
- Backend: `POST /resume/upload` → python-docx extracts text → markdownify converts → overwrites master_resume.md
- Frontend: drag-and-drop zone, success toast with last-updated timestamp
- No pandoc — requires system binary, harder to deploy on Windows

---

## [v1.4] Added resume tailoring pipeline (Jake's Resume + LaTeX)

### What changed:
Added Pipeline B: on-demand per-role resume tailoring triggered by "Generate Resume" button.
Outputs a downloadable PDF compiled server-side from LaTeX.

### Why:
ELZOS (senior's tool) has no resume tailoring. This is a core differentiator.
Overleaf API does not exist publicly — compile LaTeX locally instead.

### Architecture:
Three sequential Claude API calls per job (never merged — each feeds the next):
1. Gap analysis + ATS audit → match score, missing keywords, ATS flags
2. Experience selection + XYZ rewrite → select 3-4 experiences, rewrite bullets
3. LaTeX generation → complete `main.tex` using Jake's Resume template

Compiled via `pdflatex` (MiKTeX on Windows). PDF served via `GET /resume/download/{job_id}`.

### Trigger:
"Generate Resume" button on each job card — not auto-triggered on status change.

### Output:
Downloadable PDF only (not raw .tex, not Overleaf link).

### New table added:
`resume_outputs` — stores match_score, missing_keywords, ats_flags, latex_path, pdf_path.

---

## [v1.5] Windows compatibility fixes

### What changed:
All file path handling updated to use `os.path.join()` throughout `resume_tailor.py`.
All file writes updated to use `encoding="utf-8"`.

### Why:
User is on Windows. Hardcoded `/` separators break on Windows.
UTF-8 encoding is required on Windows to avoid codec errors with special characters in resumes.

### MiKTeX setup (Windows):
- Download from https://miktex.org/download
- Install for all users, set missing packages to auto-install
- Verify: `pdflatex --version` in a new Command Prompt
- `winget` not available on user's machine — direct installer required

---

## [v1.6] Dropped Apify → JobSpy

### What changed:
Replaced Apify entirely with `python-jobspy` (`pip install python-jobspy`).

### Why Apify was dropped:
- Free tier fragile in practice — actors failed during testing
- LinkedIn actor requires `li_at` session cookie which expires frequently
- Adds unnecessary complexity and account dependency for a personal tool

### Why JobSpy:
- Pure Python, no API key, no account
- Scrapes LinkedIn + Indeed in one call
- Returns clean pandas DataFrame
- Fits the stack perfectly
- Cost: free

### Acknowledged risk:
JobSpy breaks if LinkedIn/Indeed change their HTML structure.
Acceptable for a personal tool — fix it when it breaks.

---

## [v1.7] Full PRD rewrite — pivot to Personal Internship Intelligence System

### What changed:
Complete rewrite of PROJECT.md. Scope clarified and expanded based on reference to
senior's tool ELZOS and user's actual goal (internship hunting, not generic job search).

### Key additions:
- Internship-specific filters: stipend range, duration, work arrangement, job type
- Kanban tracker: Saved → Applied → Interviewing → Offer (drag-and-drop via @dnd-kit/core)
- 3-page React app: Jobs / Applications / Settings
- Dark mode default, Linear/Raycast aesthetic — explicitly better than ELZOS
- Keyword search (client-side, instant)
- Settings page with editable scrape keyword list

### Kanban library decision:
`@dnd-kit/core` — react-beautiful-dnd is unmaintained, do not use.

### Scoring note added:
Claude scoring prompt explicitly instructed to be ruthlessly honest —
Year 1 student competing against more experienced candidates.
Score of 7+ means genuinely strong fit, not inflated.

---

## [v1.8] LinkedIn MCP investigation → dropped

### What was investigated:
User's senior (ELZOS) used "LinkedIn Connected via MCP". Investigated whether
an official LinkedIn MCP existed for stable job scraping.

### Finding:
No official LinkedIn MCP from Anthropic or LinkedIn exists.
All LinkedIn MCP servers (e.g. `stickerdaniel/linkedin-mcp-server`) are third-party
and still rely on `li_at` session cookie + headless browser (Docker).
This is the same fragility problem we tried to avoid by dropping Apify.

### Decision:
**LinkedIn MCP dropped entirely for v1.**
The complexity (Docker + cookie management + captcha handling) is not worth it
for a personal internship tool targeting Singapore roles.

---

## [v1.9] Final scraping stack — MCF + JobSpy

### What changed:
Replaced LinkedIn MCP with MyCareersFuture (MCF) public API as primary source.
Indeed via JobSpy retained as secondary source.

### Why MCF:
- Singapore government job portal — legal requirement for companies 10+ headcount
  to post before hiring foreigners → most comprehensive local internship listings
- Public REST API, no auth, no cookie, no scraping
- Endpoint: `GET https://api.mycareersfuture.gov.sg/v2/jobs?search={keyword}&limit=100&page=0`
- Returns structured JSON with salary, location, employment type
- No rate limit issues for personal use volume
- Community-verified working (gabrielchua/mcf-jobs on GitHub)

### Why not LinkedIn for v1:
Every approach to LinkedIn scraping (Apify, MCP, JobSpy) eventually hits
the same wall: session cookies, captchas, ToS risk. MCF + Indeed covers
Singapore internships more comprehensively anyway.

### Final source stack:
| Source | Method | Auth needed | Stability |
|---|---|---|---|
| MyCareersFuture | Direct REST API call | None | High |
| Indeed | JobSpy (`python-jobspy`) | None | Medium |

### Environment variables — final list:
```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```
No Apify token. No LinkedIn cookie. No MCP config.

---

## Summary — What was rejected and why

| Rejected | Reason |
|---|---|
| Vector similarity search | Finds similar language, not actual fit — Claude judgment is better |
| Groq API | Reverted — user has Anthropic key, Claude is more reliable |
| Apify | Fragile free tier, cookie-dependent LinkedIn actor |
| Overleaf API | Does not exist publicly |
| LinkedIn MCP | Third-party only, still requires `li_at` cookie + Docker |
| LinkedIn via JobSpy | Same fragility as MCP — deprioritised for v1 |
| pandoc for .docx parsing | Requires system binary — harder to deploy |
| react-beautiful-dnd | Unmaintained — replaced with @dnd-kit/core |
| Hardcoded `/` file paths | Breaks on Windows — replaced with os.path.join() |
| Single large tailoring prompt | LLM output quality degrades — split into 3 sequential calls |
| Parallel scoring calls | Claude rate limits + unnecessary complexity — sequential is fine |

---

## v2 Backlog (deferred, not rejected)

- LinkedIn scraping (revisit when Docker setup is stable)
- JobStreet integration
- Cover letter generation per role
- Interview prep questions per role
- Scheduled/cron pipeline runs
- Browser extension to manually add jobs from any board
- Email digest of top new roles
