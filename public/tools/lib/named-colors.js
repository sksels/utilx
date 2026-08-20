// CR#8 (backlog #54): the 148 CSS/SVG extended color keywords (the 147 from SVG 1.1/CSS3 plus
// "rebeccapurple", added in CSS Color Module Level 4 -- the same list every browser already
// recognizes in `color: cornflowerblue`), so Color Converter can offer a searchable name ->
// hex lookup instead of requiring users to remember or type raw hex/rgb/hsl values. Pure data
// + lookup only, no DOM -- the datalist markup and wiring live in color-converter.astro, same
// separation as ColorLib itself.
//
// Deliberately excludes "transparent": every other entry here is a solid, fully-opaque color
// with a stable 6-digit hex value, and folding in a color that's defined by having *no* opacity
// would need special-cased alpha handling throughout the lookup/reverse-lookup pair below for
// one keyword that doesn't really fit "pick a named color" the way the other 148 do.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NamedColorsLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Lowercase, no spaces -- exactly how CSS itself spells these keywords, and exactly the
  // form nameToHex normalizes user input into before lookup. No separate "display name" is
  // stored: the raw keyword (e.g. "cornflowerblue") is already the correct, unambiguous form
  // to both show in the datalist and accept back as typed input, so there's no prettified
  // second spelling to keep in sync.
  var NAMED_COLORS = {
    aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
    azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
    blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
    burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
    coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
    cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
    darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
    darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00',
    darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f',
    darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f',
    darkturquoise: '#00ced1', darkviolet: '#9400d3', deeppink: '#ff1493',
    deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff',
    firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22', fuchsia: '#ff00ff',
    gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520',
    gray: '#808080', green: '#008000', greenyellow: '#adff2f', grey: '#808080',
    honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c', indigo: '#4b0082',
    ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa', lavenderblush: '#fff0f5',
    lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
    lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2',
    lightgray: '#d3d3d3', lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1',
    lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa',
    lightslategray: '#778899', lightslategrey: '#778899', lightsteelblue: '#b0c4de',
    lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6',
    magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd',
    mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa',
    mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
    oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500',
    orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98',
    paleturquoise: '#afeeee', palevioletred: '#db7093', papayawhip: '#ffefd5',
    peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd',
    powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399', red: '#ff0000',
    rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072',
    sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d',
    silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd', slategray: '#708090',
    slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f', steelblue: '#4682b4',
    tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347',
    turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3', white: '#ffffff',
    whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
  };

  // Case/whitespace-insensitive: "Cornflower Blue", "CORNFLOWERBLUE", and "cornflowerblue"
  // all resolve the same way, since users searching a datalist may type in any casing and CSS
  // keywords themselves are case-insensitive. Returns null (not undefined) for no match, same
  // "no match" convention ColorLib's own parse functions use.
  function normalize(name) {
    return String(name).toLowerCase().replace(/\s+/g, '');
  }

  function nameToHex(name) {
    var key = normalize(name);
    return NAMED_COLORS.hasOwnProperty(key) ? NAMED_COLORS[key] : null;
  }

  // Reverse lookup: exact hex match only (not "nearest color") -- this powers the name field
  // auto-filling in when a hex/rgb/hsl edit happens to land on exactly one of these 147 known
  // values, not a fuzzy "closest named color" guess for arbitrary colors, which would be a
  // different (and much more subjective) feature. Case-insensitive on the hex string itself
  // (both '#FF0000' and '#ff0000' match 'red') since ColorLib.rgbToHex always produces
  // lowercase, but this may be called with a value from elsewhere.
  function hexToName(hex) {
    var target = String(hex).toLowerCase();
    for (var key in NAMED_COLORS) {
      if (NAMED_COLORS.hasOwnProperty(key) && NAMED_COLORS[key] === target) return key;
    }
    return null;
  }

  function allNames() {
    return Object.keys(NAMED_COLORS).sort();
  }

  return { NAMED_COLORS, nameToHex, hexToName, allNames };
});
