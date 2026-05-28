"""
worklog - A local daily work logging app with rich markdown editing.
"""

import os
import re
from datetime import datetime, date
from pathlib import Path

from flask import Flask, render_template, request, jsonify, abort
import markdown

DATA_DIR = Path(os.environ.get("WORKLOG_DIR", Path.home() / ".worklog"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_log_file(year: int) -> Path:
    return DATA_DIR / f"{year}.md"


def parse_log_file(year: int) -> dict[str, str]:
    """Parse a year log file into {YYYY-MM-DD: content} dict."""
    path = get_log_file(year)
    if not path.exists():
        return {}

    entries: dict[str, str] = {}
    current_date = None
    current_lines: list[str] = []

    date_pattern = re.compile(r"^##\s+(\d{4}-\d{2}-\d{2})\s*$")

    for line in path.read_text(encoding="utf-8").splitlines(keepends=True):
        m = date_pattern.match(line.rstrip())
        if m:
            if current_date is not None:
                entries[current_date] = "".join(current_lines).strip()
            current_date = m.group(1)
            current_lines = []
        else:
            if current_date is not None:
                current_lines.append(line)

    if current_date is not None:
        entries[current_date] = "".join(current_lines).strip()

    return entries


def write_log_file(year: int, entries: dict[str, str]) -> None:
    """Write sorted entries back to the year log file."""
    path = get_log_file(year)
    lines = [f"# Work Log {year}\n\n"]
    for date_str in sorted(entries.keys()):
        content = entries[date_str].strip()
        lines.append(f"## {date_str}\n\n{content}\n\n")
    path.write_text("".join(lines), encoding="utf-8")


def render_md(text: str) -> str:
    """Render markdown to HTML with extensions."""
    return markdown.markdown(
        text,
        extensions=[
            "extra",
            "codehilite",
            "toc",
            "nl2br",
            "sane_lists",
            "admonition",
        ],
        extension_configs={
            "codehilite": {"guess_lang": False, "noclasses": False}
        },
    )


def create_app() -> Flask:
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.secret_key = os.urandom(24)

    @app.route("/")
    def index():
        today = date.today().isoformat()
        return render_template("index.html", today=today)

    @app.route("/api/entry/<date_str>", methods=["GET"])
    def get_entry(date_str):
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            abort(400)
        entries = parse_log_file(d.year)
        content = entries.get(date_str, "")
        return jsonify({"date": date_str, "content": content})

    @app.route("/api/entry/<date_str>", methods=["PUT"])
    def save_entry(date_str):
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            abort(400)
        data = request.get_json(force=True)
        content = data.get("content", "")
        entries = parse_log_file(d.year)
        if content.strip():
            entries[date_str] = content
        else:
            entries.pop(date_str, None)
        write_log_file(d.year, entries)
        return jsonify({"ok": True})

    @app.route("/api/preview", methods=["POST"])
    def preview():
        data = request.get_json(force=True)
        html = render_md(data.get("content", ""))
        return jsonify({"html": html})

    @app.route("/api/dates/<int:year>")
    def dates_with_entries(year):
        entries = parse_log_file(year)
        return jsonify({"dates": list(entries.keys())})

    @app.route("/api/search")
    def search():
        query = request.args.get("q", "").strip().lower()
        if not query:
            return jsonify({"results": []})

        results = []
        for year_file in sorted(DATA_DIR.glob("*.md")):
            try:
                year = int(year_file.stem)
            except ValueError:
                continue
            entries = parse_log_file(year)
            for date_str, content in entries.items():
                if query in content.lower():
                    # Find surrounding context
                    idx = content.lower().find(query)
                    start = max(0, idx - 60)
                    end = min(len(content), idx + len(query) + 60)
                    snippet = ("..." if start > 0 else "") + content[start:end] + ("..." if end < len(content) else "")
                    results.append({"date": date_str, "snippet": snippet})

        results.sort(key=lambda r: r["date"], reverse=True)
        return jsonify({"results": results[:50]})

    @app.route("/api/years")
    def available_years():
        years = []
        for f in DATA_DIR.glob("*.md"):
            try:
                years.append(int(f.stem))
            except ValueError:
                pass
        return jsonify({"years": sorted(years, reverse=True)})

    return app
