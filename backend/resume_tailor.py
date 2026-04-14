import html as html_lib
import json
import os
import subprocess
import sys
import time

import requests

import db

OLLAMA_BASE = "http://localhost:11434"

# ── Candidate fixed data (never passed to LLM for formatting) ──────────────────

CANDIDATE_FIXED = {
    "name": "Chye Zhi Hao",
    "contact_line": (
        '+65 88952590 | desmondchye321@gmail.com | '
        '<a href="https://linkedin.com/in/chye-zhi-hao">linkedin.com/in/chye-zhi-hao</a> | '
        '<a href="https://github.com/BrownBOBAsushi">github.com/BrownBOBAsushi</a>'
    ),
    "education": [
        {
            "institution": "Singapore Institute of Technology",
            "location": "Singapore",
            "degree": "B.Sc. Applied Computing in Fintech",
            "date": "Expected June 2028",
            "notes": [],
        },
        {
            "institution": "Singapore Polytechnic",
            "location": "Singapore",
            "degree": "Diploma in Mechatronics and Robotics Engineering",
            "date": "April 2023",
            "notes": [],
        },
    ],
    "experience": [
        {
            "title": "PLIC Supplier Management Intern",
            "company": "ASM Assembly Systems Singapore Pte. Ltd.",
            "location": "Singapore",
            "date": "Sep 2022 \u2013 Feb 2023",
            "base_bullets": [
                "Reduced manual reporting time by 40% by automating KPI dashboards with Excel VBA, "
                "improving data accuracy across supplier performance workflows.",
                "Strengthened cross-functional collaboration by partnering with engineering and procurement "
                "teams to track quality metrics and surface defect trends early.",
                "Maintained clear technical documentation for recurring operational processes, "
                "ensuring consistent stakeholder alignment.",
            ],
        }
    ],
}

# ── Master project pool (LLM selects by id — never modifies content) ───────────

MASTER_PROJECTS = [
    {
        "id": "singhacks",
        "title": "Agentic AI System (ERC-8004 + X402)",
        "subtitle": "SingHacks 2025 \u2014 3rd Place | Python, Hedera SDK",
        "date": "Nov 2025",
        "bullets": [
            "Built a working multi-agent system where AI agents autonomously transact on Hedera testnet, "
            "placing Top 3 out of all competing teams.",
            "Implemented identity authorization (ERC-8004 registry) and X402 micropayment flows with "
            "explicit security constraints, demonstrating production-aware agent design.",
            "Delivered a live technical demo to judges, communicating agent behaviour and system "
            "architecture clearly under time pressure.",
        ],
        "tags": ["python", "ai", "agents", "blockchain", "hedera", "hackathon", "backend"],
    },
    {
        "id": "blitzjobz",
        "title": "BlitzJobz \u2014 AI Micro-Shift Marketplace",
        "subtitle": "Gemini 3 Hackathon | Python, Gemini API",
        "date": "Jan 2026",
        "bullets": [
            "Integrated Gemini 3 to generate AI-assisted SOPs for job checklists, improving task "
            "execution consistency via context engineering across variable shift types.",
            "Built a multimodal verification pipeline using before/after video analysis to score task "
            "completion against generated SOPs, reducing manual review overhead.",
            "Defined UAT-style acceptance criteria for matching logic and edge cases, enabling "
            "structured testing of AI-driven workflows.",
        ],
        "tags": ["python", "ai", "llm", "gemini", "multimodal", "pipeline", "hackathon", "backend", "product"],
    },
    {
        "id": "ezbiz",
        "title": "EZBiz \u2014 Multi-Agent Orchestration Platform",
        "subtitle": "Hello Future Hackathon | Python, Gemini API",
        "date": "Jan 2026",
        "bullets": [
            "Designed a Plan/Execute/Monitor agentic loop where agents autonomously discover "
            "opportunities, execute listings, and adjust based on real-time feedback.",
            "Implemented verifiable agent authorisation using identity registry and micropayment "
            "concepts, ensuring trustworthy autonomous execution.",
        ],
        "tags": ["python", "ai", "agents", "orchestration", "llm", "hackathon", "backend"],
    },
    {
        "id": "ragbot",
        "title": "Telegram RAG Bot",
        "subtitle": "Python, Gemini API, Qdrant, MongoDB",
        "date": "Mar 2026",
        "bullets": [
            "Built an end-to-end RAG pipeline integrating Qdrant vector search with MongoDB, "
            "enabling contextual document querying with reduced hallucination.",
            "Improved retrieval precision by tuning vector indexing parameters and configuring "
            "retrieval depth, demonstrating performance optimisation for LLM-integrated systems.",
        ],
        "tags": ["python", "rag", "vector", "mongodb", "qdrant", "llm", "backend", "production"],
    },
    {
        "id": "ripplemart",
        "title": "Ripple Mart \u2014 NUS FinTech Summit 2026",
        "subtitle": "TypeScript, XRPL SDK, Node.js",
        "date": "2026",
        "bullets": [
            "Engineered a TypeScript-based platform with XRPL SDK integration, implementing "
            "automated escrow flows and merchant DID systems.",
            "Designed API integrations for transaction processing and merchant verification "
            "across the Ripple payment network.",
        ],
        "tags": ["typescript", "blockchain", "xrpl", "nodejs", "fintech", "api", "backend"],
    },
    {
        "id": "stockanalysis",
        "title": "Stock Market Trend Analysis",
        "subtitle": "Python, pandas, NumPy, yfinance, Streamlit",
        "date": "Oct 2025",
        "bullets": [
            "Built an end-to-end financial data pipeline processing multi-year OHLCV data from "
            "Yahoo Finance, with automated cleaning, validation, and CSV export.",
            "Validated algorithmic outputs (SMA, daily returns, trend detection) against pandas "
            "rolling benchmarks using tolerance checks, ensuring correctness of all analytical results.",
        ],
        "tags": ["python", "finance", "data", "pandas", "streamlit", "analysis", "quant"],
    },
    {
        "id": "cfa",
        "title": "CFA Institute Investing Simulator Challenge",
        "subtitle": "Top 10% Global",
        "date": "Dec 2025",
        "bullets": [
            "Ranked Top 10% globally by applying disciplined risk management, interpreting "
            "real-time economic signals, and managing portfolio exposure with explicit entry and exit rationale.",
        ],
        "tags": ["finance", "investment", "risk", "portfolio", "quant"],
    },
    {
        "id": "hdb",
        "title": "HDB Resale Market Stratification Analysis",
        "subtitle": "R, ggplot2, Plotly",
        "date": "Jan 2026",
        "bullets": [
            "Processed 225,000+ HDB resale transactions to identify a $120k+ price gap widening "
            "between lease tiers post-2020, confirmed via Chow structural break testing and "
            "Kruskal-Wallis analysis (p < 0.05).",
        ],
        "tags": ["r", "data", "statistics", "analysis", "finance"],
    },
]

_PROJECT_MAP = {p["id"]: p for p in MASTER_PROJECTS}

# ── Prompts ─────────────────────────────────────────────────────────────────────

CALL1_PROMPT = """You are a ruthlessly selective tech recruiter and resume strategist.

JOB DESCRIPTION:
{jd_text}

CANDIDATE SKILLS AND BACKGROUND:
- Python (primary), TypeScript/JavaScript, Java, SQL
- AI/LLM: Gemini API, RAG pipelines, agentic orchestration, multimodal analysis
- Tools: Git, Docker, MongoDB, Qdrant, Supabase, Excel VBA, Figma, VS Code
- Web3: Hedera SDK, XRPL SDK, escrow flows, DID/identity concepts, X402 micropayments
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
- Select AT LEAST 3 projects most relevant to this JD
- Do NOT select finance/quant projects (cfa, stockanalysis, hdb) unless JD explicitly requires finance
- Do NOT select blockchain projects (singhacks, ripplemart) unless JD explicitly requires blockchain/Web3
- For tech/AI/startup roles: prefer blitzjobz, ragbot, ezbiz, singhacks
- For finance roles: prefer cfa, stockanalysis, ripplemart, hdb

For selected_skills, ALWAYS return all four categories below, populating each based on what is relevant to this JD:
- "Technical": pick from Python, TypeScript/JavaScript, Java, SQL, R, Streamlit, React.js, Node.js
- "AI / LLM": pick from Gemini API, RAG pipelines, Qdrant, MongoDB, agentic orchestration, multimodal analysis, prompt engineering
- "Tools": pick from Git, Docker, Supabase, Excel VBA, Figma, VS Code, MongoDB, REST APIs
- "Languages": always include "English (Native), Chinese (Native), Malay (Professional), Japanese (N4)"

Respond in JSON only:
{{"match_score": 0, "missing_keywords": ["kw1", "kw2"], "ats_flags": [], "selected_project_ids": ["id1", "id2", "id3"], "selected_skills": {{"Technical": "Python, TypeScript/JavaScript, SQL", "AI / LLM": "Gemini API, RAG pipelines, Qdrant", "Tools": "Git, Docker, Excel VBA", "Languages": "English (Native), Chinese (Native), Malay (Professional), Japanese (N4)"}}, "asm_keywords_to_embed": ["keyword1"]}}"""

CALL2_PROMPT = """You are a professional resume writer. Rewrite bullets using Google XYZ formula.

Google XYZ: "Accomplished [X], as measured by [Y], by doing [Z]"

JOB DESCRIPTION CONTEXT:
{jd_text}

MISSING KEYWORDS TO EMBED NATURALLY: {missing_keywords}

ASM INTERNSHIP BASE BULLETS (rewrite to embed keywords where truthful):
1. Reduced manual reporting time by 40% by automating KPI dashboards with Excel VBA.
2. Strengthened cross-functional collaboration by partnering with engineering and procurement teams to track quality metrics and surface defect trends early.
3. Maintained clear technical documentation for recurring operational processes, ensuring consistent stakeholder alignment.

SELECTED PROJECT BULLETS TO REWRITE:
{selected_project_bullets}

Rules:
- Keep the 40% metric in ASM bullet 1 — never change it
- Keep "Top 3" in SingHacks bullet — never change it
- Do NOT invent new metrics
- Each bullet max ~120 characters
- Past tense, action verbs, no "I"
- Return ONLY JSON:

{{"asm_bullets": ["bullet1", "bullet2", "bullet3"], "project_bullets": {{"id1": ["b1", "b2"], "id2": ["b1", "b2"], "id3": ["b1", "b2"]}}}}"""


# ── Ollama helper ───────────────────────────────────────────────────────────────

def _ollama_chat(model: str, prompt: str, expect_json: bool = True) -> str:
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 2048,
        },
    }
    if expect_json:
        payload["format"] = "json"
    resp = requests.post(f"{OLLAMA_BASE}/api/generate", json=payload, timeout=600)
    if not resp.ok:
        print(f"Ollama error {resp.status_code}: {resp.text[:300]}")
    resp.raise_for_status()
    return resp.json()["response"]


def _parse_json_safe(raw: str, required_keys: list) -> dict | None:
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            cleaned = parts[1] if len(parts) > 1 else cleaned
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip().rstrip("`").strip()
        data = json.loads(cleaned)
        missing = [k for k in required_keys if k not in data]
        if missing:
            print(f"JSON missing keys: {missing}")
            return None
        return data
    except Exception as e:
        print(f"JSON parse failed: {e}\nRaw (first 300): {raw[:300]}")
        return None


# ── HTML template (LLM never touches this) ──────────────────────────────────────

def _e(text: str) -> str:
    return html_lib.escape(str(text))


def _build_education_block(education: list) -> str:
    blocks = []
    for edu in education:
        blocks.append(f"""
        <li>
          <div class="subheading-row">
            <span class="subheading-left">{_e(edu['institution'])}</span>
            <span class="subheading-right">{_e(edu['location'])}</span>
          </div>
          <div class="subheading-sub">
            <span>{_e(edu['degree'])}</span>
            <span>{_e(edu['date'])}</span>
          </div>
        </li>""")
    return "\n".join(blocks)


def _build_experience_block(title: str, company: str, location: str,
                             date: str, bullets: list) -> str:
    items = "".join(f"<li>{_e(b)}</li>" for b in bullets)
    return f"""
    <li>
      <div class="subheading-row">
        <span class="subheading-left">{_e(company)}</span>
        <span class="subheading-right">{_e(location)}</span>
      </div>
      <div class="subheading-sub">
        <span>{_e(title)}</span>
        <span>{_e(date)}</span>
      </div>
      <ul class="item-list">{items}</ul>
    </li>"""


def _build_project_block(title: str, subtitle: str, date: str, bullets: list) -> str:
    items = "".join(f"<li>{_e(b)}</li>" for b in bullets)
    return f"""
    <li>
      <div class="project-heading">
        <span class="project-heading-left"><strong>{_e(title)}</strong> | <em>{_e(subtitle)}</em></span>
        <span class="project-heading-right">{_e(date)}</span>
      </div>
      <ul class="item-list">{items}</ul>
    </li>"""


def _build_skills_block(skills: dict) -> str:
    rows = []
    for label, value in skills.items():
        if value:
            rows.append(
                f'<span class="skills-label">{_e(label)}</span>: {_e(value)}'
            )
    return " <br>\n    ".join(rows)


_JAKE_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  /* ── Reset ── */
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  /* ── Page / Body — mirrors \addtolength margins and 11pt base ── */
  body {{
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #000;
    background: #fff;
    width: 7.5in;          /* letter 8.5in - 0.5in each side */
    margin: 0 auto;
    padding: 0.5in 0.5in;  /* mirrors topmargin + oddsidemargin */
    line-height: 1.2;
  }}

  /* ── Heading — \textbf{{\Huge \scshape}} centered ── */
  h1 {{
    font-size: 24pt;
    font-weight: bold;
    font-variant: small-caps;
    text-align: center;
    margin-bottom: 2pt;
    letter-spacing: 0.5pt;
  }}

  /* ── Contact line — \small, centered, $|$ separators ── */
  .contact {{
    text-align: center;
    font-size: 9pt;
    margin-bottom: 4pt;
  }}
  .contact a {{ color: #000; text-decoration: underline; }}

  /* ── Section header — \scshape\raggedright\large + \titlerule ── */
  .section-header {{
    font-size: 13pt;
    font-variant: small-caps;
    font-weight: normal;
    text-align: left;
    border-bottom: 0.8pt solid #000;
    margin-top: 6pt;
    margin-bottom: 3pt;
    padding-bottom: 1pt;
  }}

  /* ── resumeSubHeadingListStart — leftmargin=0.15in, no label ── */
  .subheading-list {{
    list-style: none;
    padding-left: 0.15in;
    margin: 0;
  }}

  /* ── resumeSubheading — tabular* 0.97\textwidth, bold left / date right ── */
  .subheading-row {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11pt;
    margin-top: 2pt;
  }}
  .subheading-left {{ font-weight: bold; }}
  .subheading-right {{ font-size: 9pt; white-space: nowrap; margin-left: 8pt; }}

  /* ── resumeSubheading second row — \textit{{\small}} ── */
  .subheading-sub {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9pt;
    font-style: italic;
    margin-bottom: 0;
  }}

  /* ── resumeProjectHeading — \small left / date right ── */
  .project-heading {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9pt;
    margin-top: 2pt;
  }}
  .project-heading-left {{ font-size: 9pt; }}
  .project-heading-left strong {{ font-weight: bold; font-size: 9pt; }}
  .project-heading-right {{ font-size: 9pt; white-space: nowrap; margin-left: 8pt; }}

  /* ── resumeItemListStart — standard bullet list ── */
  .item-list {{
    list-style: disc;
    padding-left: 0.2in;
    margin: 1pt 0 5pt 0;
  }}
  .item-list li {{
    font-size: 9pt;
    line-height: 1.35;
    margin-bottom: 0;
    padding-bottom: 2pt;
  }}

  /* ── Skills section — leftmargin=0.15in, no label ── */
  .skills-block {{
    list-style: none;
    padding-left: 0.15in;
    margin: 0;
    font-size: 9pt;
  }}
  .skills-block li {{
    line-height: 1.6;
  }}
  .skills-label {{ font-weight: bold; }}

  @page {{ size: letter; margin: 0; }}
  @media print {{
    body {{ margin: 0; padding: 0.5in; width: 7.5in; }}
  }}
</style>
</head>
<body>

  <!-- HEADING -->
  <h1>{name}</h1>
  <div class="contact">{contact_line}</div>

  <!-- EDUCATION -->
  <div class="section-header">Education</div>
  <ul class="subheading-list">
    {education_block}
  </ul>

  <!-- EXPERIENCE -->
  <div class="section-header">Experience</div>
  <ul class="subheading-list">
    {experience_block}
  </ul>

  <!-- PROJECTS -->
  <div class="section-header">Projects</div>
  <ul class="subheading-list">
    {projects_block}
  </ul>

  <!-- SKILLS -->
  <div class="section-header">Skills</div>
  <ul class="skills-block">
    <li>{skills_block}</li>
  </ul>

</body>
</html>"""


def _build_html(call1: dict, call2: dict) -> str:
    education_block = _build_education_block(CANDIDATE_FIXED["education"])

    asm = CANDIDATE_FIXED["experience"][0]
    asm_bullets = call2.get("asm_bullets") or asm["base_bullets"]
    # Safety: ensure 40% metric is present
    if asm_bullets and "40%" not in asm_bullets[0]:
        asm_bullets[0] = asm["base_bullets"][0]

    experience_block = _build_experience_block(
        title=asm["title"],
        company=asm["company"],
        location=asm["location"],
        date=asm["date"],
        bullets=asm_bullets,
    )

    selected_ids = call1.get("selected_project_ids", [])
    projects_block = ""
    for pid in selected_ids:
        project = _PROJECT_MAP.get(pid)
        if not project:
            continue
        rewritten = call2.get("project_bullets", {}).get(pid) or project["bullets"]
        projects_block += _build_project_block(
            title=project["title"],
            subtitle=project["subtitle"],
            date=project["date"],
            bullets=rewritten,
        )

    skills_block = _build_skills_block(call1.get("selected_skills", {}))

    return _JAKE_HTML.format(
        name=_e(CANDIDATE_FIXED["name"]),
        contact_line=CANDIDATE_FIXED["contact_line"],  # contains HTML links — not escaped
        education_block=education_block,
        experience_block=experience_block,
        projects_block=projects_block,
        skills_block=skills_block,
    )


# ── PDF compilation (sync Playwright — safe from threads on Windows) ────────────

def _compile_pdf(html_content: str, job_id: str) -> str:
    output_dir = os.path.join(os.path.dirname(__file__), "generated_resumes", job_id)
    os.makedirs(output_dir, exist_ok=True)

    html_path = os.path.join(output_dir, "resume.html")
    pdf_path = os.path.join(output_dir, "resume.pdf")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    worker = os.path.join(os.path.dirname(__file__), "pdf_worker.py")
    result = subprocess.run(
        [sys.executable, worker, os.path.abspath(html_path), os.path.abspath(pdf_path)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"pdf_worker failed:\n{result.stderr[-500:]}")

    if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) == 0:
        raise RuntimeError(f"Playwright produced empty PDF for job {job_id}")

    return pdf_path


# ── Entry point ─────────────────────────────────────────────────────────────────

def generate_resume(job_id: str, jd_text: str, job_title: str, company: str) -> dict:
    # ── Call 1: gap analysis + project selection (gemma4:e4b, fast) ────────────
    call1_raw = _ollama_chat(
        model="gemma4:e4b",
        prompt=CALL1_PROMPT.format(jd_text=jd_text[:3000]),
        expect_json=True,
    )
    call1 = _parse_json_safe(call1_raw, required_keys=[
        "match_score", "missing_keywords", "selected_project_ids", "selected_skills",
    ])
    if not call1:
        raise RuntimeError("Call 1 failed — could not parse gap analysis JSON")

    # Validate and cap selected project IDs
    valid_ids = set(_PROJECT_MAP.keys())
    call1["selected_project_ids"] = [
        pid for pid in call1["selected_project_ids"] if pid in valid_ids
    ][:3]
    if not call1["selected_project_ids"]:
        raise RuntimeError("Call 1 returned no valid project IDs")

    # Build bullet context for Call 2
    selected_bullets_text = ""
    for pid in call1["selected_project_ids"]:
        p = _PROJECT_MAP[pid]
        bullets_str = "\n".join(f"  - {b}" for b in p["bullets"])
        selected_bullets_text += f"\n[{pid}] {p['title']}:\n{bullets_str}\n"

    time.sleep(1)  # brief pause between model loads

    # ── Call 2: XYZ bullet rewrite (qwen2.5:14b) ───────────────────────────────
    call2_raw = _ollama_chat(
        model="qwen2.5:14b",
        prompt=CALL2_PROMPT.format(
            jd_text=jd_text[:2000],
            missing_keywords=", ".join(call1.get("missing_keywords", [])),
            selected_project_bullets=selected_bullets_text,
        ),
        expect_json=True,
    )
    call2 = _parse_json_safe(call2_raw, required_keys=["asm_bullets", "project_bullets"])
    if not call2:
        print(f"Call 2 failed for {job_id} — falling back to original bullets")
        call2 = {
            "asm_bullets": CANDIDATE_FIXED["experience"][0]["base_bullets"],
            "project_bullets": {
                pid: _PROJECT_MAP[pid]["bullets"]
                for pid in call1["selected_project_ids"]
            },
        }

    # ── Build HTML (pure Python — no LLM) ──────────────────────────────────────
    html_content = _build_html(call1, call2)

    # ── Compile PDF (sync Playwright) ───────────────────────────────────────────
    pdf_path = _compile_pdf(html_content, job_id)
    html_path = os.path.join(
        os.path.dirname(__file__), "generated_resumes", job_id, "resume.html"
    )

    record = {
        "job_id": job_id,
        "match_score": call1.get("match_score", 0),
        "missing_keywords": call1.get("missing_keywords", []),
        "ats_flags": call1.get("ats_flags", []),
        "html_path": html_path,
        "pdf_path": pdf_path,
        "generation_failed": 0,
    }
    db.upsert_resume_output(record)
    return record
