// Pure color-conversion and WCAG-contrast logic shared by tools/color-converter.html
// and tests/color.test.js. No DOM/canvas access here.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ColorLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Accepts 3-digit (#rgb), 4-digit (#rgba), 6-digit (#rrggbb), and 8-digit (#rrggbbaa)
  // hex. Only 4- and 8-digit forms (i.e. ones that actually carry an alpha channel) return
  // an `a` key (0-1, rounded to 2 decimals) -- 3- and 6-digit input returns exactly the
  // same { r, g, b } shape as before, so existing opaque-color callers are unaffected.
  function hexToRgb(hex) {
    hex = hex.replace('#','').trim();
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c+c).join('');
    if (hex.length === 6) {
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
      const num = parseInt(hex, 16);
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }
    if (hex.length === 8) {
      if (!/^[0-9a-fA-F]{8}$/.test(hex)) return null;
      const num = parseInt(hex, 16) >>> 0; // treat as unsigned 32-bit
      return {
        r: (num >>> 24) & 255,
        g: (num >>> 16) & 255,
        b: (num >>> 8) & 255,
        a: Math.round(((num & 255) / 255) * 100) / 100,
      };
    }
    return null;
  }

  // `a` (0-1) is optional -- omit it (or pass undefined) for a plain 6-digit hex, exactly
  // matching the previous 3-argument behavior. Passing a number appends a 2-digit alpha
  // byte for an 8-digit #rrggbbaa hex.
  function rgbToHex(r, g, b, a) {
    const base = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    if (a === undefined || a === null) return base;
    const alphaByte = Math.round(Math.max(0, Math.min(1, a)) * 255);
    return base + alphaByte.toString(16).padStart(2,'0');
  }

  // Composites a possibly-translucent color over a white backdrop, returning an opaque
  // { r, g, b }. Used so the WCAG contrast checker can produce a meaningful ratio for
  // translucent colors -- contrast is only rigorously defined for opaque colors, and
  // white is the simplest, most common assumption for "what's actually behind this".
  // Colors with no alpha (or alpha === 1) pass through unchanged.
  function compositeOverWhite(rgb) {
    if (rgb.a === undefined || rgb.a === null || rgb.a >= 1) {
      return { r: rgb.r, g: rgb.g, b: rgb.b };
    }
    const a = rgb.a;
    return {
      r: Math.round(rgb.r * a + 255 * (1 - a)),
      g: Math.round(rgb.g * a + 255 * (1 - a)),
      b: Math.round(rgb.b * a + 255 * (1 - a)),
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
  }

  function relativeLuminance(r, g, b) {
    const toLinear = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const rl = toLinear(r), gl = toLinear(g), bl = toLinear(b);
    return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  }

  function contrastRatio(rgb1, rgb2) {
    const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Parses an "r, g, b" / "rgb(r, g, b)" string, with an optional 4th alpha component
  // ("r, g, b, a" / "rgba(r, g, b, a)"). The whole (unwrapped) string must be *just* three
  // integers 0-255 (and, if present, an alpha 0-1) -- anchored matching, not a loose
  // search, so this correctly rejects negative numbers ("-5, 100, 100"), decimals in the
  // r/g/b channels ("91.5, 140, 255"), an out-of-range or malformed alpha, and non-color
  // text that merely happens to contain a valid-looking substring ("foo91, 140, 255bar").
  // The `a` key is only present on the returned object when an alpha component was given.
  function parseRgbString(value) {
    const str = String(value).trim();
    const wrapped = str.match(/^rgba?\(([\s\S]*)\)$/i);
    const body = (wrapped ? wrapped[1] : str).trim();
    const m = body.match(/^(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?$/);
    if (!m) return null;
    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
    if (r > 255 || g > 255 || b > 255) return null;
    const result = { r, g, b };
    if (m[4] !== undefined) {
      const a = Number(m[4]);
      if (!(a >= 0 && a <= 1)) return null;
      result.a = a;
    }
    return result;
  }

  // Parses an "h, s%, l%" / "hsl(h, s%, l%)" string, with an optional 4th alpha component
  // ("h, s%, l%, a" / "hsla(...)"). Same anchored-match and alpha-validation discipline as
  // parseRgbString: hue must be 0-360, saturation/lightness 0-100, alpha (if given) 0-1.
  function parseHslString(value) {
    const str = String(value).trim();
    const wrapped = str.match(/^hsla?\(([\s\S]*)\)$/i);
    const body = (wrapped ? wrapped[1] : str).trim();
    const m = body.match(/^(\d+)[,\s]+(\d+)%?[,\s]+(\d+)%?(?:[,\s]+([\d.]+))?$/);
    if (!m) return null;
    const h = Number(m[1]), s = Number(m[2]), l = Number(m[3]);
    if (h > 360 || s > 100 || l > 100) return null;
    const result = { h, s, l };
    if (m[4] !== undefined) {
      const a = Number(m[4]);
      if (!(a >= 0 && a <= 1)) return null;
      result.a = a;
    }
    return result;
  }

  function parseAnyColor(value) {
    let rgb = hexToRgb(value);
    if (rgb) return rgb;
    return parseRgbString(value);
  }

  return {
    hexToRgb, rgbToHex, rgbToHsl, hslToRgb,
    relativeLuminance, contrastRatio, parseAnyColor,
    parseRgbString, parseHslString, compositeOverWhite,
  };
});
