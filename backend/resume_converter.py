import os
import io
from docx import Document
from markdownify import markdownify as md


def docx_bytes_to_markdown(file_bytes: bytes) -> str:
    """Convert .docx bytes to clean markdown string."""
    doc = Document(io.BytesIO(file_bytes))

    # Extract paragraphs preserving basic structure
    html_parts = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            html_parts.append("<br>")
            continue

        style = para.style.name.lower()
        if "heading 1" in style:
            html_parts.append(f"<h1>{text}</h1>")
        elif "heading 2" in style:
            html_parts.append(f"<h2>{text}</h2>")
        elif "heading 3" in style:
            html_parts.append(f"<h3>{text}</h3>")
        elif "list" in style:
            html_parts.append(f"<li>{text}</li>")
        else:
            html_parts.append(f"<p>{text}</p>")

    raw_html = "\n".join(html_parts)
    markdown = md(raw_html, heading_style="ATX", bullets="-")

    # Clean up excessive blank lines
    lines = markdown.splitlines()
    cleaned = []
    prev_blank = False
    for line in lines:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        cleaned.append(line)
        prev_blank = is_blank

    return "\n".join(cleaned).strip()


def save_master_resume(file_bytes: bytes) -> str:
    """Convert .docx bytes and save as master_resume.md. Returns the markdown content."""
    markdown = docx_bytes_to_markdown(file_bytes)
    output_path = os.path.join(os.path.dirname(__file__), "master_resume.md")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(markdown)
    return markdown


def load_master_resume() -> str | None:
    """Load master_resume.md content. Returns None if not yet uploaded."""
    path = os.path.join(os.path.dirname(__file__), "master_resume.md")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()
