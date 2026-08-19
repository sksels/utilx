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
| `--accent` | `#5b8cff` | `#3b6fe0` | Links, primary buttons, focus states |
| `--accent-hover` | `#7ba0ff` | `#2f5bc4` | Hover state for accent elements |
| `--accent-soft` | `rgba(91,140,255,.1)` | `rgba(59,111,224,.08)` | Subtle accent backgrounds (gradients, highlights) |
| `--code-bg` | `#0a0c12` | `#eef0f6` | Code/output block backgrounds |
| `--text-on-accent` | `#0a0c12` (theme-invariant) | | Button/toolbar-btn text color on an accent-colored background |
| `--success` | `#4ade80` (theme-invariant) | | Success messages, "copied" flash, click-flash border |
| `--danger` | `#ff6b6b` (theme-invariant) | | Error messages |
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
- `.toolbar-btn.copied` (post-copy flash) swaps to `--success` briefly via `output-toolbar.js`, then reverts.

## Field/output structure

- `.input-target`, `.output-target` — wraps a single field + its toolbar.
- `.output-box` — wraps a `<label>` + `.output-target`, used for every labeled output field.
- `.input-box` — the bordered grouping panel for the two multi-control clusters (see above). Not a generic field wrapper.
- `.card` — the outer bordered section container every tool's major blocks live in.

## Adding a new tool page

1. Copy the structure of an existing tool page closest to what you're building (Base64 Tool for a simple encode/decode pair, JSON Formatter for a grouped-panel input).
2. Import and use `InputToolbar`/`OutputToolbar` — don't hand-roll toolbar markup.
3. Use existing tokens for every color. Run `npm run lint:css` before committing; CI will catch it anyway, but it's faster locally.
4. Add Clear + Copy affordances by default — every existing tool has them, and their absence has been reported as a bug before.
5. Run `npm test` (builds + runs the full `node --test` suite) before pushing.
