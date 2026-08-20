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

## Adding a new tool page

1. Copy the structure of an existing tool page closest to what you're building (Base64 Tool for a simple encode/decode pair, JSON Formatter for a grouped-panel input).
2. Import and use `InputToolbar`/`OutputToolbar` — don't hand-roll toolbar markup.
3. Use existing tokens for every color. Run `npm run lint:css` before committing; CI will catch it anyway, but it's faster locally.
4. Add Clear + Copy affordances by default — every existing tool has them, and their absence has been reported as a bug before.
5. Run `npm test` (builds + runs the full `node --test` suite) before pushing.
