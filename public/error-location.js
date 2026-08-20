// CR#7 (Live Interaction, backlog #40): pure position-extraction logic for "inline
// error-location mapping" -- instead of just showing JSON.parse's error message as text,
// tools using this can jump the field's cursor/selection to the exact character the engine
// flagged and flash the field's border, so the user sees *where* the problem is, not just
// that there is one. No DOM access here (environment-agnostic, same pattern as the other
// tools/lib/*.js files) so it's directly unit-testable and reusable by any tool whose errors
// come from a JS engine exception with a position/line/column embedded in .message.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ErrorLocationLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // 1-based line, 1-based column -- matches how engines/editors report positions, not
  // 0-based array indexing. `index` is a 0-based character offset into `text`.
  function lineColumnAt(text, index) {
    let line = 1;
    let lastNewline = -1;
    const clamped = Math.max(0, Math.min(index, text.length));
    for (let i = 0; i < clamped; i++) {
      if (text[i] === '\n') {
        line++;
        lastNewline = i;
      }
    }
    return { line, column: clamped - lastNewline };
  }

  // Inverse of lineColumnAt: 1-based line/column -> 0-based character offset into `text`.
  function indexAt(text, line, column) {
    let currentLine = 1;
    let i = 0;
    while (currentLine < line && i < text.length) {
      if (text[i] === '\n') currentLine++;
      i++;
    }
    return Math.min(i + Math.max(0, column - 1), text.length);
  }

  // Tries to read a character position straight out of a JS engine's error message, before
  // falling back to findJsonSyntaxError's own scan (see below). Two message formats handled,
  // covering the browser engines in real use here:
  //   V8 (Chrome/Edge/Node): "...in JSON at position 45" -- a raw character offset. Also
  //     sometimes includes "(line 3 column 12)" directly in the same message.
  //   SpiderMonkey (Firefox): "...at line 3 column 12 of the JSON data" -- line/column given
  //     directly, with no raw offset.
  // Real-world caveat that's the actual reason findJsonSyntaxError exists at all: as of the
  // V8 version this was built against, only SOME error types include a position at all --
  // confirmed live, "Expected property name... in JSON at position 1 (line 1 column 2)" has
  // one, but the (very common) "Unexpected token 'x', "..." is not valid JSON" format does
  // not include any position, line, or column -- just a truncated snippet of context. That
  // covers a large share of everyday mistakes (trailing commas, unquoted keys, stray
  // "undefined"), so relying on message-parsing alone would silently fail to locate most
  // real errors users actually hit.
  function locateFromMessage(message, text) {
    if (typeof message !== 'string' || typeof text !== 'string') return null;

    const positionMatch = message.match(/position (\d+)/i);
    if (positionMatch) {
      const index = Math.min(Number(positionMatch[1]), text.length);
      const loc = lineColumnAt(text, index);
      return { index, line: loc.line, column: loc.column };
    }

    const lineColMatch = message.match(/line (\d+) column (\d+)/i);
    if (lineColMatch) {
      const line = Number(lineColMatch[1]);
      const column = Number(lineColMatch[2]);
      return { index: indexAt(text, line, column), line, column };
    }

    return null;
  }

  // A small hand-rolled JSON scanner used ONLY as a position-finding fallback -- JSON.parse
  // itself still does the real, spec-correct parsing everywhere in this codebase; this never
  // replaces it. It exists purely to answer "where, character-wise, does this text stop
  // looking like valid JSON," for the message formats locateFromMessage can't read a
  // position out of. Deliberately not a fully exhaustive JSON-spec validator -- it's scoped
  // to precisely catch the mistakes people actually make (trailing commas, missing/extra
  // commas or colons, unquoted or single-quoted strings, unterminated strings, invalid
  // literals like `undefined`, unmatched brackets) rather than every conceivable malformed
  // byte sequence. If it ever hits a case it doesn't handle, it throws like a normal parser
  // failure would -- findJsonSyntaxError catches that and returns null, same safe no-op as
  // an unrecognized message: no location shown, the original text error message still is.
  function findJsonSyntaxError(text) {
    let i = 0;
    const len = text.length;

    function isDigit(c) { return c >= '0' && c <= '9'; }
    function skipWs() { while (i < len && /\s/.test(text[i])) i++; }

    function fail(atIndex) {
      const idx = typeof atIndex === 'number' ? atIndex : i;
      throw { atIndex: idx };
    }

    function parseValue() {
      skipWs();
      if (i >= len) fail();
      const c = text[i];
      if (c === '{') return parseObject();
      if (c === '[') return parseArray();
      if (c === '"') return parseString();
      if (c === '-' || isDigit(c)) return parseNumber();
      if (text.startsWith('true', i)) { i += 4; return; }
      if (text.startsWith('false', i)) { i += 5; return; }
      if (text.startsWith('null', i)) { i += 4; return; }
      fail();
    }

    function parseString() {
      const start = i;
      i++; // opening quote
      for (;;) {
        if (i >= len) fail(start);
        const c = text[i];
        if (c === '"') { i++; return; }
        if (c === '\\') {
          i++;
          if (i >= len) fail(start);
          const esc = text[i];
          if (esc === 'u') {
            if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) fail(i - 1);
            i += 5;
          } else if ('"\\/bfnrt'.indexOf(esc) !== -1) {
            i++;
          } else {
            fail(i - 1);
          }
          continue;
        }
        if (c.charCodeAt(0) < 0x20) fail(i); // unescaped control character
        i++;
      }
    }

    function parseDigits() {
      const start = i;
      while (i < len && isDigit(text[i])) i++;
      if (i === start) fail(start);
    }

    function parseNumber() {
      const start = i;
      if (text[i] === '-') i++;
      if (text[i] === '0') {
        i++;
      } else if (isDigit(text[i])) {
        while (i < len && isDigit(text[i])) i++;
      } else {
        fail(start);
      }
      if (text[i] === '.') { i++; parseDigits(); }
      if (text[i] === 'e' || text[i] === 'E') {
        i++;
        if (text[i] === '+' || text[i] === '-') i++;
        parseDigits();
      }
    }

    function parseObject() {
      i++; // {
      skipWs();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        skipWs();
        if (text[i] !== '"') fail();
        parseString();
        skipWs();
        if (text[i] !== ':') fail();
        i++;
        parseValue();
        skipWs();
        if (text[i] === ',') {
          i++;
          skipWs();
          if (text[i] === '}') fail(i); // trailing comma
          continue;
        }
        if (text[i] === '}') { i++; return; }
        fail();
      }
    }

    function parseArray() {
      i++; // [
      skipWs();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        parseValue();
        skipWs();
        if (text[i] === ',') {
          i++;
          skipWs();
          if (text[i] === ']') fail(i); // trailing comma
          continue;
        }
        if (text[i] === ']') { i++; return; }
        fail();
      }
    }

    try {
      parseValue();
      skipWs();
      if (i < len) fail();
      return null; // the scanner thinks this is valid JSON -- shouldn't normally be reached
                    // since callers only invoke this after JSON.parse already threw, but a
                    // safe no-op (no location) rather than a false claim if it happens.
    } catch (e) {
      if (e && typeof e.atIndex === 'number') {
        const index = Math.min(e.atIndex, text.length);
        const loc = lineColumnAt(text, index);
        return { index, line: loc.line, column: loc.column };
      }
      return null; // a bug in the scanner itself shouldn't take the whole feature down --
                    // degrade to "no location," not a thrown error the caller has to guard.
    }
  }

  // Given a JS engine error message (JSON.parse SyntaxError, etc.) and the original text it
  // was parsing, returns { index, line, column } for where the problem is, or null if
  // nothing could be determined either way. Tries the cheap, exact path first (reading a
  // position straight out of the message) and only falls back to scanning the text itself
  // when the message doesn't expose one.
  function locateJsonError(message, text) {
    if (typeof text !== 'string') return null;
    return locateFromMessage(message, text) || findJsonSyntaxError(text);
  }

  return {
    lineColumnAt,
    indexAt,
    locateFromMessage,
    findJsonSyntaxError,
    locateJsonError,
  };
});
