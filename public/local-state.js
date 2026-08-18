// Persistent local state (CR#6): per-tool preferences and a short recent-inputs history,
// all stored in the browser's own localStorage -- same "0 cookies, 0 trackers, nothing
// leaves your browser" model as theme.js and tile-order.js. Nothing here is sent anywhere;
// it only survives a refresh/revisit on the same device.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LocalStateLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var DEFAULT_MAX_RECENT = 5;

  // Pure: returns a NEW recent-values list with `value` pushed to the front, de-duplicated
  // (an existing equal entry is moved to the front rather than repeated) and capped at
  // `max` entries. Ignores empty/whitespace-only values -- nothing worth remembering.
  function pushRecent(list, value, max) {
    var cap = max || DEFAULT_MAX_RECENT;
    var existing = Array.isArray(list) ? list : [];
    if (typeof value !== 'string' || value.trim() === '') return existing.slice();
    var withoutDupe = existing.filter(function (v) { return v !== value; });
    var result = [value].concat(withoutDupe);
    return result.slice(0, cap);
  }

  // Impure: reads a simple (non-list) preference value, e.g. a select's chosen option.
  function loadPref(storageKey) {
    try {
      return localStorage.getItem(storageKey);
    } catch (e) {
      return null;
    }
  }

  // Impure: writes a simple preference value. Fails silently (storage unavailable/full) --
  // the tool still works for this page view, it just won't remember the choice next time.
  function savePref(storageKey, value) {
    try {
      localStorage.setItem(storageKey, value);
    } catch (e) { /* ignore */ }
  }

  // Impure: reads a recent-values list, defensive against anything (disabled storage, quota
  // errors, malformed JSON, a non-array value from some future/older format).
  function loadRecent(storageKey) {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  // Impure: writes a recent-values list. Fails silently, same reasoning as savePref.
  function saveRecent(storageKey, list) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  }

  // Impure: records `value` into the recent-values list stored at `storageKey` in one call
  // (read -> pushRecent -> write) -- the common case every tool page actually needs.
  function recordRecent(storageKey, value, max) {
    var updated = pushRecent(loadRecent(storageKey), value, max);
    saveRecent(storageKey, updated);
    return updated;
  }

  // Impure: populates a <select> element with the stored recent values for `storageKey`,
  // as a leading placeholder option plus one option per recent value (truncated for
  // display). No-op if there's no history yet. Wire the caller's own 'change' handler to
  // read `select.value` and load it into the real input -- this only handles populating
  // the list, not what happens when one is picked (that's tool-specific).
  function populateRecentSelect(select, storageKey, placeholderText) {
    if (!select) return;
    var recent = loadRecent(storageKey);
    select.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = recent.length ? (placeholderText || 'Recent...') : 'No recent inputs yet';
    select.appendChild(placeholder);
    recent.forEach(function (value) {
      var opt = document.createElement('option');
      opt.value = value;
      var preview = value.length > 40 ? value.slice(0, 40) + '…' : value;
      opt.textContent = preview.replace(/\s+/g, ' ');
      select.appendChild(opt);
    });
    select.disabled = recent.length === 0;
  }

  return {
    pushRecent,
    loadPref,
    savePref,
    loadRecent,
    saveRecent,
    recordRecent,
    populateRecentSelect,
  };
});
