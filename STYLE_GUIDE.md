# UtilX Style Guide

The canonical spec for this site's visual and structural conventions. This is what `.stylelintrc.json` enforces automatically where it can, and what a human reviewer (or future me) should check any new page/change against where it can't. If a change disagrees with this doc, either the change is wrong or the doc is stale — fix whichever one is actually wrong, don't let them silently diverge.

## Design tokens

All colors, spacing, and shadows are CSS custom properties defined once in `public/style.css`'s `:root` block (dark theme, the default) and overridden in `:root[data-theme="light"]` and `:root.popup-mode`. **Never write a raw hex/rgba color value in a component rule** — use the token. Stylelint (`scale-unlimited/declaration-strict-value`, wired into `npm run lint:css` and CI) fails the build on `color`, `background-color`, and `border-color` properties that use a raw value instead of `var(--...)`.

| Token | Dark | Light | Purpose |
|---|---|---|---|
| `--bg` | `#0f1117` | `#f6f7fb` | Page background |
| `--bg-card` | `#161925` | `#ffffff` | Card/panel background |
| `--border` | `#262b3a` | `#e1e4ec` | Default border color |
| `--text` | `#e6e8ef` | `#1a1d29` | Primary text |
| `--text-dim` | `#9aa1b4` | `#5b6072` | Secondary/muted text |
| `--accent` | `#5b8cff` | `#2f5bc4` | Links, primary buttons, focus states, toolbar-btn's "copied" flash (CR#8 #51) |
| `--accent-hover` | `#7ba0ff` | `#24479c` | Hover state for accent elements |
| `--accent-soft` | `rgba(91,140,255,.1)` | `rgba(47,91,196,.08)` | Subtle accent backgrounds (gradients, highlights) |
| `--toolbar-accent` | `var(--success)` | `var(--success)` | toolbar-btn's resting background/border (CR#8 backlog #51 -- green, kept separate from `--accent` so links/focus rings/headings stay blue) |
| `--toolbar-accent-hover` | `#86efac` | `#14532d` | Hover state for toolbar-btn (CR#8 #51) |
| `--code-bg` | `#0a0c12` | `#eef0f6` | Code/output block backgrounds |
| `--text-on-accent` | `#0a0c12` | `#ffffff` | Button/toolbar-btn text color on an accent-colored background |
| `--success` | `#4ade80` | `#15803d` | Success messages, click-flash border, `--toolbar-accent`'s value |
| `--danger` | `#ff6b6b` | `#b91c1c` | Error messages |
| `--tool-accent-json` | `#f59e0b` | (theme-invariant) | JSON Formatter's icon-chip gradient stop + popup border (CR#8 #57) |
| `--tool-accent-regex` | `#a855f7` | (theme-invariant) | Regex Tester's icon-chip gradient stop + popup border (CR#8 #57) |
| `--tool-accent-cron` | `#06b6d4` | (theme-invariant) | Cron Builder's icon-chip gradient stop + popup border (CR#8 #57) |
| `--tool-accent-password` | `#ef4444` | (theme-invariant) | Password/UUID Generator's icon-chip gradient stop + popup border (CR#8 #57) |
| `--tool-accent-base64` | `#10b981` | (theme-invariant) | Base64/JWT Tool's icon-chip gradient stop + popup border (CR#8 #57) |
| `--tool-accent-color` | `#f472b6` | (theme-invariant) | Color Converter's icon-chip gradient stop + popup border (CR#8 #57) |
| `--radius` / `--radius-lg` | `10px` / `14px` | | Border radius (cards vs. larger tiles) |
| `--shadow-sm` / `--shadow-md` / `--shadow-glow` | theme-varying | | Elevation |
| `--ease` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | | Standard transition easing |

**Exceptions**: a handful of decorative, theme-independent colors (the per-tool icon-chip gradients, the PWA install-banner button) are intentionally left as raw values with an inline `stylelint-disable-next-line` comment explaining why — they're fixed brand/decorative colors, not something that should shift with the token system, and reusing an existing token for them would misrepresent what they mean. If you hit a Stylelint failure and you're tempted to add a disable comment instead of a token, ask: does this color repeat anywhere else, or will it plausibly need to someday? If yes, it's a token, not an exception.

## Toolbar layout (the pattern that has broken twice — read this before touching it)

Every field that has action buttons (Generate, Format, Copy, Clear, etc.) follows the same structure: **the field keeps its own native, unmodified border; the toolbar is a separate flex sibling positioned outside it.** Buttons are never absolutely positioned on top of a field (that was tried — it collided with scrollbars) and never merged into one shared bordered box with the field (also tried — made native `<select>` styling read inconsistently next to plain inputs).

```astro
<div class="input-target">
  <textarea id="..." rows="8"></textarea>
  <InputToolbar>
    <button class="toolbar-btn" onclick="...">...</button>
  </InputToolbar>
</div>
```

- Always use the `<InputToolbar>` / `<OutputToolbar>` Astro components (`src/components/`) for the wrapper — never hand-write `<div class="input-toolbar">`. This is not a style preference: it's the only thing standing between "one implementation" and the exact bug class this guide exists because of (see below).
- `<InputToolbar inline>` for a toolbar beside a single-line `<input>`/`<select>` (buttons lay out in a row). Default (no `inline`) is for multi-line `<textarea>`s (buttons lay out in a column, like an editor's icon rail).
- Two pages (Password Generator, JSON Formatter) have a toolbar that belongs to a whole *cluster* of controls, not one field — there, the cluster keeps its own bordered `.input-box` panel, and the toolbar sits outside that panel via an `.input-box-row` wrapper. Same principle, just one more layer:
  ```astro
  <div class="input-box-row">
    <div class="input-box"> <!-- the bordered grouping panel --> </div>
    <InputToolbar>...</InputToolbar>
  </div>
  ```
- **Layout (flex, `align-items: center`, `gap: 8px`) is defined in exactly one place**: `div:has(> .input-toolbar), div:has(> .output-toolbar)` in `style.css`. It applies automatically to *any* div whose direct child is a toolbar — a plain `.input-target`, an `.output-target`, or an `.input-box-row`. Do not add a second copy of this layout logic anywhere, even one that looks like a small variant. This exact mistake (a second, near-identical rule that drifted out of sync when the first one got fixed) caused the Password Generator toolbar to render pinned to the top of its panel instead of centered — confirmed live, after a "have you checked everywhere" prompt caught what a first pass missed. If you need a new layout variant, it almost certainly belongs as a modifier on the one generic rule, not a new rule.

## Buttons

- One accent color for every `.toolbar-btn`, always — no primary/secondary visual split. This was deliberate: once buttons stopped sharing a bordered box, mixed button styling read as arbitrary rather than meaningful. If a button needs emphasis, that's a UX/copy problem, not a color problem.
- `.toolbar-btn` is 30×30px, icon-only, `border-radius: 6px`.
- `.toolbar-btn`'s resting color is `--toolbar-accent` (green, CR#8 backlog #51) — not `--accent` (blue). `--accent` is still used for links, focus states, and primary `<button>`s; this split keeps those blue while toolbar action buttons read as a distinct, green-accented rail. Don't reintroduce `var(--accent)` on `.toolbar-btn` without also reconsidering `.toolbar-btn.copied` below, since the two rely on being different colors from each other.
- `.toolbar-btn.copied` (post-copy flash) swaps to `--accent` briefly via `output-toolbar.js`, then reverts — deliberately the *other* color from `.toolbar-btn`'s resting `--toolbar-accent`, so the flash is visibly a state change rather than blending into the button's normal look.

## Field/output structure

- `.input-target`, `.output-target` — wraps a single field + its toolbar.
- `.output-box` — wraps a `<label>` + `.output-target`, used for every labeled output field.
- `.input-box` — the bordered grouping panel for the two multi-control clusters (see above). Not a generic field wrapper.
- `.card` — the outer bordered section container every tool's major blocks live in.

## Interaction model: auto-process vs. click-to-run (CR#7, backlog #31)

Most tools now run their primary action live as the user types instead of waiting for a
Format/Test/Build button click. This isn't a blanket rule, though — apply it per field using
this test, not by default:

- **Auto-process when the output is a pure, deterministic function of the current input** —
  JSON Formatter (format/compare), Regex Tester (test), Cron Builder (build/decode), and the
  Base64 tool's JWT decoder all qualify: given the same input, there's exactly one correct
  output, and re-running it live just keeps the output honestly reflecting what's currently
  typed. Wire it via `document.getElementById(...).addEventListener('input', debounced)`,
  where `debounced` wraps the *existing* click-handler function using `DebounceLib.debounce`
  (`public/debounce.js`, ~400ms) — never bypass or duplicate that function's logic.
- **Stay click-triggered when the action is ambiguous or non-deterministic given the current
  input** — two concrete exceptions on this site, both deliberate, not oversights:
  - Base64 tool's main Encode/Decode box: the same input text is equally valid as "please
    encode this" or "please decode this" — only the user knows which they mean, so guessing
    would be wrong roughly half the time. Stays click/shortcut-triggered.
  - Password/UUID Generator: `generatePassword()`/`generateUuid()` are non-deterministic (a
    fresh cryptographically random value every call) — there's no "the currently-correct
    output for this input" to keep in sync, only "give me a new one now." Here, auto-firing
    on every *option* change (a checkbox, a dropdown, a released slider — via `'change'`, not
    `'input'`, and no debounce needed since those are already discrete events) still makes
    sense, since a user who just unchecked "Symbols" clearly wants a fresh symbol-free value,
    not the old one sitting there unchanged. What stays click-only is the *bulk* UUID
    generation (10×/100×) — an explicit, deliberate bulk action, not something that should
    fire from a dropdown change.
- **The button/keyboard-shortcut path must keep working unchanged** either way — auto-run is
  additive, not a replacement. Never remove a `.toolbar-btn` or its `onclick` handler when
  adding an `input`/`change` listener; both should call the exact same function.
- Debounce every `input`-event auto-run (typing is a burst of events); never debounce a
  `change`-event auto-run (already one discrete event per user action).

## Resizable input/output split panes (CR#7, backlog #36)

Tools whose primary interaction is one large input textarea paired with one large output
area (JSON Formatter, Regex Tester, Base64 Tool) lay them out side-by-side on desktop widths
via a shared `.split-pane` / `.split-pane-left` / `.split-divider` / `.split-pane-right`
structure, with a draggable divider between them (`public/split-pane.js`, wired with
`SplitPaneLib.init(container, leftEl, rightEl, dividerEl, storageKey)`). Falls back to the
normal stacked layout at the same 700px breakpoint `.two-col` already uses (see style.css) --
two independently-narrow columns aren't useful on a phone screen. The chosen split ratio
persists per-tool via `public/local-state.js`.

Not every tool gets this treatment -- only apply it where there's a genuine one-big-input,
one-big-output pairing to resize:
- Cron Builder's Build/Decode sections use short single-line fields, not a large-textarea
  input/output pair -- no natural split to make.
- Password/UUID Generator has no "input" in this sense (it only ever generates).
- Color Converter's fields are all short too.
- JSON Formatter's Compare (diffA/diffB) section already lays its two inputs side-by-side via
  the existing `.two-col` grid -- that's a distinct, already-solved "side-by-side" case
  (two inputs, not resizable), left as-is rather than folded into `.split-pane`.

When a tool does qualify, `msg`/status divs move to sit *below* the whole `.split-pane` (full
width) rather than between the input and output, since with the two panes side-by-side there
is no longer a single "between input and output" position for them.

**Vertical alignment between panes (CR#8, backlog #53):** the left pane's top-of-pane offset
comes from its first `<label>`'s own `margin-top: 14px` (trapped inside the pane by the flex
item's implicit block-formatting context, not collapsed away). The right pane's first element
is always `.output-box`, whose *global* `margin-top: 16px` (for its normal standalone use
elsewhere) collapses with that same first-child `<label>`'s 14px into `max(16, 14) = 16px` --
2px more than the left pane. `.split-pane-right > .output-box:first-child` overrides that to
`margin-top: 6px`, which still collapses with the label the same way, but resolves to
`max(6, 14) = 14px` -- matching the left pane exactly. `:first-child` matters: Regex Tester's
split-pane-right stacks three separate `.output-box` sections, and only the first one's offset
from the pane's own top needed to change -- the other two keep their normal 16px separation
from each other. Don't touch `.output-box`'s own rule to "fix" this globally; that 16px is
correct for every non-split-pane use of `.output-box` on the site.

The divider's visible bar is 4px (was 2px, CR#8 #53 -- "the vertical splitter needs to be
thicker"). Its hit-target box is 16px with a `-5px` margin (was 14px/`-4px`), scaled to keep
the same ~6px of breathing room on each side of the bar rather than the panes suddenly sitting
further apart just because the bar itself got thicker.

## Collapsible diff context rows (CR#7, backlog #37)

JSON Formatter's Compare view (`compareJson()`) calls `JsonToolsLib.deepDiff(a, b, path,
results, { includeUnchanged: true })` -- the 5th `options` param is opt-in and every other
call site (and every existing test) omits it, so default behavior is unchanged. With it on,
the diff includes `type: 'unchanged'` rows alongside `added`/`removed`/`changed`, giving
full leaf-level context like a real diff view rather than just a changes list. Note this
does *not* collapse a whole matching nested object/array into one row inside `deepDiff`
itself -- two independently-parsed JSON documents never share object references even when
deeply identical, so the `a === b` fast path only fires for primitive leaves, and traversal
always continues into nested objects/arrays regardless of `includeUnchanged`. The visible
"N differences found" count and the "No differences" empty state still only count non-
`unchanged` rows, matching pre-#37 behavior exactly.

Grouping/collapsing is purely a rendering concern (`renderDiffTable` in json-formatter.astro):
consecutive `unchanged` rows in the flat results array get grouped into one
`.diff-group-toggle` summary row, collapsed by default, expandable on click. Build table rows
with `createElement`/`textContent`, never `innerHTML` string-concatenation -- a JSON key or
value that happens to contain HTML-looking text must never be interpreted as markup (this
was in fact a latent gap in the pre-#37 version of this exact code, fixed while rewriting it
for the new grouping).

## Minimum field height vs. toolbar button count (CR#8, backlog #48)

A column (non-`.inline`) toolbar's own height is fixed by its button count: `N * 30px + (N-1)
* 4px` of gap. The field it sits beside is centered against it (`align-items: center` on the
`div:has(> .input-toolbar)` row), not stretched, so if the field's natural height falls short
of the toolbar's, the top/bottom buttons hang past the field's own border instead of reading as
contained within it -- this was live on Base64 Tool's 8-row input textarea next to its 5-button
toolbar (166px of buttons vs. ~158px of textarea). Fixed with `:has()` + `:nth-child(N)` rules
in style.css that count a toolbar's actual button children and floor the paired field's
`min-height` to match, for N = 2 through 5 (the current max). No changes needed in any `.astro`
page -- this is pure CSS structural counting, so it stays correct automatically as buttons are
added/removed/rolled out to new tools. `.input-box` composite panels (Password Generator's
slider + checkboxes) are deliberately excluded -- they're already far taller than any 2-5
button toolbar, so a floor would never engage there. If a future toolbar ever needs a 6th
button, add one more `:nth-child(6)` block (198px) after the existing ones -- order matters,
since same-specificity rules cascade by source order and a later, larger-N block must win.

## Compact "how this works" links (CR#8, backlog #52)

Every tool page used to carry a full `<h2>` + 1-2 paragraphs explaining how the tool works
(JSON Formatter's "How this works", Password Generator's "Why local generation matters").
User feedback: too large, took up too much space on every page. Replaced with
`InfoLink.astro` (`src/components/`) — a single line with a small info icon, the full
explanation moved into a native `title` tooltip (same established hover pattern
`LocalBadge.astro` already uses), and the label itself becomes a real `<a href="/guides/...">`
link when the tool has a dedicated guide page:

```astro
<InfoLink
  href="/guides/what-is-json.html"
  summary="One or two sentences -- this becomes the hover tooltip."
/>
```

When there's no guide page to link to (Password Generator's local-generation explanation has
no matching `/guides/` page), omit `href` — it renders as a `<button>` instead of an `<a>`,
still focusable and still shows the tooltip, just doesn't navigate anywhere.

**Don't use this for reference material users actively consult while working** — Regex
Tester's "Common flags" table and Cron Builder's example patterns (with "Use" buttons) stay
fully visible. Those are functional lookup/interactive content, not passive prose explaining
how the tool works internally, and hiding them behind a hover would hurt usability rather than
declutter it. The "Related tool" cross-link paragraphs (CR#2 backlog #91) also stay as-is —
different feature, not what this backlog item was about.

`public/popup-nav.js`'s shared `DEFAULT_HEIGHT` (the fixed popup window size every tool opens
in) came down from 800 to 740 alongside this — see the comment there for why only a partial
reduction, not the full amount saved on the two pages that actually shrank.

## Searchable dropdowns: native `<input list>` + `<datalist>` (CR#8, backlog #54)

Color Converter's Name field ("developers can play around by choosing rather than typing")
needed a dropdown with type-to-filter search. Built with a plain `<input list="...">` paired
with a `<datalist>`, not a custom combobox widget — every browser already gives free
type-to-filter behavior for this pattern, with zero custom ARIA required. Reach for this first
for any future "pick from a list, but let me search/type too" need (the CR#8 backlog #35
command palette is a different, bigger case — a global Cmd/Ctrl+K launcher, not a per-field
picker — so it doesn't reuse this directly, but the same "native first" instinct applies
before reaching for a custom widget).

`src/pages/tools/color-converter.astro` populates the `<datalist>` at runtime from
`NamedColorsLib.allNames()` (`public/tools/lib/named-colors.js`) rather than hand-writing
option tags in the template — 148 CSS/SVG extended color keywords don't belong hardcoded in
markup. `NamedColorsLib.nameToHex`/`hexToName` plug into the page's existing `updateFrom(source)`
dispatch the same way hex/rgb/hsl already do: typing a recognized name converts and syncs the
other three fields; editing hex/rgb/hsl auto-fills the Name field when the result happens to be
an exact named color, and clears it otherwise (not every color has a name). Same
"don't overwrite the field currently being typed into" rule the other three fields already
follow.

New library files added to a tool page's `head-extra` must also be added to
`public/service-worker.js`'s `PRECACHE_URLS` — missed once already in CR#7 (caught before
shipping, not after), and it's an easy thing to forget since the page works fine locally
either way; it only breaks offline/installed-PWA sessions.

## Homepage tile footer alignment (CR#8, backlog #56)

`.tool-card` is a flex column (not `display: block`) specifically so `.tool-card-guide`'s
`margin-top: auto` can pin the separator line + link to the bottom of the card. Don't revert
`.tool-card` to `display: block` without re-solving this: without the flex column, the line
goes back to sitting wherever the description text happens to end, which varies per tile (and
was the exact complaint that prompted this).

Every tile has a `.tool-card-guide` footer now, even the two tools with no dedicated
`/guides/` page (Password Generator, Color Converter) — those two reuse the same "Related
tool" cross-link their own tool page already shows (both point to Base64 Encoder / Decoder),
rather than a tile with no footer to pin, or an invented guide page. If a 7th tool is ever
added with genuinely no natural related-tool link, give it a `.tool-card-guide` anyway (even
pointing back to the homepage's guides listing, or omitted entirely with the understanding
that its tile's line will then sit higher than the rest of that row) rather than silently
breaking the "same line, same level" consistency this fix established.

## Popup border color matches tile icon color (CR#8, backlog #57)

Each tool's icon-chip gradient already carries a distinct brand color per tool (`.chip-json`,
`.chip-regex`, etc.). When a tool is opened via the homepage's "open in popup window" feature
(`popup-nav.js`), the popup window now borders itself in that same color, so the popup reads as
unmistakably *that* tool's window rather than a generic second copy of the site. Each `.chip-*`
gradient rule was refactored to pull one of its stops from a new `--tool-accent-*` token (see
design tokens table above) instead of a locally-hardcoded hex, so the icon-chip and the popup
border are guaranteed to stay in sync — one token, two consumers.

Wiring: `BaseLayout.astro` takes a `toolId` prop (tool pages only, e.g. `toolId="json-formatter"`)
and renders it as `<html data-tool-id={toolId}>` — Astro omits the attribute entirely when
`toolId` is undefined (same pattern as the existing `noindex` meta tag), so non-tool pages are
unaffected. `style.css` pairs that with the existing `.popup-mode` class (set client-side via
`window.opener` detection) in `:root.popup-mode[data-tool-id="json-formatter"] body { border: 3px
solid var(--tool-accent-json); }` — one rule per tool, six total. `toolId` must exactly match the
`.chip-*`/`--tool-accent-*` suffix already used for that tool everywhere else in the codebase.

When adding a 7th tool: give it a `--tool-accent-*` token, use it in that tool's `.chip-*`
gradient, add one more `:root.popup-mode[data-tool-id="..."] body` rule, and pass `toolId="..."`
on its `<BaseLayout>` — skipping any one of these four leaves the popup unbordered for that tool
rather than erroring, so it's easy to silently miss; check all four together.

## Tool icon in the page's own `<h1>` (CR#8, backlog #58)

The colored icon chip used to exist only on the homepage tile — once a tool was actually opened
(in a normal tab, or the backlog #57 popup that now borders itself in that same color), the icon
disappeared and the page was plain text. `.tool-page-header` wraps a tool page's `<h1>` with the
exact same `.tool-icon-chip`/`.chip-*` markup already used on that tool's homepage tile (copy the
matching `<div class="tool-icon-chip chip-*">...</div>` block from `index.astro` verbatim — same
SVG, same chip class — rather than inventing a second icon per tool). `.tool-page-header` moves
`h1`'s own `margin-bottom` onto the row itself and resets `h1`'s margin to 0, so the row+h1 pair
occupies the same vertical space `h1` alone used to.

```astro
<div class="breadcrumb"><a href="/index.html">Tools</a> / JSON Formatter</div>
<div class="tool-page-header">
  <div class="tool-icon-chip chip-json">
    <svg class="tool-icon" ...>...</svg>
  </div>
  <h1>JSON Formatter &amp; Validator</h1>
</div>
```

This is unrelated to the homepage's `.tool-card-header` (item #55) beyond sharing the same
`.tool-icon-chip`/`.chip-*` building blocks — one lives in a homepage tile, one in a tool page's
own header, and each has its own margin rules scoped to its own class so they don't interfere.

## Site-wide background treatment (CR#8, backlog #59)

Every page and every tool popup used to sit on the flat, textureless `--bg` color — site owner
feedback was explicitly "not flat black," and explicitly site-wide (corrected mid-conversation
from an initial homepage-only framing). `html, body`'s `background` is now two soft radial
glows in `--accent-soft` layered over the flat `--bg` base color:

```css
background:
  radial-gradient(ellipse 1200px 800px at 12% -10%, var(--accent-soft), transparent 60%),
  radial-gradient(ellipse 1000px 700px at 100% 110%, var(--accent-soft), transparent 55%),
  var(--bg);
background-attachment: fixed;
```

Deliberately reuses `--accent-soft` (already theme-aware, already used elsewhere for subtle
accent backgrounds) rather than introducing a new token pair — one gradient rule automatically
covers light mode, dark mode, and popup mode, since `--bg`/`--accent-soft` are already overridden
per-theme and per-`.popup-mode` elsewhere in this file; no separate popup-specific background
rule was needed. `background-attachment: fixed` anchors the glows to the viewport corners as a
stable backdrop rather than scrolling with page content (tried scrolling first — read as
distracting on tall tool pages). Pure CSS, no image request, so this has no Lighthouse
performance cost, and at 8-10% alpha it doesn't meaningfully shift the contrast ratios already
verified for `--bg` alone (CR#8 #51) — text sitting directly on `--bg` (not a `--bg-card` panel)
keeps effectively the same contrast.

Related but explicitly out of scope here: the octopus mascot/logo work (backlog row 22) is a
separate, still-open thread toward the same "give UtilX a visual identity" goal — this item is
just the background treatment, not a logo.

## Smart clipboard injection (CR#8, backlog #32)

Homepage-only: on load and whenever the tab becomes visible again, checks whether the
clipboard already contains something that looks like a tool's input (JSON, a cron expression,
a hex color, a JWT, or a generic Base64 token) and — if so — shows a small dismissible toast
("Your clipboard looks like JSON — open it in JSON Formatter?"). Confirmed choice, asked
directly: shows a suggestion, never auto-navigates. Split across three files, same separation
this project already uses for every tool's own logic:

- `public/tools/lib/clipboard-detect.js` — pure pattern matching (`detectToolForText(text)` →
  `{ toolId, url, label } | null`), no DOM/clipboard access, tested head-on in
  `tests/clipboard-detect.test.js`. Reuses existing lib functions rather than reimplementing
  validation (`CronLib.validateBuildFields`, `ColorLib.hexToRgb`, `Base64Lib.decodeJwt` /
  `decodeBase64ToUtf8`) — the matchers are thin wrappers around logic that was already correct
  and already tested elsewhere.
- `public/clipboard-suggest.js` — the actual `navigator.clipboard.readText()` call, permission
  handling, de-duplication (won't re-show the same dismissed clipboard content again this tab
  session — `sessionStorage`), and the toast DOM, reusing the shared `.utilx-toast` CSS class
  (see below).
- `src/layouts/BaseLayout.astro` — new `includeClipboardSuggest` prop (homepage-only, like
  `includeTileOrder`/`includePopupNav`), loads the four scripts above in dependency order.

**Deliberately precision-over-recall matching.** Every pattern in `clipboard-detect.js` is
chosen to have a low false-positive rate even at the cost of missing some real matches — a
wrong suggestion is worse than a missed one, since it's shown unprompted before the user has
indicated they want anything from the site at all. Concretely: hex-color detection requires a
leading `#` (a bare 6-hex-digit string is exactly as likely to be a truncated git SHA as a
color); Base64 detection requires no internal whitespace and a real minimum length; a shared
`MIN_LENGTH`/`MAX_LENGTH` gate rejects short-coincidence and huge-paste cases before running
any matcher. The one exception is hex color, checked *ahead of* that length gate — `#fff` is a
fully legitimate 4-character color that `MIN_LENGTH` would otherwise wrongly reject, and
`ColorLib.hexToRgb()` already fully constrains valid hex lengths on its own.

**Never requests clipboard permission itself.** `navigator.clipboard.readText()` is gated
behind the `'clipboard-read'` permission in every browser implementing the Async Clipboard
API; calling it without that permission already granted triggers the browser's own native
"Allow this site to see your clipboard?" prompt. Popping that dialog unprompted, the instant
someone lands on the homepage, is exactly the kind of intrusive behavior this feature exists
to avoid (the same reasoning behind the suggestion-toast-not-auto-navigate choice above). So
`clipboard-suggest.js` only calls `readText()` when `navigator.permissions.query({name:
'clipboard-read'})` reports the permission state is already `'granted'` — never requesting it.
In practice this means the feature is a silent no-op on a freshly-visited browser, and on any
browser (Firefox, notably) that doesn't support querying this permission at all. That's the
intended trade-off, not a gap to "fix" by requesting permission anyway.

**Shared toast CSS.** `.utilx-toast` (position/box/border/shadow) was factored out of what used
to be `#utilx-install-prompt`-only CSS, since this is the second near-identical toast on the
site (the PWA install prompt, `public/sw-register.js`, was the first). Position is set
per-toast, not on the shared class: `#utilx-install-prompt` anchors `bottom: 20px`,
`#utilx-clipboard-toast` anchors `top: 20px` — opposite viewport edges, so the rare case of
both showing at once (a returning visitor with an installable PWA *and* granted clipboard
permission) can never visually stack or overlap, without needing any z-index/offset-stacking
logic for a combination this uncommon.

## Tools/guides registry via Astro Content Collections (CR#8, backlog #69)

The homepage tile grid (`src/pages/index.astro`) reads from `getCollection('tools')` instead
of hardcoded per-tile HTML. `src/content.config.ts` defines the `tools` and `guides`
collections (`file()` loader + Zod schema) backed by `src/data/tools.json` / `guides.json`.
Built ahead of the command palette (CR#8 #35) on purpose, at the site owner's request, so the
palette's search index reads from the same collection instead of a second hand-typed list —
exactly the class of drift bug this project has been bitten by before (see the toolbar-centering
CSS rule's own comment on a duplicate that fell out of sync).

**Why a schema, not a plain JS array.** `defineCollection`'s Zod schema fails the build loudly
if a new tool entry is missing a required field (e.g. `chipClass`) — verified locally by
deleting a field and confirming `astro build` errors with the exact entry and field name,
rather than silently rendering an unstyled tile. That validation is the actual reason this is
worth the extra file over `src/data/tools.js`.

**`order` field is required, not inferred from JSON array position.** Verified locally that
Astro's `file()` loader does not preserve the source JSON array's order — `getCollection()`
returned the 6 tools sorted alphabetically by `id` instead of the curated homepage order. Each
entry has an explicit `order: number`; `index.astro` sorts by it
(`.sort((a, b) => a.data.order - b.data.order)`) before rendering. Don't rely on JSON array
order for anything display-related with this loader.

**`iconSvg` holds inner markup only.** Every tile icon shares one outer `<svg viewBox="0 0 24
24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
stroke-linejoin="round">` wrapper, hardcoded once in `index.astro`; only the per-tool
path/circle/line markup lives in `tools.json`, injected via `set:html`. Rendered output is
functionally identical to the old hand-written markup (verified via a diff of the built
`index.html`) but not byte-identical: `set:html` passes the raw JSON string through verbatim
(self-closing `<path/>` tags, literal `→` character), where Astro's JSX-like compiler used to
normalize hand-written SVG into explicit `<path></path>` closing tags and kept `&rarr;` as an
HTML entity. Both render identically in every browser; no test depends on the exact byte form
either way.

**`aliases` field exists but is unused today.** Populated per tool now (extra search terms a
fuzzy match against `label` wouldn't catch — see backlog #68) so #35/#68 don't need a second
data-entry pass later. Not read by any code yet.

**Adding a 7th tool in the future:** add one entry to `src/data/tools.json` (with a unique
`order`) — no `index.astro` changes needed, and once #35 ships reading from this same
collection, no palette changes either.

## Command palette (CR#8, backlog #35/#236)

`Cmd/Ctrl+K` or the header's search button opens a global palette (`src/components/CommandPalette.astro`, `public/command-palette.js`) listing all tools/guides from the Content Collections built for this (backlog #69) -- fuzzy search via a vendored Fuse.js (`public/tools/lib/fuse.min.js`, Apache 2.0), arrow-key navigation, Enter/click to select, Escape/backdrop-click to close.

**Draggable, not fixed (site owner decision).** The dialog has a drag handle (`#utilx-palette-drag-handle`, reuses the homepage tile's `&#10022;&#10022;` glyph convention) -- mousedown-drag repositions it via `position: fixed` + inline `left`/`top`, clamped to the viewport. The dragged position resets on every re-open rather than persisting across opens; that's a deliberate v1 simplification (`resetDragPosition()`, called from `openPalette()`), not an oversight -- persisting across opens/sessions is reasonable future work, not assumed here.

**Selecting a tool result opens a popup, not a same-page navigation (site owner decision).** `activateEntry()` in `command-palette.js` routes tool entries through `window.openToolPopup()` (the same `public/popup-nav.js` function the homepage tiles use), so picking a tool from the palette behaves exactly like clicking its tile -- a separate popup window, main page/tab untouched. Falls back to a normal navigation if the popup was blocked (`openToolPopup`'s return value signals this). Guide entries still navigate the current page via `window.location.href` -- guides were never part of the popup convention anywhere else on the site, so the palette doesn't invent one for them. Because of this, `BaseLayout.astro` now loads `popup-nav.js` whenever `includePopupNav || includeCommandPalette` is true, not just on the homepage -- `window.openToolPopup` has to exist on every page the palette can trigger a popup from.

**Lazy-loaded, not eager (backlog #70).** The only thing that runs on every page load is a tiny inline script in `CommandPalette.astro` registering the keydown listener and the trigger button's click handler. `public/command-palette.js`, Fuse.js, and `/palette-data.json` are only fetched the first time a visitor actually opens the palette (`import('/command-palette.js')` inside the trigger handler), with a `requestIdleCallback` prefetch (Safari fallback: `setTimeout`) to warm the module in the background once the page has settled -- so the first real keypress feels instant without costing every visitor bytes for a feature most won't use that session.

**`/palette-data.json` is a build-time-generated static file** (`src/pages/palette-data.json.ts`, an Astro endpoint), not inlined into every page's HTML -- fetched lazily alongside Fuse.js for the same reason. `netlify.toml` gives it and `fuse.min.js` their own `Cache-Control` (a real `max-age`), scoped separately from the sitewide `/*.js` no-cache rule (which exists for *application* JS that changes every deploy -- these two files don't).

**Global by default.** `BaseLayout.astro`'s `includeCommandPalette` prop defaults to `header === 'full'`, so every normal page gets it without per-page wiring; the admin dashboard (`header: 'minimal'`) opts out the same way it already skips theme.js/ads/analytics/footer.

**Both `tools` and `guides` collections need an explicit `order` field** -- same Astro `file()`-loader gotcha as #69 (alphabetical-by-id, not source array order). Caught once already for tools; guides needed the same fix during this build.

**Scope note.** This first pass is search + keyboard nav + navigate only. Recently-used-first ordering, "Paste & go" clipboard tie-in, output-side quick actions, a theme-toggle command, and alias-boosted ranking are logged as CR#8 backlog sub-items (#64-#68), deliberately deferred for gradual follow-up. Tool-page quick actions (mirroring each tool's own input-toolbar buttons) are also out of this pass -- every tool wires a different, bespoke set of global functions (`encode()`/`formatJson()`/`generatePassword()`/...), and wiring six tool-specific integrations deserves its own pass and tests.

## Testing policy: Definition of Done and the CI pipeline

Established Aug 21 2026 after CR#8 #35 (command palette) shipped with real, user-visible bugs despite "tests exist" being true at every point along the way. The lesson: a test file existing is not the same as a test having ever run. The palette's Playwright spec (`e2e/command-palette.spec.js`) was written in the same commit as the feature itself, but sat unexecuted for a full day of work -- it couldn't run in the sandbox this project is built in (Chromium download blocked by that sandbox's network allowlist), and `ci.yml` didn't trigger on `development` pushes at all at the time. It hid a real fuzzy-search bug (Fuse.js's threshold was loose enough to match "cron" against Color Converter and Password & UUID Generator) for that entire day, plus the test's own assertion was wrong. Nothing is "Done" until it has actually run and passed, not merely been written.

**Definition of Done -- four gates, only claim what was actually checked:**

1. **Written** -- code exists, matches this style guide, `node --check`-clean.
2. **Unit-verified** -- `node --test` suite passes, zero regressions.
3. **Build-verified** -- fresh clone, `npm ci && npm run build` succeeds, schema/lint checks pass.
4. **Live-verified** -- actually opened in a real browser (via the connected Chrome browser tools, or CI's Playwright run) and walked through an acceptance checklist agreed *before* building, not assumed after.

State explicitly which gates were run for a given change. "Done" without saying which gates passed is not an acceptable status update.

**CI pipeline (`.github/workflows/ci.yml`) -- one job per branch, each push-triggered, each scoped to what that stage is actually for:**

| Branch | Job | Runs | Why |
|---|---|---|---|
| `development` | `development-tests` | syntax check, `lint:css`, `astro build`, `node --test`, Playwright (no Lighthouse) | Full functional pack, fires immediately on every push -- this is where new-feature bugs get caught, right after the push that introduced them, and where iteration happens. |
| `staging` | `performance` | `astro build`, Lighthouse | Functional correctness was already proven on `development` against this exact code; re-running the full pack would be re-testing an unchanged input. Performance budgets are the one thing the dev pack doesn't cover. |
| `main` | `sanity` | `astro build`, `node --test` | Can't block anything after the fact (see below), but gives an immediate automated signal if something is visibly broken on the branch that drives the production deploy. |

**Deliberately no `pull_request` trigger and no branch-protection required-status-check** (backlog #117 -- closed as not-applicable to this design, not done). There's no PR-attached check for branch protection to gate on, so promotion safety is procedural: confirm the previous stage's push was green before promoting, not a technical block on the merge button. That's the right tradeoff for a single-maintainer pipeline with no parallel or forked development. If this project ever grows multiple contributors or forks, revisit this -- add `pull_request` triggers back and turn on branch protection, since "trust the last push was checked" stops holding once more than one person can push.

**Playwright/Lighthouse cannot run in this project's Claude sandbox** -- both need to download a browser, and that sandbox's network allowlist blocks it. `node --test` and everything else here (lint, build) has no such dependency and always runs locally before a commit. This is why gate 4 (Live-verified) for anything with DOM/browser behavior means either the connected Chrome browser tools against a deployed URL, or waiting for the relevant CI stage to actually run -- not a local Playwright run, which structurally cannot happen here.

## Adding a new tool page

1. Copy the structure of an existing tool page closest to what you're building (Base64 Tool for a simple encode/decode pair, JSON Formatter for a grouped-panel input).
2. Import and use `InputToolbar`/`OutputToolbar` — don't hand-roll toolbar markup.
3. Use existing tokens for every color. Run `npm run lint:css` before committing; CI will catch it anyway, but it's faster locally.
4. Add Clear + Copy affordances by default — every existing tool has them, and their absence has been reported as a bug before.
5. Run `npm test` (builds + runs the full `node --test` suite) before pushing.
