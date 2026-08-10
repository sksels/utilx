// Pure color-conversion and WCAG-contrast logic shared by tools/color-converter.html
// and tests/color.test.js. No DOM/canvas access here.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ColorLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function hexToRgb(hex) {
    hex = hex.replace('#','').trim();
    if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
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

  // Parses an "r, g, b" or "rgb(r, g, b)" string. The whole (unwrapped) string must be
  // *just* three integers, 0-255 each -- anchored matching, not a loose search, so this
  // correctly rejects negative numbers ("-5, 100, 100"), decimals ("91.5, 140, 255"),
  // extra components like an alpha channel ("91, 140, 255, 0.5"), and non-color text
  // that merely happens to contain a valid-looking substring ("foo91, 140, 255bar").
  // Un-anchored matching previously let all of these silently through.
  function parseRgbString(value) {
    const str = String(value).trim();
    const wrapped = str.match(/^rgba?\(([\s\S]*)\)$/i);
    const body = (wrapped ? wrapped[1] : str).trim();
    const m = body.match(/^(\d+)[,\s]+(\d+)[,\s]+(\d+)$/);
    if (!m) return null;
    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
    if (r > 255 || g > 255 || b > 255) return null;
    return { r, g, b };
  }

  // Parses an "h, s%, l%" or "hsl(h, s%, l%)" string. Same anchored-match discipline as
  // parseRgbString: hue must be 0-360 and saturation/lightness 0-100, with no negative
  // numbers, decimals, extra components, or surrounding garbage silently accepted.
  function parseHslString(value) {
    const str = String(value).trim();
    const wrapped = str.match(/^hsla?\(([\s\S]*)\)$/i);
    const body = (wrapped ? wrapped[1] : str).trim();
    const m = body.match(/^(\d+)[,\s]+(\d+)%?[,\s]+(\d+)%?$/);
    if (!m) return null;
    const h = Number(m[1]), s = Number(m[2]), l = Number(m[3]);
    if (h > 360 || s > 100 || l > 100) return null;
    return { h, s, l };
  }

  function parseAnyColor(value) {
    let rgb = hexToRgb(value);
    if (rgb) return rgb;
    return parseRgbString(value);
  }

  return {
    hexToRgb, rgbToHex, rgbToHsl, hslToRgb,
    relativeLuminance, contrastRatio, parseAnyColor,
    parseRgbString, parseHslString,
  };
});
