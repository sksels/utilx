# UtilX — Development & Deployment Architecture

Explains the tech stack, why each piece was chosen, how the three environments (development /
staging / production) map to git branches, Netlify deploys, and Turso databases, and how the
GitHub Actions CI/CD pipeline is structured and why. Companion to `STYLE_GUIDE.md` (design
tokens, CSS conventions, Definition of Done policy) and `RELEASE_PROCESS.md` (the exact
step-by-step commands for shipping a change).

## 1. What this site is

A static site with six client-side developer tools (JSON Formatter, Regex Tester, Cron Builder,
Password/UUID Generator, Base64 Tool + JWT Decoder, Color Converter), four SEO guide pages, a
command palette (Cmd/Ctrl+K), About/Contact/Privacy pages, and an auth-gated admin analytics
dashboard. The core pitch is privacy: every tool runs entirely in the browser — "0 cookies, 0
trackers," nothing typed into a tool is ever sent to a server. The two things that *do* touch a
server are self-hosted pageview analytics and (once approved) Google AdSense.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | [Astro](https://astro.build), `output: 'static'` | Zero server-rendering needs — every tool is pure client-side JS. Static output means no adapter, no server runtime to operate. `build.format: 'file'` preserves the site's original URL style (`about.html`, not `about/index.html`). |
| Bundler/dev server | Vite (bundled with Astro) | Comes for free with Astro; fast HMR during development. |
| Tool logic | Vanilla JavaScript, no framework | Keeps the client bundle deliberately small — matters both for the performance budget (see §6) and for the "nothing but your browser" privacy pitch; a framework runtime would work against both. |
| Search (command palette) | [Fuse.js](https://fusejs.io), vendored | Fuzzy-search over the tools/guides registry. Lazy-loaded via dynamic `import()` on first Cmd/Ctrl+K press (with an idle-time prefetch), so pages that never open the palette pay nothing for it. |
| CSS | Hand-written, enforced by [Stylelint](https://stylelint.io) (`stylelint-config-standard` + `stylelint-declaration-strict-value`) | The strict-value plugin forbids raw colors/sizes outside the design-token custom properties defined in `STYLE_GUIDE.md`, keeping the whole site visually consistent as it's grown across 8+ Change Releases. |
| PWA | `manifest.json` + `service-worker.js` (precache + toast-and-wait update UX) | Installable, works offline once cached. Cache version is stamped per-deploy (see §4) so updates roll out cleanly instead of serving stale cached JS. |
| Testing | `node --test` (unit), Playwright + axe-core (layout/a11y e2e), Lighthouse CI (performance) | See §6. |
| Data layer | [Turso](https://turso.tech) (libSQL, via `@libsql/client`) | See §5. |
| Hosting | [Netlify](https://www.netlify.com) | See §4. |
| CI/CD | GitHub Actions | See §6. |

## 3. Repo layout (high level)

```
devtoolbox/
├─ src/                  Astro pages/components/layouts (source of truth for markup)
├─ public/               Static assets served as-is: style.css, all client-side .js, tool libs
│  └─ tools/lib/          Pure tool logic (json-tools.js, regex-run.js, base64.js, etc.) —
│                         unit-tested directly by tests/*.test.js
├─ tests/                node:test unit suite
├─ e2e/                  Playwright specs (layout assertions, accessibility, palette, clipboard)
├─ netlify/functions/    stats.js, track.js — the only two server-side endpoints in the project
├─ .github/workflows/    ci.yml (see §6), dependabot.yml
├─ .lighthouserc.json    Lighthouse CI budgets (§6)
├─ .stylelintrc.json     CSS lint rules (§2)
├─ netlify.toml          Build command, security headers, Node version pin (§4)
├─ README.md             Launch playbook (deploy steps, AdSense application checklist, growth)
├─ RELEASE_PROCESS.md    Exact commands for shipping a change through all three environments
├─ STYLE_GUIDE.md        Design tokens, CSS conventions, Definition of Done / CI policy
└─ ARCHITECTURE.md       This document
```

## 4. Hosting & deploy: Netlify

Netlify builds and serves everything — the static Astro output in `dist/`, and the two
serverless Netlify Functions in `netlify/functions/` — from the same repo, no separate backend
to operate.

- **Branch = environment.** Netlify is configured to build all three tracked branches
  (`development`, `staging`, `main`), each getting its own deploy context, its own preview URL,
  and its own scoped environment variables. `main` deploys to production, `utilx.tools`.
- **Build command** (`netlify.toml` → `[build] command`):
  `npm run build && sed -i "s/__CACHE_VERSION__/$COMMIT_REF/" dist/service-worker.js` — runs the
  Astro build, then stamps that deploy's commit SHA into the service worker's cache-version
  placeholder in the *built* file only (the source in `public/` stays untouched). This means
  every deploy that touches a cached asset automatically gets a fresh cache name — no manual
  version bump to remember or forget.
- **Node version pin:** `NODE_VERSION = "22"` in `[build.environment]` — Astro 7 requires
  Node ≥22.12.0; without pinning, Netlify's build image could default to an older version and
  fail a deploy that builds fine locally.
- **Security headers** are set directly in `netlify.toml`: a Content-Security-Policy (with a
  documented, deliberate `unsafe-inline` on script/style — the site's 100+ `onclick="..."` and
  inline `style="..."` attributes across every tool page require it; the actual XSS defense is
  output-escaping, not CSP, so this is a real known tradeoff rather than an oversight),
  X-Frame-Options, and `frame-ancestors` for clickjacking protection.

## 5. Data layer: Turso

Turso is a hosted, edge-distributed SQLite-compatible database (libSQL). It's used for exactly
one thing: self-hosted, privacy-preserving pageview analytics — an alternative to bringing in
Google Analytics or a third-party tracker, consistent with the site's "0 cookies, 0 trackers"
promise.

- **Three fully isolated databases**, one per environment (development / staging / production).
  No shared state — a bug or bad data on `staging` can never leak into production numbers, and
  local iteration never pollutes real analytics.
- **`netlify/functions/track.js`** — records one pageview per hit. No cookies and no raw IP
  address are ever stored: the visitor's IP + user-agent + the current date are hashed together
  (salted via the `HASH_SALT` environment variable) into a one-way identifier, used only to
  distinguish a genuine unique visitor from a page refresh. If `HASH_SALT` isn't set, it falls
  back to a hardcoded default and logs a loud warning once per cold start — deliberately noisy
  so a missing salt in a real environment doesn't go unnoticed silently.
- **`netlify/functions/stats.js`** — returns aggregated stats consumed by `/admin/stats.html`.
  Gated behind a shared-secret bearer token (`STATS_ACCESS_TOKEN`), compared with
  `crypto.timingSafeEqual` to avoid leaking the correct value via response-timing side channels.
  Fails **closed**: if `STATS_ACCESS_TOKEN` isn't configured, every request is rejected — a
  misconfiguration should never silently mean "public to everyone," which is exactly what this
  endpoint used to do before the security release that added this gate.
- Both functions lazily create their Turso client and `pageviews` table on first invocation per
  cold start, rather than at module load, so a missing environment variable only breaks the
  specific request that needed it.

## 6. Git branching ↔ environment mapping

| Branch | Netlify deploy | Turso database | Purpose |
|---|---|---|---|
| `development` | dev preview URL | dev DB | Active iteration; every push runs the full functional test pack (§7) |
| `staging` | staging preview URL | staging DB | Pre-production QA; every push runs the Lighthouse performance gate |
| `main` | **utilx.tools** (production) | production DB | Live site; every push runs a fast sanity check |

Promotion is strictly one-directional: `development → staging → main`. There is no reverse flow
and no branch skips a stage. See `RELEASE_PROCESS.md` for the exact commands.

## 7. CI/CD: GitHub Actions

One workflow, `.github/workflows/ci.yml`, split into three jobs — each scoped to exactly one
branch via `if: github.ref_name == '...'`, so a given push only ever triggers one job:

| Branch | Job | Steps | Why this scope |
|---|---|---|---|
| `development` | **Development test pack** | syntax-check every `.js` file, `stylelint`, `astro build`, `node --test`, Playwright (layout assertions + axe-core accessibility) — everything except Lighthouse | The full functional pack, run immediately on every push. This is where new-feature bugs get caught right after the push that introduced them. |
| `staging` | **Performance gate** | `astro build`, Lighthouse CI (`.lighthouserc.json` budgets: performance score, LCP, CLS, etc.) | Functional correctness was already proven on `development`; re-running that whole pack against unchanged code would be redundant. Performance is the one thing it doesn't cover. |
| `main` | **Production sanity check** | `astro build`, `node --test` | Fast, can't block anything after the fact (the code is already live), but gives an immediate automated signal if the branch driving production is visibly broken. |

**Deliberately push-triggered only** — no `pull_request` trigger, and no branch-protection
required-status-checks. This means CI never technically blocks a merge; it's purely informational.
That's a considered tradeoff, not an oversight: this is a single-maintainer project with no
forks or parallel contributors, so promotion safety is procedural — check that the previous
stage's run was green before promoting — rather than a technical gate on the merge button.
**Revisit this** (add `pull_request` triggers and real branch protection back) if the project
ever grows multiple forks or parallel development, where "trust that the last push was checked"
stops holding. (Backlog #117, closed as "not applicable to this design" rather than done;
policy documented in `STYLE_GUIDE.md`'s Definition of Done section.)

Other pipeline details:

- `permissions: contents: read` is pinned at the workflow level — these jobs only ever check out
  code and run tests, so the default broader `GITHUB_TOKEN` permissions are deliberately
  narrowed to limit blast radius if the workflow or a dependency action is ever compromised.
- **Dependabot** (`.github/dependabot.yml`) opens weekly PRs for npm and GitHub Actions
  dependencies. Routine minor/patch bumps are grouped into a single PR to keep the review queue
  manageable on a solo-maintained project; major version bumps are excluded from grouping so
  they still surface individually for review.

## 8. Testing layers

| Layer | Tool | What it covers | Runs where |
|---|---|---|---|
| Unit | `node --test` | Pure logic in `tools/lib/*.js` and shared libs (url-state, clipboard-detect, command-palette's `buildEntries`, etc.) — 293 tests as of Aug 24 2026 | `development-tests` and `sanity` jobs |
| Lint | Stylelint | CSS design-token enforcement, duplicate-selector detection | `development-tests` |
| End-to-end | Playwright + axe-core | Layout assertions, keyboard nav, drag interactions, accessibility violations — Chromium only (kept fast; these checks don't need cross-browser coverage) | `development-tests` |
| Performance | Lighthouse CI | Performance/accessibility/best-practices/SEO scores and Core Web Vitals budgets against all 7 main pages | `performance` (staging) |

**Important sandbox limitation:** neither Playwright nor Lighthouse can run inside this project's
Claude sandbox — its network allowlist blocks the Chromium download both tools need. Real
verification for those two layers only ever happens in an actual GitHub Actions run; any claim
of "tested" for e2e/performance work must point at a real CI run, not a local one.

## 9. Security posture

- CSP + security headers via `netlify.toml` (§4), with the documented `unsafe-inline` caveat.
- All user-facing error messages are HTML-escaped before insertion, closing a reflected-XSS class
  of bug found and fixed in the security release.
- The only server-side endpoint with real data (`stats.js`) is auth-gated and fails closed (§5).
- No cookies, no third-party trackers other than the (not-yet-live) AdSense loader, which itself
  is deferred to page idle rather than loaded eagerly.

## 10. Known deliberate tradeoffs / open items

- CI has no PR gate or branch protection (§7) — revisit if the project gains parallel
  contributors or forks.
- The AdSense loader is present site-wide but deferred to page idle (as of Aug 24 2026); no
  `<ins class="adsbygoogle">` ad units are live yet — Auto Ads is pending Google's approval.
- `base64-tool.html` does not yet meet the `staging` Performance gate's Lighthouse LCP budget
  (parked as backlog #73 — see the backlog tracker for the full diagnostic trail).
