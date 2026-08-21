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

let backdropEl, inputEl, resultsEl, paletteEl, dragHandleEl;
let selectedIndex = -1;
let visibleResults = [];
let lastFocused = null;
let initialized = false;
let dragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
// Real bug, caught by CI's first-ever run of this file (Aug 21 2026): ArrowDown/ArrowUp
// pressed before palette-data.json/Fuse.js have finished loading were silently dropped
// (visibleResults is still [] at that point, so onKeydown's nav branch no-ops), and then
// render()'s initial call unconditionally reset selectedIndex to 0 once data DID arrive --
// erasing the keypress entirely. Only reachable on the first open of a session (later opens
// reuse the cached entriesPromise and resolve near-instantly), but a real race a fast
// keyboard user or a slow connection could hit. Recorded here and replayed once data loads.
let pendingInitialNavDelta = 0;

function els() {
  if (!backdropEl) {
    backdropEl = document.getElementById('utilx-palette-backdrop');
    inputEl = document.getElementById('utilx-palette-input');
    resultsEl = document.getElementById('utilx-palette-results');
    paletteEl = document.getElementById('utilx-palette');
    dragHandleEl = document.getElementById('utilx-palette-drag-handle');
  }
  return { backdropEl, inputEl, resultsEl, paletteEl, dragHandleEl };
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
        // 0.35 (Fuse's own suggested "fairly permissive" default) was too loose in practice --
        // live-verification (Aug 21 2026) found "cron" matching Color Converter and Password &
        // UUID Generator, neither of which has anything to do with cron. Tuned empirically
        // against every tool/guide label+description in src/data/*.json: 0.2 is the tightest
        // value that still keeps every intended match (including single-word ones like "uuid")
        // while dropping the false positives. See e2e/command-palette.spec.js's filtering test.
        threshold: 0.2,
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
    row.addEventListener('click', () => activateEntry(visibleResults[Number(row.dataset.index)]));
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

// Site owner call (Aug 20 2026): selecting a result opens the tool the same way clicking a
// homepage tile does -- window.openToolPopup (public/popup-nav.js), not a plain navigation of
// the current page. Only 'tool' entries get the popup treatment, matching the homepage (only
// tool tiles are popup-triggering there; the "Guide: X ->" links on each tile are plain
// navigation, and guides aren't in the tile grid at all). openToolPopup expects a MouseEvent
// to read modifier keys off of (middle-click/ctrl/cmd/shift/alt all mean "let this navigate
// normally instead") -- passing {} here means none of those are set, so it always attempts
// the popup, which is what a keyboard/click selection from the palette should do. It returns
// false when it successfully opened the popup (handled), or true when it did not intercept
// (blocked by a popup blocker, here, since {} can never trigger the modifier-key path) -- in
// that true case we fall back to a plain navigation so the click still does something.
function activateEntry(entry) {
  if (!entry || !entry.url) return;
  if (entry.kind === 'tool' && typeof window.openToolPopup === 'function') {
    const notIntercepted = window.openToolPopup({}, entry.url);
    if (notIntercepted) window.location.href = entry.url;
  } else {
    window.location.href = entry.url;
  }
  closePalette();
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
    } else {
      pendingInitialNavDelta += 1;
    }
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (visibleResults.length) {
      selectedIndex = (selectedIndex - 1 + visibleResults.length) % visibleResults.length;
      updateSelectionVisual();
    } else {
      pendingInitialNavDelta -= 1;
    }
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const entry = visibleResults[selectedIndex];
    if (entry) activateEntry(entry);
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

// Site owner call (Aug 20 2026): draggable, not fixed. The dialog starts centered/top-anchored
// via the backdrop's own flexbox layout (see style.css) -- position:fixed only gets applied
// here, at drag-start, once the user actually grabs the handle, so a visitor who never drags
// it sees no behavior change at all. Position resets to the CSS default on every re-open
// (see openPalette() below) rather than persisting across opens -- simplest v1 behavior;
// persisting the last dragged position (e.g. via sessionStorage) is a reasonable future
// enhancement, not assumed here.
function onDragStart(e) {
  const { paletteEl } = els();
  if (!paletteEl) return;
  e.preventDefault();
  const rect = paletteEl.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  paletteEl.style.position = 'fixed';
  paletteEl.style.margin = '0';
  paletteEl.style.left = rect.left + 'px';
  paletteEl.style.top = rect.top + 'px';
  dragging = true;
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!dragging) return;
  const { paletteEl } = els();
  const maxLeft = window.innerWidth - paletteEl.offsetWidth;
  const maxTop = window.innerHeight - paletteEl.offsetHeight;
  const newLeft = Math.max(0, Math.min(e.clientX - dragOffsetX, maxLeft));
  const newTop = Math.max(0, Math.min(e.clientY - dragOffsetY, maxTop));
  paletteEl.style.left = newLeft + 'px';
  paletteEl.style.top = newTop + 'px';
}

function onDragEnd() {
  dragging = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

function resetDragPosition() {
  const { paletteEl } = els();
  if (!paletteEl) return;
  paletteEl.style.position = '';
  paletteEl.style.left = '';
  paletteEl.style.top = '';
  paletteEl.style.margin = '';
}

function ensureInit() {
  if (initialized) return;
  const { backdropEl, inputEl, dragHandleEl } = els();
  if (!backdropEl) return;
  inputEl.addEventListener('input', onInput);
  backdropEl.addEventListener('click', onBackdropClick);
  if (dragHandleEl) dragHandleEl.addEventListener('mousedown', onDragStart);
  initialized = true;
}

export function openPalette() {
  ensureInit();
  const { backdropEl, inputEl } = els();
  if (!backdropEl) return;
  resetDragPosition();
  lastFocused = document.activeElement;
  backdropEl.hidden = false;
  pendingInitialNavDelta = 0;
  document.addEventListener('keydown', onKeydown);
  loadData().then(() => {
    render(allEntries);
    if (pendingInitialNavDelta !== 0 && visibleResults.length) {
      const len = visibleResults.length;
      selectedIndex = ((selectedIndex + pendingInitialNavDelta) % len + len) % len;
      updateSelectionVisual();
    }
    pendingInitialNavDelta = 0;
    inputEl.value = '';
    inputEl.focus();
  });
}

export function closePalette() {
  const { backdropEl } = els();
  if (!backdropEl || backdropEl.hidden) return;
  backdropEl.hidden = true;
  document.removeEventListener('keydown', onKeydown);
  // Defensive: if Escape/backdrop-click/activateEntry fires mid-drag (e.g. dragged onto a
  // palette row, then Enter), make sure the drag's own document-level listeners don't outlive
  // the dialog closing.
  onDragEnd();
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
}

// Guarded so this module can be imported under Node (tests/command-palette.test.js) to unit
// test the pure buildEntries() export above without a DOM -- everything else in this file is
// covered by e2e instead (see e2e/command-palette.spec.js).
if (typeof document !== 'undefined') {
  ensureInit();
}
