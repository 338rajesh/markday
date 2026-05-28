/* ================================================================
   worklog/static/js/editor.js
   Full-featured markdown editor with calendar, search, shortcuts
   ================================================================ */

"use strict";

// ── State ─────────────────────────────────────────────────────────
const state = {
  currentDate: null,    // "YYYY-MM-DD"
  currentYear: null,
  currentMonth: null,   // 0-indexed
  entrydates: new Set(),
  dirty: false,
  previewOpen: false,
  sidebarOpen: true,
  saveTimer: null,
};

// ── DOM refs ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const editor        = $("editor");
const previewPane   = $("preview-pane");
const previewContent = $("preview-content");
const calGrid       = $("cal-grid");
const calMonthLabel = $("cal-month-label");
const currentYearEl = $("current-year");
const saveStatus    = $("save-status");
const searchInput   = $("search-input");
const searchResults = $("search-results");
const entryDateLabel = $("entry-date-label");
const shortcutsModal = $("shortcuts-modal");
const previewToggleBtn = $("preview-toggle");

// ── Utility ───────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function fmtDateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// ── Theme ─────────────────────────────────────────────────────────
const themeToggle = $("theme-toggle");
let theme = localStorage.getItem("wl-theme") || "dark";

function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute("data-theme", t);
  themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
  localStorage.setItem("wl-theme", t);

  // swap highlight.js stylesheet
  const hlTheme = t === "dark"
    ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css"
    : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-light.min.css";
  $("hljs-theme").href = hlTheme;
}

applyTheme(theme);
themeToggle.addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));

// ── Sidebar toggle ─────────────────────────────────────────────────
$("sidebar-toggle").addEventListener("click", () => {
  state.sidebarOpen = !state.sidebarOpen;
  $("sidebar").classList.toggle("collapsed", !state.sidebarOpen);
});

// ── Entry dates cache ─────────────────────────────────────────────
async function loadEntryDates(year) {
  const res = await fetch(`/api/dates/${year}`);
  const data = await res.json();
  state.entrydates = new Set(data.dates);
}

// ── Calendar ───────────────────────────────────────────────────────
function renderCalendar() {
  const year  = state.currentYear;
  const month = state.currentMonth;
  currentYearEl.textContent = year;
  calMonthLabel.textContent = `${MONTH_NAMES[month]} ${year}`;

  // Remove existing day cells (keep DOW headers = first 7 children)
  const cells = calGrid.querySelectorAll(".cal-day");
  cells.forEach(c => c.remove());

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const today = todayISO();

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const prevMonth = month === 0 ? 12 : month;
    const prevYear  = month === 0 ? year - 1 : year;
    const iso = `${prevYear}-${pad(prevMonth)}-${pad(day)}`;
    calGrid.appendChild(makeDayCell(day, iso, true));
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(month+1)}-${pad(d)}`;
    calGrid.appendChild(makeDayCell(d, iso, false));
  }

  // Next month padding to complete grid
  const total = firstDay + daysInMonth;
  const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remainder; d++) {
    const nextMonth = month === 11 ? 1 : month + 2;
    const nextYear  = month === 11 ? year + 1 : year;
    const iso = `${nextYear}-${pad(nextMonth)}-${pad(d)}`;
    calGrid.appendChild(makeDayCell(d, iso, true));
  }
}

function makeDayCell(day, iso, otherMonth) {
  const cell = document.createElement("div");
  cell.className = "cal-day";
  cell.textContent = day;
  cell.dataset.date = iso;

  if (otherMonth) cell.classList.add("other-month");
  if (iso === todayISO()) cell.classList.add("today");
  if (iso === state.currentDate) cell.classList.add("selected");
  if (state.entrydates.has(iso)) cell.classList.add("has-entry");

  cell.addEventListener("click", () => navigateTo(iso));
  return cell;
}

function refreshSelectedCell() {
  document.querySelectorAll(".cal-day").forEach(c => {
    c.classList.toggle("selected", c.dataset.date === state.currentDate);
  });
}

// ── Month nav ─────────────────────────────────────────────────────
$("prev-month").addEventListener("click", () => {
  if (state.currentMonth === 0) { state.currentMonth = 11; state.currentYear--; }
  else { state.currentMonth--; }
  updateYearIfNeeded();
  renderCalendar();
});

$("next-month").addEventListener("click", () => {
  if (state.currentMonth === 11) { state.currentMonth = 0; state.currentYear++; }
  else { state.currentMonth++; }
  updateYearIfNeeded();
  renderCalendar();
});

$("prev-year").addEventListener("click", async () => {
  state.currentYear--;
  currentYearEl.textContent = state.currentYear;
  await loadEntryDates(state.currentYear);
  renderCalendar();
});

$("next-year").addEventListener("click", async () => {
  state.currentYear++;
  currentYearEl.textContent = state.currentYear;
  await loadEntryDates(state.currentYear);
  renderCalendar();
});

async function updateYearIfNeeded() {
  const displayedYear = state.currentYear;
  if (displayedYear !== parseInt(currentYearEl.textContent)) {
    await loadEntryDates(displayedYear);
  }
}

// ── Entry load / save ─────────────────────────────────────────────
async function navigateTo(iso) {
  if (state.currentDate === iso) return;
  if (state.dirty) await saveEntry(state.currentDate);

  state.currentDate = iso;
  const [y, m] = iso.split("-").map(Number);
  state.currentYear  = y;
  state.currentMonth = m - 1;

  entryDateLabel.textContent = fmtDateLabel(iso);
  await loadEntryDates(y);
  renderCalendar();
  refreshSelectedCell();
  await loadEntry(iso);
}

async function loadEntry(iso) {
  const res  = await fetch(`/api/entry/${iso}`);
  const data = await res.json();
  editor.value = data.content || "";
  state.dirty = false;
  setSaveStatus("saved");
  if (state.previewOpen) await refreshPreview();
}

async function saveEntry(iso) {
  if (!iso) return;
  await fetch(`/api/entry/${iso}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: editor.value }),
  });
  state.dirty = false;
  // Update entry dot on calendar
  if (editor.value.trim()) state.entrydates.add(iso);
  else state.entrydates.delete(iso);
  renderCalendar();
  setSaveStatus("saved");
}

function setSaveStatus(s) {
  if (s === "saved") {
    saveStatus.textContent = "✓ saved";
    saveStatus.style.color = "var(--green)";
  } else {
    saveStatus.textContent = "● unsaved";
    saveStatus.style.color = "var(--yellow)";
  }
}

// Auto-save on change
editor.addEventListener("input", () => {
  state.dirty = true;
  setSaveStatus("unsaved");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveEntry(state.currentDate), 1500);
});

// ── Preview ───────────────────────────────────────────────────────
previewToggleBtn.addEventListener("click", togglePreview);

async function togglePreview() {
  state.previewOpen = !state.previewOpen;
  previewPane.classList.toggle("hidden", !state.previewOpen);
  previewToggleBtn.classList.toggle("active", state.previewOpen);
  if (state.previewOpen) await refreshPreview();
}

async function refreshPreview() {
  const res  = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: editor.value }),
  });
  const data = await res.json();
  previewContent.innerHTML = data.html;

  // Syntax highlight
  previewContent.querySelectorAll("pre code").forEach(el => {
    hljs.highlightElement(el);
  });

  // Math rendering
  if (window.renderMathInElement) {
    renderMathInElement(previewContent, {
      delimiters: [
        { left: "$$",  right: "$$",  display: true  },
        { left: "$",   right: "$",   display: false },
        { left: "\\[", right: "\\]", display: true  },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
  }
}

// Auto refresh preview on input (debounced)
let previewTimer = null;
editor.addEventListener("input", () => {
  if (!state.previewOpen) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 600);
});

// ── Search ────────────────────────────────────────────────────────
let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 300);
});

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) { searchResults.innerHTML = ""; return; }
  const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  renderSearchResults(data.results, q);
}

function renderSearchResults(results, q) {
  if (!results.length) {
    searchResults.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:6px 4px;">No results</div>`;
    return;
  }
  searchResults.innerHTML = results.map(r => {
    const snip = r.snippet.replace(
      new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
      `<mark style="background:var(--yellow);color:#000;border-radius:2px">$1</mark>`
    );
    return `<div class="search-result" data-date="${r.date}">
      <div class="search-result-date">${r.date}</div>
      <div class="search-result-snippet">${snip}</div>
    </div>`;
  }).join("");

  searchResults.querySelectorAll(".search-result").forEach(el => {
    el.addEventListener("click", () => {
      navigateTo(el.dataset.date);
      searchInput.value = "";
      searchResults.innerHTML = "";
    });
  });
}

// ── Toolbar actions ───────────────────────────────────────────────
document.querySelectorAll("#editor-toolbar button[data-action]").forEach(btn => {
  btn.addEventListener("click", () => {
    applyFormat(btn.dataset.action);
    editor.focus();
  });
});

function applyFormat(action) {
  const ta = editor;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.slice(start, end);
  const line  = getLineAt(ta, start);

  let replacement = "";
  let newCursor   = null;
  let newSelStart = null;
  let newSelEnd   = null;

  switch (action) {
    case "bold":
      replacement = `**${sel || "bold text"}**`;
      wrapSelection(ta, start, end, "**", "**", "bold text"); return;
    case "italic":
      wrapSelection(ta, start, end, "_", "_", "italic text"); return;
    case "strike":
      wrapSelection(ta, start, end, "~~", "~~", "strikethrough"); return;
    case "code":
      wrapSelection(ta, start, end, "`", "`", "code"); return;
    case "h1": prependLine(ta, "# "); return;
    case "h2": prependLine(ta, "## "); return;
    case "h3": prependLine(ta, "### "); return;
    case "ul":  prependLine(ta, "- "); return;
    case "ol":  prependLine(ta, "1. "); return;
    case "task": prependLine(ta, "- [ ] "); return;
    case "blockquote": prependLine(ta, "> "); return;
    case "codeblock":
      insertBlock(ta, start, end, "```\n", "\n```", "code here"); return;
    case "math":
      insertBlock(ta, start, end, "$$\n", "\n$$", "LaTeX here"); return;
    case "hr":
      insertAtLineStart(ta, "\n---\n"); return;
    case "link":
      wrapSelectionLink(ta, start, end); return;
    case "table":
      insertTable(ta, start); return;
  }
}

function wrapSelection(ta, start, end, prefix, suffix, placeholder) {
  const sel = ta.value.slice(start, end) || placeholder;
  const newVal = ta.value.slice(0, start) + prefix + sel + suffix + ta.value.slice(end);
  ta.value = newVal;
  ta.selectionStart = start + prefix.length;
  ta.selectionEnd   = start + prefix.length + sel.length;
  triggerInput(ta);
}

function prependLine(ta, prefix) {
  const start = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
  const line = ta.value.slice(lineStart, start);
  // Toggle: if already has prefix, remove it
  if (line.startsWith(prefix)) {
    ta.value = ta.value.slice(0, lineStart) + line.slice(prefix.length) + ta.value.slice(lineStart + line.length);
    ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - prefix.length);
  } else {
    ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    ta.selectionStart = ta.selectionEnd = start + prefix.length;
  }
  triggerInput(ta);
}

function insertBlock(ta, start, end, prefix, suffix, placeholder) {
  const sel = ta.value.slice(start, end) || placeholder;
  const newVal = ta.value.slice(0, start) + prefix + sel + suffix + ta.value.slice(end);
  ta.value = newVal;
  ta.selectionStart = start + prefix.length;
  ta.selectionEnd   = start + prefix.length + sel.length;
  triggerInput(ta);
}

function insertAtLineStart(ta, text) {
  const start = ta.selectionStart;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(start);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  triggerInput(ta);
}

function wrapSelectionLink(ta, start, end) {
  const sel = ta.value.slice(start, end);
  const replacement = sel ? `[${sel}](url)` : "[link text](url)";
  ta.value = ta.value.slice(0, start) + replacement + ta.value.slice(end);
  ta.selectionStart = start;
  ta.selectionEnd   = start + replacement.length;
  triggerInput(ta);
}

function insertTable(ta, start) {
  const table = "\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n";
  ta.value = ta.value.slice(0, start) + table + ta.value.slice(start);
  ta.selectionStart = ta.selectionEnd = start + table.length;
  triggerInput(ta);
}

function getLineAt(ta, pos) {
  const lineStart = ta.value.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd   = ta.value.indexOf("\n", pos);
  return ta.value.slice(lineStart, lineEnd === -1 ? ta.value.length : lineEnd);
}

function triggerInput(ta) {
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

// ── Keyboard shortcuts ────────────────────────────────────────────
editor.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt   = e.altKey;

  // Save
  if (ctrl && e.key === "s") {
    e.preventDefault();
    saveEntry(state.currentDate);
    return;
  }

  // Bold / Italic
  if (ctrl && !shift && e.key === "b") { e.preventDefault(); applyFormat("bold"); return; }
  if (ctrl && !shift && e.key === "i") { e.preventDefault(); applyFormat("italic"); return; }

  // Preview toggle
  if (ctrl && e.key === "p") { e.preventDefault(); togglePreview(); return; }

  // Sidebar toggle
  if (ctrl && e.key === "\\") {
    e.preventDefault();
    state.sidebarOpen = !state.sidebarOpen;
    $("sidebar").classList.toggle("collapsed", !state.sidebarOpen);
    return;
  }

  // Shortcuts Help
  if (ctrl && shift && e.key === "?") {
    e.preventDefault();
    shortcutsModal.classList.toggle("hidden");
    return;
  }

  // Search focus
  if (ctrl && e.key === "f") { e.preventDefault(); searchInput.focus(); return; }

  // Tab / Shift-Tab: indent/unindent
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editor.selectionStart;
    const end   = editor.selectionEnd;
    if (!shift) {
      editor.value = editor.value.slice(0, start) + "  " + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
    } else {
      const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
      const line = editor.value.slice(lineStart);
      if (line.startsWith("  ")) {
        editor.value = editor.value.slice(0, lineStart) + editor.value.slice(lineStart + 2);
        editor.selectionStart = editor.selectionEnd = Math.max(lineStart, start - 2);
      }
    }
    triggerInput(editor);
    return;
  }

  // Ctrl+D: duplicate line
  if (ctrl && e.key === "d") {
    e.preventDefault();
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd   = editor.value.indexOf("\n", start);
    const end = lineEnd === -1 ? editor.value.length : lineEnd;
    const line = editor.value.slice(lineStart, end);
    editor.value = editor.value.slice(0, end) + "\n" + line + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = end + 1 + (start - lineStart);
    triggerInput(editor);
    return;
  }

  // Alt+Up / Alt+Down: move line
  if (alt && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const start = editor.selectionStart;
    const val   = editor.value;
    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    const lineEndRaw = val.indexOf("\n", start);
    const lineEnd   = lineEndRaw === -1 ? val.length : lineEndRaw;
    const line = val.slice(lineStart, lineEnd);

    if (e.key === "ArrowUp" && lineStart > 0) {
      const prevEnd   = lineStart - 1;
      const prevStart = val.lastIndexOf("\n", prevEnd - 1) + 1;
      const prevLine  = val.slice(prevStart, prevEnd);
      editor.value = val.slice(0, prevStart) + line + "\n" + prevLine + val.slice(lineEnd);
      const offset = start - lineStart;
      editor.selectionStart = editor.selectionEnd = prevStart + offset;
    } else if (e.key === "ArrowDown" && lineEnd < val.length) {
      const nextStart = lineEnd + 1;
      const nextEndRaw = val.indexOf("\n", nextStart);
      const nextEnd = nextEndRaw === -1 ? val.length : nextEndRaw;
      const nextLine = val.slice(nextStart, nextEnd);
      editor.value = val.slice(0, lineStart) + nextLine + "\n" + line + val.slice(nextEnd);
      const offset = start - lineStart;
      editor.selectionStart = editor.selectionEnd = lineStart + nextLine.length + 1 + offset;
    }
    triggerInput(editor);
    return;
  }

  // Ctrl+/ : toggle comment (markdown doesn't have line comments, so we use HTML comment)
  if (ctrl && e.key === "/") {
    e.preventDefault();
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd   = editor.value.indexOf("\n", start);
    const end = lineEnd === -1 ? editor.value.length : lineEnd;
    const line = editor.value.slice(lineStart, end);

    let newLine;
    if (line.startsWith("<!-- ") && line.endsWith(" -->")) {
      newLine = line.slice(5, -4);
    } else {
      newLine = `<!-- ${line} -->`;
    }
    editor.value = editor.value.slice(0, lineStart) + newLine + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = lineStart + newLine.length;
    triggerInput(editor);
    return;
  }

  // Indent / unindent with Ctrl+] / Ctrl+[
  if (ctrl && e.key === "]") { e.preventDefault(); applyIndent(1); return; }
  if (ctrl && e.key === "[") { e.preventDefault(); applyIndent(-1); return; }

  // Ctrl+Home / Ctrl+End
  if (ctrl && e.key === "Home") { e.preventDefault(); editor.selectionStart = editor.selectionEnd = 0; return; }
  if (ctrl && e.key === "End")  { e.preventDefault(); editor.selectionStart = editor.selectionEnd = editor.value.length; return; }

  // Enter: smart continuation of lists
  if (e.key === "Enter") {
    const start = editor.selectionStart;
    const val   = editor.value;
    const lineStart = val.lastIndexOf("\n", start - 1) + 1;
    const currentLine = val.slice(lineStart, start);

    const ulMatch   = currentLine.match(/^(\s*)([-*+]\s)/);
    const olMatch   = currentLine.match(/^(\s*)(\d+)\.\s/);
    const taskMatch = currentLine.match(/^(\s*)([-*+]\s\[[ x]\]\s)/);

    if (taskMatch && currentLine.trim() !== taskMatch[2].trim()) {
      e.preventDefault();
      const indent = taskMatch[1];
      const prefix = `${indent}- [ ] `;
      insert(editor, start, "\n" + prefix);
      return;
    }
    if (ulMatch && currentLine.trim() !== ulMatch[2].trim()) {
      e.preventDefault();
      const prefix = ulMatch[1] + ulMatch[2];
      insert(editor, start, "\n" + prefix);
      return;
    }
    if (olMatch && currentLine.trim() !== (olMatch[2] + ". ").trim()) {
      e.preventDefault();
      const nextNum = parseInt(olMatch[2]) + 1;
      const prefix = olMatch[1] + `${nextNum}. `;
      insert(editor, start, "\n" + prefix);
      return;
    }
    // If list line is empty (just the marker), remove marker and continue normally
    if (ulMatch && currentLine.trim() === ulMatch[2].trim()) {
      e.preventDefault();
      const lineEndIdx = val.indexOf("\n", start);
      const end = lineEndIdx === -1 ? val.length : lineEndIdx;
      editor.value = val.slice(0, lineStart) + val.slice(end);
      editor.selectionStart = editor.selectionEnd = lineStart;
      triggerInput(editor);
      return;
    }
  }
});

function insert(ta, pos, text) {
  ta.value = ta.value.slice(0, pos) + text + ta.value.slice(pos);
  ta.selectionStart = ta.selectionEnd = pos + text.length;
  triggerInput(ta);
}

function applyIndent(dir) {
  const start = editor.selectionStart;
  const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
  if (dir > 0) {
    editor.value = editor.value.slice(0, lineStart) + "  " + editor.value.slice(lineStart);
    editor.selectionStart = editor.selectionEnd = start + 2;
  } else {
    if (editor.value.slice(lineStart, lineStart + 2) === "  ") {
      editor.value = editor.value.slice(0, lineStart) + editor.value.slice(lineStart + 2);
      editor.selectionStart = editor.selectionEnd = Math.max(lineStart, start - 2);
    }
  }
  triggerInput(editor);
}

// ── Shortcuts modal ───────────────────────────────────────────────
$("shortcuts-btn").addEventListener("click", () => shortcutsModal.classList.remove("hidden"));
$("close-shortcuts").addEventListener("click", () => shortcutsModal.classList.add("hidden"));
shortcutsModal.addEventListener("click", e => { if (e.target === shortcutsModal) shortcutsModal.classList.add("hidden"); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    shortcutsModal.classList.add("hidden");
    searchInput.blur();
  }
});

// ── Today button ──────────────────────────────────────────────────
$("today-btn").addEventListener("click", () => navigateTo(todayISO()));

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  const today = todayISO();
  const [y, m] = today.split("-").map(Number);
  state.currentYear  = y;
  state.currentMonth = m - 1;
  state.currentDate  = today;

  entryDateLabel.textContent = fmtDateLabel(today);

  await loadEntryDates(y);
  renderCalendar();
  await loadEntry(today);
}

init();
