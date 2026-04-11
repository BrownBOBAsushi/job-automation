import os
import json
import subprocess
import anthropic
from dotenv import load_dotenv
import db

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

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

CALL1_PROMPT = """\
You are an expert ATS system and tech recruiter.

CANDIDATE PROFILE:
{candidate_profile}

JOB DESCRIPTION:
{jd_text}

Respond ONLY in valid JSON with no preamble:
{{
  "match_score": <integer 0-100>,
  "missing_keywords": [<top 5 keywords from JD absent in candidate profile>],
  "hard_blockers": [<requirements candidate clearly cannot meet>],
  "ats_flags": [<formatting issues or missing sections ATS bots penalise>]
}}\
"""

CALL2_PROMPT = """\
You are a professional resume writer for student internship applications.

CANDIDATE PROFILE:
{candidate_profile}

MASTER EXPERIENCE POOL:
{master_experience}

JOB DESCRIPTION:
{jd_text}

MISSING KEYWORDS TO EMBED:
{missing_keywords}

Instructions:
- Select ONLY the 3-4 most relevant experiences from the master pool
- Rewrite each as 2-3 bullets: "Accomplished X, as measured by Y, by doing Z"
- Embed missing keywords where truthful
- Do NOT invent metrics — only use what is in the pool
- Lead with projects/hackathons over internship if role is technical

Respond ONLY in valid JSON:
{{
  "selected_experiences": [
    {{"title": "<name>", "bullets": ["<bullet 1>", "<bullet 2>"]}}
  ],
  "skills_to_highlight": [<8-10 most relevant skills>]
}}\
"""

CALL3_PROMPT = """\
You are a LaTeX expert. Generate a complete main.tex using Jake's Resume template.

CANDIDATE PROFILE:
{candidate_profile}

SELECTED EXPERIENCES:
{selected_experiences}

SKILLS:
{skills_to_highlight}

APPLYING FOR: {job_title} at {company}

Rules:
- Jake's Resume template sections: Education, Experience, Projects, Technical Skills
- 1 page only
- No tables or multi-column layouts in main content (breaks ATS)
- Standard section headers only
- Do not hallucinate any data not provided
- Output ONLY the complete main.tex — no explanation, no markdown fences

Jake's Resume base (complete the document):
\\documentclass[letterpaper,11pt]{{article}}
\\usepackage{{latexsym}}
\\usepackage[empty]{{fullpage}}
\\usepackage{{titlesec}}
\\usepackage[usenames,dvipsnames]{{color}}
\\usepackage{{enumitem}}
\\usepackage[hidelinks]{{hyperref}}
\\usepackage{{fancyhdr}}
\\usepackage[english]{{babel}}
\\usepackage{{tabularx}}
\\input{{glyphtounicode}}
\\pagestyle{{fancy}}
\\fancyhf{{}}
\\fancyfoot{{}}
\\renewcommand{{\\headrulewidth}}{{0pt}}
\\addtolength{{\\oddsidemargin}}{{-0.5in}}
\\addtolength{{\\textwidth}}{{1in}}
\\addtolength{{\\topmargin}}{{-.5in}}
\\addtolength{{\\textheight}}{{1.0in}}
\\raggedbottom\\raggedright
\\setlength{{\\tabcolsep}}{{0in}}
\\pdfgentounicode=1\
"""


def _llm(prompt: str, max_tokens: int = 2000) -> str:
    msg = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


def _parse_json(raw: str) -> dict:
    cleaned = raw.strip().removeprefix("```json").removesuffix("```").strip()
    return json.loads(cleaned)


def compile_latex(tex_content: str, job_id: str) -> str:
    output_dir = os.path.join(os.path.dirname(__file__), "generated_resumes", job_id)
    os.makedirs(output_dir, exist_ok=True)

    tex_path = os.path.join(output_dir, "main.tex")
    pdf_path = os.path.join(output_dir, "main.pdf")

    with open(tex_path, "w", encoding="utf-8") as f:
        f.write(tex_content)

    # Run twice — LaTeX needs two passes for correct layout
    # First run may be slow on MiKTeX (auto-downloads missing packages)
    for i in range(2):
        timeout = 300 if i == 0 else 120  # first pass longer for package downloads
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", f"-output-directory={output_dir}", tex_path],
            capture_output=True, text=True, timeout=timeout,
        )

    if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) == 0:
        log_path = os.path.join(output_dir, "main.log")
        log = open(log_path, encoding="utf-8", errors="replace").read() if os.path.exists(log_path) else "No log"
        raise RuntimeError(f"pdflatex produced no valid PDF.\nLog:\n{log[-2000:]}")

    return pdf_path


def generate_resume(job_id: str, jd_text: str, job_title: str, company: str) -> dict:
    # Call 1 — gap analysis
    step1 = _parse_json(_llm(CALL1_PROMPT.format(
        candidate_profile=CANDIDATE_PROFILE,
        jd_text=jd_text,
    )))

    # Call 2 — experience selection + XYZ rewrite
    step2 = _parse_json(_llm(CALL2_PROMPT.format(
        candidate_profile=CANDIDATE_PROFILE,
        master_experience=MASTER_EXPERIENCE,
        jd_text=jd_text,
        missing_keywords=json.dumps(step1["missing_keywords"]),
    )))

    # Call 3 — LaTeX generation
    tex_raw = _llm(CALL3_PROMPT.format(
        candidate_profile=CANDIDATE_PROFILE,
        selected_experiences=json.dumps(step2["selected_experiences"], indent=2),
        skills_to_highlight=json.dumps(step2["skills_to_highlight"]),
        job_title=job_title,
        company=company,
    ), max_tokens=4000)

    tex_content = tex_raw.strip().removeprefix("```latex").removeprefix("```").removesuffix("```").strip()

    pdf_path = compile_latex(tex_content, job_id)
    tex_path = os.path.join(os.path.dirname(__file__), "generated_resumes", job_id, "main.tex")

    record = {
        "job_id": job_id,
        "match_score": step1.get("match_score", 0),
        "missing_keywords": step1.get("missing_keywords", []),
        "ats_flags": step1.get("ats_flags", []),
        "latex_path": tex_path,
        "pdf_path": pdf_path,
        "generation_failed": False,
    }
    db.upsert_resume_output(record)
    return record
