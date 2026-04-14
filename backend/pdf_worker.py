"""
Standalone PDF renderer — called as a subprocess by resume_tailor.py.
Runs in its own process so there are no asyncio event loop conflicts with uvicorn.

Usage: py pdf_worker.py <html_path> <pdf_path>
"""
import sys
from playwright.sync_api import sync_playwright

html_path = sys.argv[1]
pdf_path = sys.argv[2]
file_uri = "file:///" + html_path.replace("\\", "/")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(file_uri)
    page.wait_for_load_state("networkidle")
    page.pdf(
        path=pdf_path,
        format="A4",
        print_background=True,
        margin={"top": "14mm", "bottom": "14mm", "left": "14mm", "right": "14mm"},
    )
    browser.close()
