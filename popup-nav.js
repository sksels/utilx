// Shared "open tool in a resizable pop-up window" logic for the homepage tool grid
// (CR#3 item #17). Loaded on index.html only, since it's the only page with tool cards.
//
// Confirmed product decisions (via AskUserQuestion before building):
//   - The popup includes the full site header/nav/footer, not just bare tool content.
//   - Every tool card keeps its normal href. JS intercepts the click to open a popup;
//     if popups are blocked, or JS never runs (crawlers, JS disabled), the plain href
//     still navigates normally -- so SEO and popup-blocked browsers are unaffected.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var lib = factory();
    root.PopupNavLib = lib;
    root.openToolPopup = lib.openToolPopup;
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // One shared default size across all 6 tools (960px content width + margin for
  // header/nav/footer chrome), rather than a per-tool size.
  var DEFAULT_WIDTH = 1040;
  var DEFAULT_HEIGHT = 800;
  var WINDOW_NAME = 'utilx-tool';

  // Pure: centers a popup of (popupWidth, popupHeight) on a screen of
  // (screenWidth, screenHeight), clamping to 0 so it never gets a negative offset on a
  // screen smaller than the popup itself.
  function computeCenteredPosition(screenWidth, screenHeight, popupWidth, popupHeight) {
    return {
      left: Math.max(0, Math.round((screenWidth - popupWidth) / 2)),
      top: Math.max(0, Math.round((screenHeight - popupHeight) / 2)),
    };
  }

  // Pure: builds the window.open() features string. resizable=yes is the whole point of
  // this backlog item; scrollbars=yes so tool content that's a bit tall still works.
  function buildFeaturesString(width, height, left, top) {
    return [
      'width=' + width,
      'height=' + height,
      'left=' + left,
      'top=' + top,
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
    ].join(',');
  }

  // Pure: decides whether a click should be intercepted for the popup, given the parts of
  // a MouseEvent we care about. Anything that signals "the user wants normal browser
  // behavior" (middle-click / ctrl / cmd / shift / alt -- all standard "open in new
  // tab/window" modifiers) is left alone rather than hijacked into a popup.
  function shouldIntercept(clickInfo) {
    clickInfo = clickInfo || {};
    if (clickInfo.button === 1) return false; // middle-click
    if (clickInfo.ctrlKey || clickInfo.metaKey || clickInfo.shiftKey || clickInfo.altKey) return false;
    return true;
  }

  // Impure: the actual click handler, wired via onclick="return openToolPopup(event, url)"
  // on each tool link. Returns false when it has handled navigation itself (so the
  // triggering onclick="return ..." suppresses the default), or true to let the browser's
  // normal <a href> navigation proceed untouched.
  function openToolPopup(event, url) {
    if (!shouldIntercept(event)) return true;

    var pos = computeCenteredPosition(
      screen.width, screen.height, DEFAULT_WIDTH, DEFAULT_HEIGHT
    );
    var features = buildFeaturesString(DEFAULT_WIDTH, DEFAULT_HEIGHT, pos.left, pos.top);

    var popup;
    try {
      popup = window.open(url, WINDOW_NAME, features);
    } catch (e) {
      popup = null;
    }

    if (!popup) {
      // Blocked by a popup blocker (or window.open threw) -- fall back to the plain href
      // the browser was already about to follow, so we don't leave the click doing nothing.
      return true;
    }

    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    popup.focus();
    return false;
  }

  return {
    DEFAULT_WIDTH, DEFAULT_HEIGHT, WINDOW_NAME,
    computeCenteredPosition, buildFeaturesString, shouldIntercept, openToolPopup,
  };
});
