# RESUME.md — Resume Tailoring Pipeline Specification
# Read this alongside PROJECT.md before building resume_tailor.py

---

## Critical Context — Why This File Exists

The previous resume generation approach (asking the LLM to generate raw HTML) failed in production:
- Prompt context leaked into resume output (duplicate headers, raw JSON field names rendered)
- LLM-generated HTML was inconsistent and broke layout unpredictably
- Model could not reliably produce self-contained HTML in one shot

**The fix: Separate template from content entirely.**
- The HTML template is hardcoded in Python — fixed structure, Jake's Resume style
- The LLM only produces structured JSON data (bullets, skills, selected experiences)
- Python injects JSON into template using string substitution
- The model never touches HTML. Ever.

---

## Quality Standard

The output PDF must match this standard:
- Reference: `ChyeZhiHao_Aumovio_AIWebApplication.pdf` (the good resume)
- Reference: `ChyeZhiHao_StoneX_Payments.pdf` (also good — finance variant)
- Failure mode: `resume_27aad6c1` (leaked context, broken structure — never produce this)

Visual requirements:
- Single column, no multi-column layouts
- Times New Roman serif font, 11px base
- Section headers: bold, uppercase, full-width bottom border
- Company/date on same line (flex space-between)
- Bullet points: 10px, line-height 1.4
- Fits exactly 1 page (A4)
- No color other than black/white/gray

---

## Candidate Fixed Data (never changes, never passed to LLM for formatting)

```python
CANDIDATE_FIXED = {
    "name": "Chye Zhi Hao",
    "contact_line": "+65 88952590 | desmondchye321@gmail.com | linkedin.com/in/chye-zhi-hao | github.com/BrownBOBAsushi",
    "education": [
        {
            "institution": "Singapore Institute of Technology",
            "location": "Singapore",
            "degree": "B.Sc. Applied Computing in Fintech",
            "date": "Expected June 2028",
            "notes": []
        },
        {
            "institution": "Singapore Polytechnic",
            "location": "Singapore",
            "degree": "Diploma in Mechatronics and Robotics Engineering",
            "date": "April 2023",
            "notes": [
                "Studied sensor systems, actuator control, and electromechanical integration across hardware-software environments."
            ]
        }
    ],
    "experience": [
        {
            "title": "PLIC Supplier Management Intern",
            "company": "ASM Assembly Systems Singapore Pte. Ltd.",
            "location": "Singapore",
            "date": "Sep 2022 – Feb 2023",
            # Bullets are rewritten by LLM per JD — these are the BASE versions
            "base_bullets": [
                "Reduced manual reporting time by 40% by automating KPI dashboards with Excel VBA, improving data accuracy across supplier performance workflows.",
                "Strengthened cross-functional collaboration by partnering with engineering and procurement teams to track quality metrics and surface defect trends early.",
                "Maintained clear technical documentation for recurring operational processes, ensuring consistent stakeholder alignment."
            ]
        }
    ]
}
```

> ASM internship bullets may be lightly reworded by the LLM to embed JD keywords,
> but the 40% metric and core facts must never be changed or omitted.

---

## Master Experience Pool (LLM selects from this — hardcoded, never modified by LLM)

```python
MASTER_PROJECTS = [
    {
        "id": "singhacks",
        "title": "Agentic AI System (ERC-8004 + X402)",
        "subtitle": "SingHacks 2025 — 3rd Place | Python, Hedera SDK",
        "date": "Nov 2025",
        "bullets": [
            "Built a working multi-agent system where AI agents autonomously transact on Hedera testnet, placing Top 3 out of all competing teams.",
            "Implemented identity authorization (ERC-8004 registry) and X402 micropayment flows with explicit security constraints, demonstrating production-aware agent design.",
            "Delivered a live technical demo to judges, communicating agent behaviour and system architecture clearly under time pressure."
        ],
        "tags": ["python", "ai", "agents", "blockchain", "hedera", "hackathon", "backend"]
    },
    {
        "id": "blitzjobz",
        "title": "BlitzJobz — AI Micro-Shift Marketplace",
        "subtitle": "Gemini 3 Hackathon | Python, Gemini API",
        "date": "Jan 2026",
        "bullets": [
            "Integrated Gemini 3 to generate AI-assisted SOPs for job checklists, improving task execution consistency via context engineering across variable shift types.",
            "Built a multimodal verification pipeline using before/after video analysis to score task completion against generated SOPs, reducing manual review overhead.",
            "Defined UAT-style acceptance criteria for matching logic and edge cases, enabling structured testing of AI-driven workflows."
        ],
        "tags": ["python", "ai", "llm", "gemini", "multimodal", "pipeline", "hackathon", "backend", "product"]
    },
    {
        "id": "ezbiz",
        "title": "EZBiz — Multi-Agent Orchestration Platform",
        "subtitle": "Hello Future Hackathon | Python, Gemini API",
        "date": "Jan 2026",
        "bullets": [
            "Designed a Plan/Execute/Monitor agentic loop where agents autonomously discover opportunities, execute listings, and adjust based on real-time feedback.",
            "Implemented verifiable agent authorisation using identity registry and micropayment concepts, ensuring trustworthy autonomous execution."
        ],
        "tags": ["python", "ai", "agents", "orchestration", "llm", "hackathon", "backend"]
    },
    {
        "id": "ragbot",
        "title": "Telegram RAG Bot",
        "subtitle": "Python, Gemini API, Qdrant, MongoDB",
        "date": "Mar 2026",
        "bullets": [
            "Built an end-to-end RAG pipeline integrating Qdrant vector search with MongoDB, enabling contextual document querying with reduced hallucination.",
            "Improved retrieval precision by tuning vector indexing parameters and configuring retrieval depth, demonstrating performance optimisation for LLM-integrated systems."
        ],
        "tags": ["python", "rag", "vector", "mongodb", "qdrant", "llm", "backend", "production"]
    },
    {
        "id": "ripplemart",
        "title": "Ripple Mart — NUS FinTech Summit 2026",
        "subtitle": "TypeScript, XRPL SDK, Node.js",
        "date": "2026",
        "bullets": [
            "Engineered a TypeScript-based platform with XRPL SDK integration, implementing automated escrow flows and merchant DID systems.",
            "Designed API integrations for transaction processing and merchant verification across the Ripple payment network."
        ],
        "tags": ["typescript", "blockchain", "xrpl", "nodejs", "fintech", "api", "backend"]
    },
    {
        "id": "stockanalysis",
        "title": "Stock Market Trend Analysis",
        "subtitle": "Python, pandas, NumPy, yfinance, Streamlit",
        "date": "Oct 2025",
        "bullets": [
            "Built an end-to-end financial data pipeline processing multi-year OHLCV data from Yahoo Finance, with automated cleaning, validation, and CSV export.",
            "Validated algorithmic outputs (SMA, daily returns, trend detection) against pandas rolling benchmarks using tolerance checks, ensuring correctness of all analytical results."
        ],
        "tags": ["python", "finance", "data", "pandas", "streamlit", "analysis", "quant"]
    },
    {
        "id": "cfa",
        "title": "CFA Institute Investing Simulator Challenge",
        "subtitle": "Top 10% Global",
        "date": "Dec 2025",
        "bullets": [
            "Ranked Top 10% globally by applying disciplined risk management, interpreting real-time economic signals, and managing portfolio exposure with explicit entry and exit rationale."
        ],
        "tags": ["finance", "investment", "risk", "portfolio", "quant"]
    },
    {
        "id": "hdb",
        "title": "HDB Resale Market Stratification Analysis",
        "subtitle": "R, ggplot2, Plotly",
        "date": "Jan 2026",
        "bullets": [
            "Processed 225,000+ HDB resale transactions to identify a $120k+ price gap widening between lease tiers post-2020, confirmed via Chow structural break testing and Kruskal-Wallis analysis (p < 0.05)."
        ],
        "tags": ["r", "data", "statistics", "analysis", "finance"]
    }
]
```

---

## Skills Pool (LLM selects subset per JD)

```python
SKILLS_POOL = {
    "Programming": ["Python", "TypeScript/JavaScript", "Java", "SQL", "R"],
    "AI / LLM": [
        "Gemini API", "context engineering", "prompt design", "RAG pipelines",
        "agentic orchestration", "multimodal analysis",
        "open-source models (Llama, Mistral)", "closed-source models (GPT-4, Gemini)"
    ],
    "Tools": ["Git", "Docker", "VS Code", "MongoDB", "Qdrant", "Supabase", "Figma", "Excel VBA"],
    "Frameworks": ["React.js", "Node.js", "Streamlit", "FastAPI"],
    "Blockchain": ["Hedera SDK", "XRPL SDK"],
    "Languages": ["English (Native)", "Chinese (Native)", "Malay (Professional)", "Japanese (N4)"]
}
```

---

## Two-Call Pipeline

### IMPORTANT: Call separation rules
- Call 1 uses `gemma4:e4b` — simple JSON, fast
- Call 2 uses `qwen2.5:14b` — complex JSON with rewritten bullets
- Never merge into one call
- Never pass HTML to the LLM
- Always validate JSON before proceeding to next step
- On parse failure: retry once, then mark generation_failed

---

### Call 1 — Gap Analysis + Project Selection

**Model:** `gemma4:e4b`
**JSON mode:** YES (`format: "json"`)

```python
CALL1_PROMPT = """You are a ruthlessly selective tech recruiter and resume strategist.

JOB DESCRIPTION:
{jd_text}

CANDIDATE SKILLS AND BACKGROUND:
- Python (primary), TypeScript/JavaScript, Java, SQL
- AI/LLM: Gemini API, RAG pipelines, agentic orchestration, multimodal analysis
- Tools: Git, Docker, MongoDB, Qdrant, Supabase, Excel VBA
- Year 1 Applied Computing in Fintech, SIT (graduating 2028)
- Diploma in Mechatronics & Robotics, Singapore Polytechnic (2023)
- 1 internship: ASM Assembly Systems — Excel VBA automation, supplier management

AVAILABLE PROJECTS (choose by id):
- singhacks: Multi-agent AI system on Hedera blockchain, Python, Top 3 SingHacks 2025
- blitzjobz: AI marketplace with multimodal verification pipeline, Gemini API, Jan 2026
- ezbiz: Multi-agent orchestration platform, Plan/Execute/Monitor loop, Jan 2026
- ragbot: Telegram RAG bot, Qdrant + MongoDB vector pipeline, Mar 2026
- ripplemart: TypeScript + XRPL SDK fintech platform, NUS FinTech Summit 2026
- stockanalysis: Financial data pipeline, Python + pandas + Streamlit, Oct 2025
- cfa: CFA Investing Simulator, Top 10% global, Dec 2025
- hdb: HDB resale market analysis, R + statistics, Jan 2026

Rules:
- Select EXACTLY 3 projects most relevant to this JD
- Do NOT select finance/quant projects (cfa, stockanalysis, hdb) unless JD explicitly requires finance
- Do NOT select blockchain projects (singhacks, ripplemart) unless JD explicitly requires blockchain/Web3
- For tech/AI/startup roles: prefer blitzjobz, ragbot, ezbiz, singhacks
- For finance roles: prefer cfa, stockanalysis, ripplemart, hdb

Respond in JSON only — no preamble, no explanation:
{
  "match_score": <0-100>,
  "missing_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "ats_flags": ["flag1", "flag2"],
  "selected_project_ids": ["id1", "id2", "id3"],
  "selected_skills": {
    "Programming": "comma-separated relevant languages",
    "AI / LLM": "comma-separated relevant AI tools",
    "Tools": "comma-separated relevant tools"
  },
  "asm_keywords_to_embed": ["keyword from JD to naturally embed in ASM bullets"]
}"""
```

---

### Call 2 — XYZ Bullet Rewrite

**Model:** `qwen2.5:14b`
**JSON mode:** YES (`format: "json"`)

```python
CALL2_PROMPT = """You are a professional resume writer. Rewrite experience bullets using Google XYZ formula.

Google XYZ formula: "Accomplished [X], as measured by [Y], by doing [Z]"

JOB DESCRIPTION CONTEXT:
{jd_text}

MISSING KEYWORDS TO EMBED NATURALLY: {missing_keywords}

ASM INTERNSHIP BASE BULLETS (rewrite to embed keywords where truthful):
1. Reduced manual reporting time by 40% by automating KPI dashboards with Excel VBA, improving data accuracy across supplier performance workflows.
2. Strengthened cross-functional collaboration by partnering with engineering and procurement teams to track quality metrics and surface defect trends early.
3. Maintained clear technical documentation for recurring operational processes, ensuring consistent stakeholder alignment.

SELECTED PROJECT BULLETS TO REWRITE:
{selected_project_bullets}

Rules:
- Keep the 40% metric in ASM bullet 1 exactly — never change it
- Keep "Top 3" in SingHacks bullet — never change it
- Do NOT invent new metrics not present in the original bullets
- Embed missing keywords naturally where truthful — do not force them
- Each bullet max 1 line, ~120 characters
- Use past tense, action verbs, no "I"
- Return ONLY JSON, no explanation

{
  "asm_bullets": ["rewritten bullet 1", "rewritten bullet 2", "rewritten bullet 3"],
  "project_bullets": {
    "project_id_1": ["rewritten bullet 1", "rewritten bullet 2"],
    "project_id_2": ["rewritten bullet 1", "rewritten bullet 2"],
    "project_id_3": ["rewritten bullet 1", "rewritten bullet 2"]
  }
}"""
```

---

## Python: Template Injection (NO LLM involvement)

```python
# resume_tailor.py — build_html() function
# The LLM never sees or generates HTML. Python handles all rendering.

import html as html_lib

def _escape(text: str) -> str:
    return html_lib.escape(str(text))

def build_education_block(education: list) -> str:
    blocks = []
    for edu in education:
        notes_html = ""
        if edu.get("notes"):
            items = "".join(f"<li>{_escape(n)}</li>" for n in edu["notes"])
            notes_html = f"<ul>{items}</ul>"
        blocks.append(f"""
        <div class="entry-header">
            <span class="entry-title">{_escape(edu['institution'])}</span>
            <span>{_escape(edu['location'])}</span>
        </div>
        <div class="entry-header">
            <span class="entry-subtitle">{_escape(edu['degree'])}</span>
            <span>{_escape(edu['date'])}</span>
        </div>
        {notes_html}
        """)
    return "\n".join(blocks)

def build_experience_block(title: str, company: str, location: str,
                            date: str, bullets: list) -> str:
    bullet_items = "".join(f"<li>{_escape(b)}</li>" for b in bullets)
    return f"""
    <div class="entry-header">
        <span class="entry-title">{_escape(company)}</span>
        <span>{_escape(location)}</span>
    </div>
    <div class="entry-header">
        <span class="entry-subtitle">{_escape(title)}</span>
        <span>{_escape(date)}</span>
    </div>
    <ul>{bullet_items}</ul>
    """

def build_project_block(title: str, subtitle: str, date: str, bullets: list) -> str:
    bullet_items = "".join(f"<li>{_escape(b)}</li>" for b in bullets)
    return f"""
    <div class="entry-header">
        <span class="entry-title">{_escape(title)}</span>
        <span>{_escape(date)}</span>
    </div>
    <div class="entry-subtitle">{_escape(subtitle)}</div>
    <ul>{bullet_items}</ul>
    """

def build_skills_block(skills: dict) -> str:
    rows = []
    for label, value in skills.items():
        if value:
            rows.append(
                f'<div class="skills-row">'
                f'<span class="skills-label">{_escape(label)}:</span> '
                f'{_escape(value)}'
                f'</div>'
            )
    return "\n".join(rows)

JAKE_RESUME_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Times New Roman', Times, serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 28px;
  }}
  h1 {{
    font-size: 22px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 3px;
    letter-spacing: 0.5px;
  }}
  .contact {{
    text-align: center;
    font-size: 10px;
    color: #333;
    margin-bottom: 6px;
  }}
  .contact a {{ color: #000; text-decoration: underline; }}
  .section-header {{
    font-size: 12px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1.2px solid #000;
    margin-top: 8px;
    margin-bottom: 4px;
    padding-bottom: 1px;
  }}
  .entry-header {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 10.5px;
    margin-bottom: 1px;
  }}
  .entry-title {{ font-weight: bold; }}
  .entry-subtitle {{
    font-style: italic;
    font-size: 10px;
    margin-bottom: 2px;
  }}
  ul {{
    padding-left: 14px;
    margin: 2px 0 5px 0;
  }}
  li {{
    font-size: 10px;
    line-height: 1.45;
    margin-bottom: 1.5px;
  }}
  .skills-row {{
    font-size: 10px;
    margin-bottom: 2px;
    line-height: 1.4;
  }}
  .skills-label {{ font-weight: bold; }}
  @page {{ size: A4; margin: 14mm 14mm 14mm 14mm; }}
</style>
</head>
<body>
  <h1>{name}</h1>
  <div class="contact">{contact_line}</div>

  <div class="section-header">Education</div>
  {education_block}

  <div class="section-header">Experience</div>
  {experience_block}

  <div class="section-header">Projects</div>
  {projects_block}

  <div class="section-header">Technical Skills</div>
  {skills_block}
</body>
</html>"""

def build_html(candidate_fixed: dict, call1_result: dict,
               call2_result: dict, project_pool: list) -> str:
    """
    Assembles the final HTML resume from fixed candidate data + LLM JSON outputs.
    No LLM involvement in this function — pure Python string assembly.
    """
    # Education — always fixed, never LLM-generated
    education_block = build_education_block(candidate_fixed["education"])

    # Experience — ASM always appears, bullets rewritten by Call 2
    asm = candidate_fixed["experience"][0]
    asm_bullets = call2_result["asm_bullets"]
    experience_block = build_experience_block(
        title=asm["title"],
        company=asm["company"],
        location=asm["location"],
        date=asm["date"],
        bullets=asm_bullets
    )

    # Projects — selected by Call 1, bullets rewritten by Call 2
    selected_ids = call1_result["selected_project_ids"]
    project_map = {p["id"]: p for p in project_pool}
    projects_block = ""
    for pid in selected_ids:
        project = project_map.get(pid)
        if not project:
            continue
        rewritten_bullets = call2_result["project_bullets"].get(pid, project["bullets"])
        projects_block += build_project_block(
            title=project["title"],
            subtitle=f"{project['subtitle']}",
            date=project["date"],
            bullets=rewritten_bullets
        )

    # Skills — selected by Call 1
    skills_block = build_skills_block(call1_result["selected_skills"])

    return JAKE_RESUME_HTML.format(
        name=_escape(candidate_fixed["name"]),
        contact_line=candidate_fixed["contact_line"],  # contains links — don't escape
        education_block=education_block,
        experience_block=experience_block,
        projects_block=projects_block,
        skills_block=skills_block
    )
```

---

## Full Pipeline Orchestration

```python
# resume_tailor.py — generate_resume() — the single entry point called by main.py

import json, os, time
from playwright.sync_api import sync_playwright

def generate_resume(job_id: str, jd_text: str, job_title: str, company: str) -> str:
    """
    Returns path to generated PDF.
    Raises RuntimeError on unrecoverable failure.
    """

    # --- CALL 1: Gap analysis + project selection (gemma4:e4b, fast) ---
    call1_raw = ollama_chat(
        model="gemma4:e4b",
        prompt=CALL1_PROMPT.format(jd_text=jd_text[:3000]),
        expect_json=True
    )
    call1 = parse_json_safe(call1_raw, required_keys=[
        "match_score", "missing_keywords", "selected_project_ids",
        "selected_skills", "asm_keywords_to_embed"
    ])
    if not call1:
        raise RuntimeError("Call 1 failed — could not parse gap analysis JSON")

    # Validate selected IDs exist in pool
    valid_ids = {p["id"] for p in MASTER_PROJECTS}
    call1["selected_project_ids"] = [
        pid for pid in call1["selected_project_ids"] if pid in valid_ids
    ][:3]  # Hard cap at 3

    if len(call1["selected_project_ids"]) == 0:
        raise RuntimeError("Call 1 returned no valid project IDs")

    # Build selected project bullets for Call 2 context
    project_map = {p["id"]: p for p in MASTER_PROJECTS}
    selected_bullets_text = ""
    for pid in call1["selected_project_ids"]:
        p = project_map[pid]
        bullets_str = "\n".join(f"  - {b}" for b in p["bullets"])
        selected_bullets_text += f"\n[{pid}] {p['title']}:\n{bullets_str}\n"

    time.sleep(1)  # Brief pause between model calls

    # --- CALL 2: XYZ bullet rewrite (qwen2.5:14b, slower but better) ---
    call2_raw = ollama_chat(
        model="qwen2.5:14b",
        prompt=CALL2_PROMPT.format(
            jd_text=jd_text[:2000],
            missing_keywords=", ".join(call1["missing_keywords"]),
            selected_project_bullets=selected_bullets_text
        ),
        expect_json=True
    )
    call2 = parse_json_safe(call2_raw, required_keys=["asm_bullets", "project_bullets"])
    if not call2:
        # Fallback: use original bullets without rewrite
        print(f"Call 2 failed for {job_id} — using original bullets as fallback")
        call2 = {
            "asm_bullets": CANDIDATE_FIXED["experience"][0]["base_bullets"],
            "project_bullets": {
                pid: project_map[pid]["bullets"]
                for pid in call1["selected_project_ids"]
            }
        }

    # --- BUILD HTML (pure Python, no LLM) ---
    html_content = build_html(
        candidate_fixed=CANDIDATE_FIXED,
        call1_result=call1,
        call2_result=call2,
        project_pool=MASTER_PROJECTS
    )

    # --- COMPILE PDF (Playwright) ---
    output_dir = os.path.join("generated_resumes", job_id)
    os.makedirs(output_dir, exist_ok=True)
    html_path = os.path.join(output_dir, "resume.html")
    pdf_path = os.path.join(output_dir, "resume.pdf")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"file:///{os.path.abspath(html_path).replace(os.sep, '/')}")
        page.wait_for_load_state("networkidle")
        page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "14mm", "bottom": "14mm", "left": "14mm", "right": "14mm"}
        )
        browser.close()

    if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) == 0:
        raise RuntimeError(f"Playwright failed to produce PDF for job {job_id}")

    return pdf_path


def parse_json_safe(raw: str, required_keys: list) -> dict | None:
    """Strip markdown fences, parse JSON, validate required keys."""
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip().rstrip("```").strip()
        data = json.loads(cleaned)
        missing = [k for k in required_keys if k not in data]
        if missing:
            print(f"JSON missing keys: {missing}")
            return None
        return data
    except Exception as e:
        print(f"JSON parse failed: {e}\nRaw (first 300 chars): {raw[:300]}")
        return None
```

---

## Project Selection Logic (enforce in Call 1 prompt + post-processing)

| JD Type | Select from | Avoid |
|---|---|---|
| Tech / AI / Startup | blitzjobz, ragbot, ezbiz, singhacks | cfa, stockanalysis, hdb |
| Fintech / Finance | ripplemart, cfa, stockanalysis, singhacks | hdb (too niche) |
| Data / Analytics | stockanalysis, ragbot, hdb | singhacks, ezbiz |
| Blockchain / Web3 | singhacks, ripplemart, ezbiz | stockanalysis, hdb |
| General engineering | blitzjobz, ragbot, ezbiz | cfa, hdb |

ASM internship: **always appears in Experience section regardless of JD type.**

---

## Failure Modes and Handling

| Failure | Handling |
|---|---|
| Call 1 JSON unparseable after 1 retry | Raise RuntimeError, mark generation_failed in DB |
| Call 1 returns invalid project IDs | Filter to valid IDs, if 0 remain → RuntimeError |
| Call 2 JSON unparseable | Use original base bullets from MASTER_PROJECTS as fallback — do NOT fail |
| Playwright PDF empty/missing | Raise RuntimeError, mark generation_failed in DB |
| Selected project IDs > 3 | Hard-cap at first 3 |
| ASM bullets missing from Call 2 | Fall back to CANDIDATE_FIXED base_bullets |

---

## What NOT to Do (Claude Code must never do these)

- Never pass HTML to the LLM
- Never ask the LLM to generate, modify, or format HTML
- Never let the LLM output the candidate name, contact info, or education directly
  (these are injected by Python from CANDIDATE_FIXED)
- Never trust LLM output for bullet metrics — validate that "40%" appears in ASM bullet 1
- Never render raw LLM output as resume content without JSON parsing first
- Never skip the parse_json_safe validation step
- Never use hardcoded forward slashes in file paths — always os.path.join()
- Never open files without encoding="utf-8" on Windows
