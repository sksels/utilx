// CR#7 (Live Interaction, backlog #36): resizable side-by-side input/output split panes.
// On desktop widths, a tool's input and output sit side-by-side with a draggable divider
// between them instead of the current stacked (input above output) layout, and the chosen
// split ratio persists across visits via public/local-state.js. Falls back to the existing
// stacked layout on narrow/mobile viewports (see .split-pane's media query in style.css) --
// resizing two panes that are each already full-width and short on a phone screen isn't
// useful, so the divider is simply hidden there and flex-basis is overridden back to auto.
//
// Pure ratio math (clamp/ratioFromPointerX) is split out from the DOM-wiring init() so it's
// directly unit-testable without a DOM -- same reasoning as error-location.js/field-flash.js:
// keep anything that doesn't strictly need the DOM out of the code path that does.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SplitPaneLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var MIN_RATIO = 20;
  var MAX_RATIO = 80;
  var DEFAULT_RATIO = 50;
  var KEYBOARD_STEP = 4;

  function clamp(value, min, max) {
    if (typeof value !== 'number' || isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  // Given the container's left edge and width (a getBoundingClientRect(), effectively) and
  // the pointer's current clientX, returns the left-pane percentage (0-100, unclamped --
  // callers clamp separately so keyboard-step math can reuse the same clamp() call).
  function ratioFromPointerX(containerLeft, containerWidth, clientX) {
    if (!containerWidth) return DEFAULT_RATIO;
    return ((clientX - containerLeft) / containerWidth) * 100;
  }

  function applyRatio(leftEl, rightEl, ratio) {
    leftEl.style.flexBasis = ratio + '%';
    rightEl.style.flexBasis = (100 - ratio) + '%';
  }

  // Parses whatever public/local-state.js's loadPref() handed back into a valid starting
  // ratio. Pulled out as its own pure function (rather than inlined in init(), which needs a
  // DOM) specifically because of a real trap here: loadPref returns null -- not undefined --
  // when nothing is saved yet, and Number(null) is 0, NOT NaN. A naive `Number(loadPref(...))`
  // would therefore hand every first-time visitor a "valid" 0 that clamps to MIN_RATIO (a
  // lopsided 20/80 split) instead of the intended 50/50 default. Caught and fixed before this
  // shipped; kept as its own tested function so it can't quietly regress.
  function parseSavedRatio(loaded) {
    if (loaded === null || loaded === undefined || loaded === '') return DEFAULT_RATIO;
    var n = Number(loaded);
    return clamp(isNaN(n) ? DEFAULT_RATIO : n, MIN_RATIO, MAX_RATIO);
  }

  // container: the .split-pane element (flex row on desktop; see style.css for the narrow-
  //   viewport fallback that overrides this back to a stacked block layout).
  // leftEl/rightEl: the two panes (.split-pane-left / .split-pane-right).
  // dividerEl: the draggable handle between them (.split-divider) -- also keyboard-operable
  //   (ArrowLeft/ArrowRight/Home/End) since it's exposed as an ARIA separator.
  // storageKey: public/local-state.js pref key the chosen ratio persists under.
  function init(container, leftEl, rightEl, dividerEl, storageKey) {
    if (!container || !leftEl || !rightEl || !dividerEl) return;

    var loaded = (typeof LocalStateLib !== 'undefined' && storageKey)
      ? LocalStateLib.loadPref(storageKey)
      : null;
    var ratio = parseSavedRatio(loaded);
    applyRatio(leftEl, rightEl, ratio);

    function persist() {
      if (typeof LocalStateLib !== 'undefined' && storageKey) {
        LocalStateLib.savePref(storageKey, String(ratio));
      }
    }

    function setRatio(next) {
      ratio = clamp(next, MIN_RATIO, MAX_RATIO);
      applyRatio(leftEl, rightEl, ratio);
    }

    var dragging = false;

    function onPointerMove(clientX) {
      var rect = container.getBoundingClientRect();
      setRatio(ratioFromPointerX(rect.left, rect.width, clientX));
    }

    function stopDragging() {
      if (!dragging) return;
      dragging = false;
      dividerEl.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopDragging);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', stopDragging);
      persist();
    }

    function onMouseMove(e) { onPointerMove(e.clientX); }
    function onTouchMove(e) {
      if (e.touches && e.touches[0]) onPointerMove(e.touches[0].clientX);
    }

    function startDragging() {
      dragging = true;
      dividerEl.classList.add('dragging');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', stopDragging);
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', stopDragging);
    }

    dividerEl.addEventListener('mousedown', function (e) {
      e.preventDefault();
      startDragging();
    });
    dividerEl.addEventListener('touchstart', startDragging, { passive: true });

    // Standard keyboard behavior for an ARIA role="separator": arrow keys nudge the split,
    // Home/End jump to the resize limits. Needs its own focus/tabindex on dividerEl in the
    // markup -- this only wires the behavior once it's focused.
    dividerEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); setRatio(ratio - KEYBOARD_STEP); persist(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setRatio(ratio + KEYBOARD_STEP); persist(); }
      else if (e.key === 'Home') { e.preventDefault(); setRatio(MIN_RATIO); persist(); }
      else if (e.key === 'End') { e.preventDefault(); setRatio(MAX_RATIO); persist(); }
    });
  }

  return {
    init,
    clamp,
    ratioFromPointerX,
    parseSavedRatio,
    MIN_RATIO,
    MAX_RATIO,
    DEFAULT_RATIO,
  };
});
