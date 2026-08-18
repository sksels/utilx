// User-customizable tile layout (backlog #6): lets the user drag-and-drop the homepage tool
// tiles into whatever order they want, persisted in localStorage so it survives reloads.
// Nothing is sent anywhere -- same "0 cookies, 0 trackers" model as the rest of the site.
// See tests/tile-order.test.js for the pure-function tests (normalizeOrder, moveBefore).
//
// Known limitation, stated plainly: this uses the native HTML5 drag-and-drop API
// (draggable="true" + dragstart/dragover/drop events). That API has patchy touch support on
// some mobile browsers (notably iOS Safari does not fire HTML5 drag events for a plain
// touch-drag on an element). On a device/browser where dragging doesn't work, the tiles
// simply stay in their default order -- nothing breaks, it just isn't reorderable there.
// A full custom touch-drag implementation was out of scope for this pass.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TileOrderLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var STORAGE_KEY = 'utilx-tile-order';

  // Pure: reconciles a stored order against the current set of tiles that actually exist.
  // Handles every messy real-world case a stored value can arrive in:
  //  - not an array at all (corrupted/old-format localStorage value) -> ignored entirely
  //  - missing some current tile ids (a new tool was added since the order was saved) ->
  //    those get appended at the end, in their default order
  //  - containing ids that no longer exist (a tool was removed/renamed) -> silently dropped
  //  - containing duplicate ids -> de-duplicated (first occurrence wins)
  function normalizeOrder(defaultIds, storedIds) {
    if (!Array.isArray(storedIds)) return defaultIds.slice();
    var defaultSet = {};
    defaultIds.forEach(function (id) { defaultSet[id] = true; });
    var seen = {};
    var result = [];
    storedIds.forEach(function (id) {
      if (defaultSet[id] && !seen[id]) {
        result.push(id);
        seen[id] = true;
      }
    });
    defaultIds.forEach(function (id) {
      if (!seen[id]) result.push(id);
    });
    return result;
  }

  // Pure: returns a NEW order array with movedId relocated to sit immediately before
  // targetId. No-ops (returns a copy of the original) if movedId === targetId or if
  // targetId isn't present in the order.
  function moveBefore(order, movedId, targetId) {
    if (movedId === targetId) return order.slice();
    var without = order.filter(function (id) { return id !== movedId; });
    var idx = without.indexOf(targetId);
    if (idx === -1) return order.slice();
    without.splice(idx, 0, movedId);
    return without;
  }

  // Impure: localStorage read, defensive against anything (disabled storage, quota errors,
  // malformed JSON, a non-array value from some future/older format).
  function readStoredOrder(storageKey) {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  // Impure: localStorage write, fails silently (order just won't persist this time).
  function writeStoredOrder(order, storageKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(order));
    } catch (e) { /* storage unavailable/full -- reordering still works for this page view */ }
  }

  // Impure: reorders the actual DOM children of `grid` to match `order`. appendChild on a
  // node that's already in the document MOVES it rather than cloning/duplicating it, so
  // calling this repeatedly (once per id, in the desired final order) produces exactly the
  // right final DOM order in one pass.
  function applyOrderToGrid(grid, order) {
    order.forEach(function (id) {
      var card = grid.querySelector('[data-tool-id="' + id + '"]');
      if (card) grid.appendChild(card);
    });
  }

  // Impure: wires up drag-and-drop on `grid`. Reorders live as you drag over another tile
  // (not just on drop) so the layout preview updates immediately, then persists the final
  // order once the drag ends.
  function initTileOrder(grid, storageKey) {
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.children);
    var defaultIds = cards.map(function (c) { return c.dataset.toolId; });
    var order = normalizeOrder(defaultIds, readStoredOrder(storageKey));
    applyOrderToGrid(grid, order);

    var draggedId = null;

    grid.addEventListener('dragstart', function (e) {
      var card = e.target.closest ? e.target.closest('.tool-card') : null;
      if (!card) return;
      draggedId = card.dataset.toolId;
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', draggedId);
        e.dataTransfer.effectAllowed = 'move';
      }
      card.classList.add('dragging');
    });

    grid.addEventListener('dragend', function (e) {
      var card = e.target.closest ? e.target.closest('.tool-card') : null;
      if (card) card.classList.remove('dragging');
      if (draggedId) {
        var finalOrder = Array.prototype.slice.call(grid.children).map(function (c) { return c.dataset.toolId; });
        writeStoredOrder(finalOrder, storageKey);
      }
      draggedId = null;
    });

    grid.addEventListener('dragover', function (e) {
      e.preventDefault(); // required to allow a drop to fire at all
      if (!draggedId) return;
      var overCard = e.target.closest ? e.target.closest('.tool-card') : null;
      if (!overCard || overCard.dataset.toolId === draggedId) return;
      var currentOrder = Array.prototype.slice.call(grid.children).map(function (c) { return c.dataset.toolId; });
      var newOrder = moveBefore(currentOrder, draggedId, overCard.dataset.toolId);
      applyOrderToGrid(grid, newOrder);
    });

    grid.addEventListener('drop', function (e) {
      e.preventDefault();
    });
  }

  // Impure: clears the saved order and restores tiles to `defaultIds`. Wired to a "Reset
  // tile order" button.
  function resetTileOrder(grid, storageKey, defaultIds) {
    try { localStorage.removeItem(storageKey); } catch (e) { /* ignore */ }
    applyOrderToGrid(grid, defaultIds);
  }

  return {
    STORAGE_KEY,
    normalizeOrder,
    moveBefore,
    readStoredOrder,
    writeStoredOrder,
    applyOrderToGrid,
    initTileOrder,
    resetTileOrder,
  };
});
