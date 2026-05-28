# MarkDay

A local-first daily work logger with rich Markdown editing, calendar navigation, search, and math support. All data stays on your machine — no cloud, no accounts.

---

## Features

| Feature                 | Details                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| **Markdown editor**     | Auto-continuing lists, smart indent/unindent, toolbar shortcuts        |
| **Calendar**            | Sidebar mini-calendar, dots on days with entries, year/month nav       |
| **Dark / Light themes** | Toggle with one click; persisted in localStorage                       |
| **Search**              | Full-text search across all years with highlighted snippets            |
| **Preview**             | On-demand split-pane preview with math (KaTeX) and syntax highlighting |
| **Math**                | KaTeX — inline `$...$` and display `$$...$$`                           |
| **Keyboard shortcuts**  | VS Code–style: Ctrl+B/I/S/P/F/D, Alt+↑↓, Tab indent, list continuation |
| **Local storage**       | One Markdown file per year at `~/.markday/YYYY.md`                     |

---

## Installation

```bash
pip install .
```

Or for development (editable install):

```bash
pip install -e .
```

---

## Usage

```bash
markday                  # start on default port 5500, open browser
markday --port 8080      # custom port
markday --no-browser     # don't auto-open browser
markday --debug          # Flask debug mode
```

Set the data directory via environment variable:

```bash
MARKDAY_DIR=/path/to/notes markday
```

---

## Data format

Entries are stored as plain Markdown in `~/.markday/YYYY.md`:

```markdown
# Mark Day 2026

## 2026-05-28

- Implemented FNO baseline on Burgers' equation
- Compared modes=12 vs modes=24: higher modes overfit on small dataset

## 2026-05-29

### Meetings

- Sync with team on neural operator paper

### TODO

- [ ] Run ablation on FiLM conditioning strength
- [x] Fix memory leak in DataLoader
```

Because the format is plain Markdown, you can edit files directly in any editor, commit them to git, grep them, or process them with any Markdown tool.

---

## Keyboard shortcuts

| Shortcut                 | Action                       |
| ------------------------ | ---------------------------- |
| `Ctrl+S`                 | Save                         |
| `Ctrl+B`                 | Bold                         |
| `Ctrl+I`                 | Italic                       |
| `Ctrl+P`                 | Toggle preview               |
| `Ctrl+F`                 | Focus search                 |
| `Ctrl+/`                 | Toggle HTML comment on line  |
| `Ctrl+D`                 | Duplicate line               |
| `Alt+↑` / `Alt+↓`        | Move line up/down            |
| `Ctrl+]` / `Ctrl+[`      | Indent / Unindent            |
| `Tab` / `Shift+Tab`      | Indent / Unindent (2 spaces) |
| `Enter`                  | Smart list continuation      |
| `Ctrl+Home` / `Ctrl+End` | Jump to top / bottom         |
| `Esc`                    | Close modals                 |

---

## Math examples

Inline: `$E = mc^2$`

Display:

```math
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

Neural operator notation:

```math
$$
\mathcal{G}_\theta : \mathcal{A} \to \mathcal{U}, \quad u = \mathcal{G}_\theta(a)
$$
```

---

## Requirements

- Python ≥ 3.10
- Flask ≥ 3.0
- markdown ≥ 3.6
- pygments ≥ 2.17

All other dependencies (CodeMirror, KaTeX, highlight.js) are loaded from CDN.
