// CR#8 #35 (backlog #232-236): command palette logic. Lazy-loaded only once a visitor opens
// the palette (see CommandPalette.astro's tiny always-on trigger script) -- everything in this
// file, plus Fuse.js and palette-data.json, costs zero bytes for visitors who never use it
// (backlog #70).
//
// Scope note (Aug 20 2026): search + keyboard nav + navigate only. Recently-used-first
// ordering (#64), "Paste & go" (#65), output-side quick actions (#66), a theme-toggle command
// (#67), and alias-boosted ranking (#68, though the alias data already exists on each tool's
// tools.json entry) are deliberately NOT wired in here -- logged as gradual sub-items of #35,
// picked up one at a time later. Tool-page quick actions (mirroring each tool's own
// input-toolbar buttons -- Format/Minify/Copy link/Clear etc.) are also out of this pass:
// every tool wires a different, bespoke set of global functions (encode()/decode()/
// formatJson()/generatePassword()/...), and wiring six tool-specific integrations correctly
// deserves its own dedicated pass and tests, not something to rush alongside the base palette.

let entriesPromise = null;
let fuseInstance = null;
let allEntries = [];

let backdropEl, inputEl, resultsEl;
let selectedIndex = -1;
let visibleResults = [];
let lastFocused = null;
let initialized = false;

function els() {
  if (!backdropEl) {
    backdropEl = document.getElementById('utilx-palette-backdrop');
    inputEl = document.getElementById('utilx-palette-input');
    resultsEl = document.getElementById('utilx-palette-results');
  }
  return { backdropEl, inputEl, resultsEl };
}

// Pure, unit-testable: shapes the raw palette-data.json payload into one flat, render-ready
// list. Exported for tests/command-palette.test.js -- everything else in this file touches
// the DOM directly and is covered by e2e instead (see e2e/command-palette.spec.js).
export function buildEntries(data) {
  const tools = (data && data.tools ? data.tools : []).map((t) => ({
    id: t.id,
    kind: 'tool',
    label: t.label,
    description: t.description,
    url: t.url,
    chipClass: t.chipClass,
    iconSvg: t.iconSvg,
  }));
  const guides = (data && data.guides ? data.guides : []).map((g) => ({
    id: g.id,
    kind: 'guide',
    label: g.label,
    description: g.description,
    url: g.url,
    chipClass: null,
    iconSvg: null,
  }));
  return tools.concat(guides);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function loadData() {
  if (!entriesPromise) {
    entriesPromise = Promise.all([
      import('/tools/lib/fuse.min.js').then((m) => m.default),
      fetch('/palette-data.json').then((r) => r.json()),
    ]).then(([Fuse, data]) => {
      allEntries = buildEntries(data);
      fuseInstance = new Fuse(allEntries, {
        keys: [
          { name: 'label', weight: 0.7 },
          { name: 'description', weight: 0.3 },
        ],
        threshold: 0.35,
      });
      return allEntries;
    });
  }
  return entriesPromise;
}

const GUIDE_ICON_SVG = '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5c.8 0 1.5-.7 1.5-1.5v-13Z"/>';

function rowHtml(entry, index) {
  const chip = entry.kind === 'tool'
    ? `<div class="tool-icon-chip ${entry.chipClass}"><svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${entry.iconSvg}</svg></div>`
    : `<div class="tool-icon-chip utilx-palette-guide-chip"><svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GUIDE_ICON_SVG}</svg></div>`;
  return `<div class="utilx-palette-row" role="option" id="utilx-palette-row-${index}" data-index="${index}" data-url="${entry.url}" aria-selected="${index === selectedIndex}">
    ${chip}
    <div class="utilx-palette-row-text">
      <span class="utilx-palette-row-label">${escapeHtml(entry.label)}</span>
      <span class="utilx-palette-row-desc">${escapeHtml(entry.description)}</span>
    </div>
    <span class="utilx-palette-row-kind">${entry.kind === 'tool' ? 'Tool' : 'Guide'}</span>
  </div>`;
}

function render(results) {
  const { resultsEl } = els();
  visibleResults = results;
  selectedIndex = results.length ? 0 : -1;
  if (!results.length) {
    resultsEl.innerHTML = '<p class="utilx-palette-empty">No matches. Try a different search term.</p>';
    return;
  }
  resultsEl.innerHTML = results.map(rowHtml).join('');
  attachRowHandlers();
}

function attachRowHandlers() {
  const { resultsEl } = els();
  resultsEl.querySelectorAll('.utilx-palette-row').forEach((row) => {
    row.addEventListener('click', () => navigateTo(row.dataset.url));
    row.addEventListener('mouseenter', () => {
      selectedIndex = Number(row.dataset.index);
      updateSelectionVisual();
    });
  });
}

function updateSelectionVisual() {
  const { resultsEl } = els();
  resultsEl.querySelectorAll('.utilx-palette-row').forEach((row) => {
    const isSelected = Number(row.dataset.index) === selectedIndex;
    row.setAttribute('aria-selected', String(isSelected));
    if (isSelected) row.scrollIntoView({ block: 'nearest' });
  });
}

function navigateTo(url) {
  if (!url) return;
  window.location.href = url;
}

function search(query) {
  if (!fuseInstance) return;
  const q = query.trim();
  const results = q ? fuseInstance.search(q).map((r) => r.item) : allEntries;
  render(results);
}

function onKeydown(e) {
  const { backdropEl, inputEl } = els();
  if (backdropEl.hidden) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closePalette();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (visibleResults.length) {
      selectedIndex = (selectedIndex + 1) % visibleResults.length;
      updateSelectionVisual();
    }
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (visibleResults.length) {
      selectedIndex = (selectedIndex - 1 + visibleResults.length) % visibleResults.length;
      updateSelectionVisual();
    }
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const entry = visibleResults[selectedIndex];
    if (entry) navigateTo(entry.url);
    return;
  }
  if (e.key === 'Tab') {
    // Minimal focus trap: results are click/hover-activated, not tab-stops, so the search
    // input is the only meaningfully focusable element inside the dialog today. Keep focus on
    // it rather than letting Tab escape to the page behind the backdrop.
    e.preventDefault();
    inputEl.focus();
  }
}

function onInput(e) {
  search(e.target.value);
}

function onBackdropClick(e) {
  if (e.target && e.target.id === 'utilx-palette-backdrop') closePalette();
}

function ensureInit() {
  if (initialized) return;
  const { backdropEl, inputEl } = els();
  if (!backdropEl) return;
  inputEl.addEventListener('input', onInput);
  backdropEl.addEventListener('click', onBackdropClick);
  initialized = true;
}

export function openPalette() {
  ensureInit();
  const { backdropEl, inputEl } = els();
  if (!backdropEl) return;
  lastFocused = document.activeElement;
  backdropEl.hidden = false;
  document.addEventListener('keydown', onKeydown);
  loadData().then(() => {
    render(allEntries);
    inputEl.value = '';
    inputEl.focus();
  });
}

export function closePalette() {
  const { backdropEl } = els();
  if (!backdropEl || backdropEl.hidden) return;
  backdropEl.hidden = true;
  document.removeEventListener('keydown', onKeydown);
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
}

// Guarded so this module can be imported under Node (tests/command-palette.test.js) to unit
// test the pure buildEntries() export above without a DOM -- everything else in this file is
// covered by e2e instead (see e2e/command-palette.spec.js).
if (typeof document !== 'undefined') {
  ensureInit();
}
