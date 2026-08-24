// CR#8 backlog #32: pure pattern-matching for "smart clipboard injection" -- given a raw
// string (whatever's on the user's clipboard), decides whether it looks enough like one of
// UtilX's tool inputs to be worth suggesting, and which tool. No DOM/clipboard access here --
// see public/clipboard-suggest.js for the homepage wiring (reading the clipboard, showing the
// suggestion toast). Kept separate and pure specifically so the actual matching logic is
// testable head-on (tests/clipboard-detect.test.js) without needing to fake
// navigator.clipboard or a DOM at all, the same split this project already uses for every
// other tool's core logic (ColorLib, CronLib, Base64Lib, etc.).
//
// Deliberately precision-over-recall: every pattern below is chosen to have a low false-positive
// rate even at the cost of missing some real matches (e.g. hex color detection requires a
// leading "#" -- a bare "a1b2c3" is exactly as likely to be a git short-SHA, a random ID, or
// any other 6-hex-character token as it is to be a color, so it's deliberately NOT matched
// without the "#" that actually marks it as a color in CSS). A wrong suggestion is worse than
// a missed one: it's shown unprompted, right when the user arrives, before they've indicated
// they want anything from this site at all.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      typeof require === 'function' ? require('./cron.js') : root.CronLib,
      typeof require === 'function' ? require('./color.js') : root.ColorLib,
      typeof require === 'function' ? require('./base64.js') : root.Base64Lib
    );
  } else {
    root.ClipboardDetectLib = factory(root.CronLib, root.ColorLib, root.Base64Lib);
  }
})(typeof self !== 'undefined' ? self : this, function (CronLib, ColorLib, Base64Lib) {

  // Below this length, matching against JSON/cron/hex/base64 is dominated by coincidence --
  // e.g. "1234" parses as valid JSON (a bare number), "* * * * *" is a plausible-but-almost-
  // certainly-accidental cron match if someone just copied five asterisks. Real clipboard
  // content worth suggesting a tool for is essentially never this short.
  const MIN_LENGTH = 6;
  // Suggesting a tool for genuinely huge clipboard content (someone copied an entire file)
  // is more likely to feel intrusive than helpful, and JSON.parse/atob on a multi-megabyte
  // string on every window focus is wasted work for a case that's not the common one this
  // feature targets ("I just copied a short JSON blob / cron line / hex code / base64 token").
  const MAX_LENGTH = 20000;

  function isJwtLike(text) {
    if (!Base64Lib || typeof Base64Lib.decodeJwt !== 'function') return false;
    try {
      Base64Lib.decodeJwt(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isJsonLike(text) {
    const trimmed = text.trim();
    if (trimmed[0] !== '{' && trimmed[0] !== '[') return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isCronLike(text) {
    if (!CronLib || typeof CronLib.validateBuildFields !== 'function') return false;
    const fields = text.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    return CronLib.validateBuildFields(fields[0], fields[1], fields[2], fields[3], fields[4]).length === 0;
  }

  function isHexColorLike(text) {
    if (!ColorLib || typeof ColorLib.hexToRgb !== 'function') return false;
    const trimmed = text.trim();
    if (trimmed[0] !== '#') return false;
    return ColorLib.hexToRgb(trimmed) !== null;
  }

  const BASE64_CHARSET_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;

  function isBase64Like(text) {
    if (!Base64Lib || typeof Base64Lib.decodeBase64ToUtf8 !== 'function') return false;
    const trimmed = text.trim();
    // Requires real length and no whitespace/line-breaks -- genuine copy-pasted Base64 tokens
    // (API keys, encoded payloads, etc.) are one unbroken run of the Base64 alphabet; anything
    // with internal whitespace is far more likely to be prose that merely happens to contain
    // some base64-alphabet-safe words.
    if (trimmed.length < 16 || /\s/.test(trimmed)) return false;
    if (!BASE64_CHARSET_RE.test(trimmed)) return false;
    try {
      Base64Lib.decodeBase64ToUtf8(trimmed);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Ordered most-specific-first: a JWT is also technically 3 base64url segments, and valid
  // JSON's characters are a subset of what the base64 charset regex would accept too (digits,
  // braces excluded, but short numeric/array JSON could slip through) -- checking narrower,
  // more structurally-specific patterns before the broad base64 catch-all avoids the specific
  // match losing to the generic one. Hex color is deliberately NOT in this list -- see
  // detectToolForText below for why it's checked separately, ahead of the MIN_LENGTH gate.
  const MATCHERS = [
    { test: isJwtLike, toolId: 'base64-tool', url: '/tools/base64-tool.html', label: 'a JWT' },
    { test: isJsonLike, toolId: 'json-formatter', url: '/tools/json-formatter.html', label: 'JSON' },
    { test: isCronLike, toolId: 'cron-builder', url: '/tools/cron-builder.html', label: 'a cron expression' },
    { test: isBase64Like, toolId: 'base64-tool', url: '/tools/base64-tool.html', label: 'Base64' },
  ];

  // Returns { toolId, url, label } for the first (most specific) matcher that accepts the
  // text, or null if nothing matched -- including for empty/whitespace-only/oversized input,
  // which is intentionally rejected up front rather than relying on every individual matcher
  // to separately guard against it.
  function detectToolForText(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (trimmed.length === 0) return null;

    // Checked ahead of the MIN_LENGTH gate below: ColorLib.hexToRgb() already fully
    // constrains what counts as a match on its own (exactly 4, 5, 7, or 9 characters
    // including the leading "#", valid hex digits only) -- MIN_LENGTH exists to stop short
    // *coincidental* matches in the length-agnostic checks that follow (JSON, cron, base64),
    // not to reject genuinely short, valid colors like "#fff"/"#000" (4 characters).
    if (isHexColorLike(trimmed)) {
      return { toolId: 'color-converter', url: '/tools/color-converter.html', label: 'a hex color' };
    }

    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return null;
    for (let i = 0; i < MATCHERS.length; i++) {
      if (MATCHERS[i].test(trimmed)) {
        const { toolId, url, label } = MATCHERS[i];
        return { toolId, url, label };
      }
    }
    return null;
  }

  return { detectToolForText };
});
