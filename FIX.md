# FIX.md — Post-Review Fixes for Claude Code
# Read alongside PROJECT.md and RESUME.md before making any changes.
# Apply fixes in priority order. Do not skip ahead.

---

## Context

This file documents specific fixes to apply to the existing codebase at
https://github.com/BrownBOBAsushi/job-automation

All fixes are based on code review of the four backend files:
- backend/resume_tailor.py
- backend/scorer.py
- backend/scraper.py
- backend/main.py

---

## Fix Priority Order

1. Python-side project category filtering (resume_tailor.py)
2. JD requirements extraction before truncation (scorer.py + resume_tailor.py)
3. Skills pool validation (resume_tailor.py)
4. Evaluation warnings stored in DB + surfaced in UI (resume_tailor.py + db.py + frontend)
5. Prompt wording fix: "AT LEAST 3" → "EXACTLY 3" (resume_tailor.py)
6. Resume truncation priority fix (scorer.py)

---

## Fix 1 — Python-side Project Category Filtering

**File:** `backend/resume_tailor.py`
**Problem:** `gemma4:e4b` occasionally selects finance projects (cfa, stockanalysis, hdb)
for tech/startup JDs and blockchain projects for non-Web3 JDs. The prompt rules alone
are not reliable enough with a 4B model.
**Solution:** Post-process Call 1 output in Python — filter invalid categories,
then backfill to 3 if needed.

### Add these constants near the top of resume_tailor.py (after MASTER_PROJECTS):

```python
# Project category classification — used for Python-side filtering
FINANCE_ONLY_IDS = {"cfa", "stockanalysis", "hdb"}
BLOCKCHAIN_ONLY_IDS = {"singhacks", "ripplemart"}
DEFAULT_TECH_IDS = ["blitzjobz", "ragbot", "ezbiz"]  # safe fallback for any tech JD


def _is_finance_jd(jd_text: str) -> bool:
    """True if JD explicitly requires finance/quant skills."""
    finance_terms = [
        "portfolio", "equity", "trading", "quant", "investment",
        "financial analyst", "asset management", "hedge fund", "fixed income",
        "derivatives", "bloomberg", "valuation"
    ]
    jd_lower = jd_text.lower()
    return sum(1 for t in finance_terms if t in jd_lower) >= 2


def _is_blockchain_jd(jd_text: str) -> bool:
    """True if JD explicitly requires blockchain/Web3 skills."""
    web3_terms = [
        "blockchain", "web3", "smart contract", "defi", "token",
        "crypto", "solidity", "ethereum", "nft", "dao", "on-chain"
    ]
    jd_lower = jd_text.lower()
    return sum(1 for t in web3_terms if t in jd_lower) >= 2


def _filter_and_fill_project_ids(selected_ids: list, jd_text: str) -> list:
    """
    Post-process Call 1 project selection:
    1. Remove category mismatches
    2. Backfill to 3 from safe defaults if needed
    3. Hard cap at 3
    """
    filtered = list(selected_ids)

    if not _is_finance_jd(jd_text):
        filtered = [pid for pid in filtered if pid not in FINANCE_ONLY_IDS]

    if not _is_blockchain_jd(jd_text):
        filtered = [pid for pid in filtered if pid not in BLOCKCHAIN_ONLY_IDS]

    # Backfill from safe defaults if we dropped below 3
    for pid in DEFAULT_TECH_IDS:
        if len(filtered) >= 3:
            break
        if pid not in filtered:
            filtered.append(pid)

    return filtered[:3]
```

### In generate_resume(), replace the existing ID validation block:

**Find this block (around line where selected_project_ids is validated):**
```python
# Validate and cap selected project IDs
valid_ids = set(_PROJECT_MAP.keys())
call1["selected_project_ids"] = [
    pid for pid in call1["selected_project_ids"] if pid in valid_ids
][:3]
if not call1["selected_project_ids"]:
    raise RuntimeError("Call 1 returned no valid project IDs")
```

**Replace with:**
```python
# Validate against known pool
valid_ids = set(_PROJECT_MAP.keys())
raw_ids = [pid for pid in call1["selected_project_ids"] if pid in valid_ids]

# Apply category filtering + backfill
call1["selected_project_ids"] = _filter_and_fill_project_ids(raw_ids, jd_text)

if not call1["selected_project_ids"]:
    raise RuntimeError("Call 1 returned no valid project IDs after filtering")
```

---

## Fix 2 — JD Requirements Extraction Before Truncation

**Files:** `backend/scorer.py` AND `backend/resume_tailor.py`
**Problem:** MCF JDs start with company blurb and "About Us" — useful context is often
in the second half (Requirements, What We're Looking For). Hard truncation at 3000
chars cuts exactly the signal the model needs.
**Solution:** Extract the requirements/responsibilities section first, then truncate.

### Add this function to BOTH scorer.py and resume_tailor.py:

```python
import re

def _extract_jd_signal(jd_text: str, max_chars: int = 3000) -> str:
    """
    Extract the requirements/responsibilities section from a JD.
    Falls back to full text if no section markers found.
    Truncates to max_chars after extraction.
    """
    # Common section headers that signal the useful part of the JD
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
        if match and match.start() > 100:  # ignore if at very start (company name)
            extracted = jd_text[match.start():]
            return extracted[:max_chars]

    # No section found — return from beginning but still truncate
    return jd_text[:max_chars]
```

### In scorer.py, update score_job():

**Find:**
```python
prompt = SCORING_PROMPT.format(
    master_resume=master_resume[:2000],
    jd_text=jd_text[:3000],
)
```

**Replace with:**
```python
prompt = SCORING_PROMPT.format(
    master_resume=master_resume[:3000],   # resume is static signal — give it more room
    jd_text=_extract_jd_signal(jd_text, max_chars=2500),
)
```

> Note: master_resume truncation was swapped — the JD is the variable signal and should
> be extracted intelligently. The resume is fixed and should be fully included.
> 3000 chars covers the full resume text from a typical .docx upload.

### In resume_tailor.py, update generate_resume() Call 1:

**Find:**
```python
call1_raw = _ollama_chat(
    model="gemma4:e4b",
    prompt=CALL1_PROMPT.format(jd_text=jd_text[:3000]),
    expect_json=True,
)
```

**Replace with:**
```python
call1_raw = _ollama_chat(
    model="gemma4:e4b",
    prompt=CALL1_PROMPT.format(jd_text=_extract_jd_signal(jd_text, max_chars=2500)),
    expect_json=True,
)
```

### In resume_tailor.py, update Call 2:

**Find:**
```python
prompt=CALL2_PROMPT.format(
    jd_text=jd_text[:2000],
    ...
)
```

**Replace with:**
```python
prompt=CALL2_PROMPT.format(
    jd_text=_extract_jd_signal(jd_text, max_chars=1500),
    ...
)
```

---

## Fix 3 — Skills Pool Validation

**File:** `backend/resume_tailor.py`
**Problem:** `gemma4:e4b` can hallucinate skills not in the candidate's actual pool
(e.g. "Kubernetes", "Rust", "TensorFlow"). These appear on the resume unchecked.
**Solution:** After Call 1, filter selected_skills against the known SKILLS_POOL.

### Add SKILLS_POOL constant near the top of resume_tailor.py (after MASTER_PROJECTS):

```python
SKILLS_POOL = {
    "Technical": [
        "Python", "TypeScript", "JavaScript", "TypeScript/JavaScript",
        "Java", "SQL", "R", "Streamlit", "React.js", "Node.js", "FastAPI"
    ],
    "AI / LLM": [
        "Gemini API", "RAG pipelines", "Qdrant", "MongoDB",
        "agentic orchestration", "multimodal analysis", "prompt engineering",
        "context engineering", "vector databases", "LangChain",
        "open-source models", "Llama", "Mistral"
    ],
    "Tools": [
        "Git", "Docker", "Supabase", "Excel VBA", "Figma",
        "VS Code", "REST APIs", "MongoDB", "Qdrant"
    ],
    "Languages": [
        "English (Native)", "Chinese (Native)",
        "Malay (Professional)", "Japanese (N4)"
    ],
}


def _validate_skills(selected_skills: dict) -> dict:
    """
    Filter selected_skills to only include items present in SKILLS_POOL.
    Logs any hallucinated skills that were removed.
    Languages category is always preserved as-is (fixed value).
    """
    validated = {}
    for category, value in selected_skills.items():
        if category == "Languages":
            # Always use canonical languages string — never trust model output here
            validated[category] = "English (Native), Chinese (Native), Malay (Professional), Japanese (N4)"
            continue

        pool = SKILLS_POOL.get(category, [])
        if not pool:
            # Unknown category from model — skip it
            print(f"Skills validation: unknown category '{category}' — skipping")
            continue

        raw_items = [s.strip() for s in value.split(",") if s.strip()]
        pool_lower = [p.lower() for p in pool]

        valid_items = []
        for item in raw_items:
            if any(item.lower() in p or p in item.lower() for p in pool_lower):
                valid_items.append(item)
            else:
                print(f"Skills validation: removed hallucinated skill '{item}' from '{category}'")

        if valid_items:
            validated[category] = ", ".join(valid_items)

    # Ensure Languages always present
    if "Languages" not in validated:
        validated["Languages"] = "English (Native), Chinese (Native), Malay (Professional), Japanese (N4)"

    return validated
```

### In generate_resume(), after Call 1 validation, add:

```python
# Validate skills against known pool — remove hallucinated entries
call1["selected_skills"] = _validate_skills(call1.get("selected_skills", {}))
```

Add this line immediately after the `_filter_and_fill_project_ids` call from Fix 1.

---

## Fix 4 — Evaluation Warnings

**Files:** `backend/resume_tailor.py`, `backend/db.py`, frontend job detail panel
**Problem:** No automated checks run after generation. You only find out something
went wrong by manually inspecting the PDF.
**Solution:** Run deterministic checks after HTML build, store warnings in DB,
surface them in the frontend next to the Download PDF button.

### Add _evaluate_resume() to resume_tailor.py:

```python
def _evaluate_resume(html_content: str, call1: dict, call2: dict) -> list[str]:
    """
    Deterministic post-generation checks. Returns list of warning strings.
    Empty list = all checks passed.
    These checks do not use the LLM — purely string matching.
    """
    warnings = []

    # Check 1: ASM 40% metric preserved
    asm_bullets = call2.get("asm_bullets", [])
    if asm_bullets and "40%" not in asm_bullets[0]:
        warnings.append("40% metric missing from ASM bullet — original restored automatically")

    # Check 2: All selected projects rendered in HTML
    selected_ids = call1.get("selected_project_ids", [])
    for pid in selected_ids:
        project = _PROJECT_MAP.get(pid)
        if project:
            # Check first 20 chars of project title appear in HTML
            title_fragment = project["title"][:20]
            if title_fragment not in html_content:
                warnings.append(f"Project '{pid}' ({title_fragment}...) may not have rendered")

    # Check 3: At least one missing keyword embedded somewhere in the HTML
    missing_kws = call1.get("missing_keywords", [])
    if missing_kws:
        embedded = sum(1 for kw in missing_kws if kw.lower() in html_content.lower())
        if embedded == 0:
            warnings.append(
                f"None of the {len(missing_kws)} missing keywords were embedded "
                f"({', '.join(missing_kws[:3])}{'...' if len(missing_kws) > 3 else ''})"
            )

    # Check 4: SingHacks "Top 3" metric preserved (if singhacks selected)
    if "singhacks" in selected_ids:
        singhacks_bullets = call2.get("project_bullets", {}).get("singhacks", [])
        if singhacks_bullets and "Top 3" not in " ".join(singhacks_bullets):
            warnings.append("SingHacks 'Top 3' metric missing from rewritten bullets")

    return warnings
```

### In generate_resume(), call _evaluate_resume() after _build_html():

**Find:**
```python
# ── Build HTML (pure Python — no LLM) ──────────────────────────────────────
html_content = _build_html(call1, call2)

# ── Compile PDF (sync Playwright) ───────────────────────────────────────────
pdf_path = _compile_pdf(html_content, job_id)
```

**Replace with:**
```python
# ── Build HTML (pure Python — no LLM) ──────────────────────────────────────
html_content = _build_html(call1, call2)

# ── Run evaluation checks ───────────────────────────────────────────────────
eval_warnings = _evaluate_resume(html_content, call1, call2)
if eval_warnings:
    print(f"Resume eval warnings for {job_id}:")
    for w in eval_warnings:
        print(f"  ⚠ {w}")

# ── Compile PDF (sync Playwright) ───────────────────────────────────────────
pdf_path = _compile_pdf(html_content, job_id)
```

### Update the record dict at the end of generate_resume():

**Find:**
```python
record = {
    "job_id": job_id,
    "match_score": call1.get("match_score", 0),
    "missing_keywords": call1.get("missing_keywords", []),
    "ats_flags": call1.get("ats_flags", []),
    "html_path": html_path,
    "pdf_path": pdf_path,
    "generation_failed": 0,
}
```

**Replace with:**
```python
record = {
    "job_id": job_id,
    "match_score": call1.get("match_score", 0),
    "missing_keywords": call1.get("missing_keywords", []),
    "ats_flags": call1.get("ats_flags", []),
    "eval_warnings": eval_warnings,          # NEW
    "html_path": html_path,
    "pdf_path": pdf_path,
    "generation_failed": 0,
}
```

### Update db.py — add eval_warnings column to resume_outputs table:

In `db.py`, find the `resume_outputs` table creation and add the column:

```python
# In init_db() SQL, find the resume_outputs CREATE TABLE and add:
eval_warnings TEXT DEFAULT '[]',   -- JSON array of warning strings
```

Also update `upsert_resume_output()` to include `eval_warnings` in the INSERT/UPDATE.
Store it as `json.dumps(record.get("eval_warnings", []))`.

When reading back with `get_resume_output()`, parse it:
```python
if "eval_warnings" in row and isinstance(row["eval_warnings"], str):
    row["eval_warnings"] = json.loads(row["eval_warnings"])
```

### Frontend — show warnings in ResumeGenerator component:

In `ResumeGenerator.jsx` (or wherever the Download PDF button renders after generation),
after the download button, add a warnings display:

```jsx
{output?.eval_warnings?.length > 0 && (
  <div className="mt-2 space-y-1">
    {output.eval_warnings.map((warning, i) => (
      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
        <span>⚠</span>
        <span>{warning}</span>
      </div>
    ))}
  </div>
)}
```

Show warnings below the Download PDF button in amber/yellow — visible but not alarming.
Do not block download on warnings — they are informational only.

---

## Fix 5 — Prompt Wording: "AT LEAST 3" → "EXACTLY 3"

**File:** `backend/resume_tailor.py`
**Problem:** "AT LEAST 3" causes the model to sometimes return 4–6 IDs.
Python then takes `[:3]` — the first 3 in whatever order, not the best 3.
**Solution:** Tell the model exactly what you want.

**Find in CALL1_PROMPT:**
```
- Select AT LEAST 3 projects most relevant to this JD
```

**Replace with:**
```
- Select EXACTLY 3 projects most relevant to this JD, ranked by relevance (most relevant first)
```

The `[:3]` cap in Python stays — now it takes the model's top 3 by its own ranking.

---

## Fix 6 — Resume Truncation Priority

**File:** `backend/scorer.py`
**Problem:** `master_resume[:2000]` truncates the resume. The resume is the static
reference signal — it should not be the thing you cut. The JD is the variable input.
This was already addressed in Fix 2 (swap to master_resume[:3000]) but documenting
explicitly here for clarity.

**Find in score_job():**
```python
prompt = SCORING_PROMPT.format(
    master_resume=master_resume[:2000],  # cap resume; JD is the scoring signal
    jd_text=jd_text[:3000],
)
```

**Replace with (same as Fix 2 — confirm both changes are applied together):**
```python
prompt = SCORING_PROMPT.format(
    master_resume=master_resume[:3000],
    jd_text=_extract_jd_signal(jd_text, max_chars=2500),
)
```

---

## Summary of All File Changes

| File | Changes |
|---|---|
| `backend/resume_tailor.py` | Add: `FINANCE_ONLY_IDS`, `BLOCKCHAIN_ONLY_IDS`, `DEFAULT_TECH_IDS`, `_is_finance_jd()`, `_is_blockchain_jd()`, `_filter_and_fill_project_ids()`, `SKILLS_POOL`, `_validate_skills()`, `_extract_jd_signal()`, `_evaluate_resume()`. Update: `generate_resume()` to call all new functions. Update: `CALL1_PROMPT` wording. |
| `backend/scorer.py` | Add: `_extract_jd_signal()`. Update: `score_job()` truncation logic. |
| `backend/db.py` | Add: `eval_warnings TEXT` column to `resume_outputs`. Update: `upsert_resume_output()` and `get_resume_output()` to handle `eval_warnings`. |
| `frontend/.../ResumeGenerator.jsx` | Add: warnings display below Download PDF button. |

---

## Testing After Applying Fixes

### Test Fix 1 (category filtering):
Trigger resume generation for a tech/startup JD (e.g. Valsea). Verify in logs that
`cfa`, `stockanalysis`, `hdb` do NOT appear in selected_project_ids.
Trigger for a finance JD. Verify `cfa` or `stockanalysis` DO appear.

### Test Fix 2 (JD extraction):
Add a print statement in `_extract_jd_signal()` logging which section was matched.
Run pipeline on a few MCF jobs. Confirm requirements sections are being extracted.

### Test Fix 3 (skills validation):
Temporarily inject a fake skill into CALL1_PROMPT response (manually edit the raw
response in a test). Confirm it gets filtered by `_validate_skills()` and the warning
logs correctly.

### Test Fix 4 (eval warnings):
Generate a resume. Check `db.get_resume_output()` includes `eval_warnings` field.
Check frontend shows warnings if any exist.

### Test Fix 5 (prompt wording):
Generate a resume and print `call1["selected_project_ids"]` before the `[:3]` cap.
Confirm model returns exactly 3, not 4 or 5.

---

## Do NOT Change

- The `_build_html()` function and `_JAKE_HTML` template — these are working correctly
- The Playwright PDF compilation flow — working correctly
- The `_parse_json_safe()` function — working correctly
- The fallback to base_bullets when Call 2 fails — working correctly
- The MCF scraper field mapping — verified against live API, correct
- The `time.sleep(1)` between Ollama calls — keep this
- All `os.path.join()` usage — correct Windows path handling throughout
