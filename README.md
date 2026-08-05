# UtilX ---— Launch Playbook ----

A free static site with six client-side developer tools (JSON formatter, regex tester, cron builder, password/UUID generator, Base64 tool, color converter) plus four SEO guide pages and the About/Privacy/Contact pages AdSense requires. Everything runs in the browser — no backend, no database, no user data collected.

Brand: **UtilX**. Domain: **utilx.tools** (chosen deliberately over the exact-match `.com`/`.dev` so the brand isn't locked to "developer tools only" as more general-purpose utilities get added later).

## Status: already done

- [x] Brand renamed to UtilX throughout every page, `README.md`, `sitemap.xml`, and `robots.txt`.
- [x] All canonical URLs, sitemap entries, and the contact email point to `utilx.tools` / `hello@utilx.tools`.
- [x] Open Graph + Twitter Card tags added to every page (so links shared on Reddit/HN/Twitter/Discord render with a title, description, and image instead of a bare link).
- [x] JSON-LD `SoftwareApplication` structured data added to all six tool pages.
- [x] Plausible Analytics script tag scaffolded (commented out) in every page's `<head>`, and `privacy.html` already discloses it.

## 1. Domain — registered ✅

utilx.tools is registered at Namecheap (domain privacy enabled). Next: point its DNS at whichever host you deploy to (see Section 2), which is the current step.

## 2. Deploy for free

Any of these work well for a static site with no build step:

**Netlify** (easiest)
1. Create a free account at netlify.com.
2. Drag the `devtoolbox` folder onto the Netlify dashboard, or connect a GitHub repo for auto-deploys.
3. Add your custom domain under Site settings → Domain management.

**Vercel**
1. Push this folder to a GitHub repo.
2. Import the repo at vercel.com — no config needed for static HTML.
3. Add your custom domain under Project → Settings → Domains.

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → set source to the `main` branch root.
3. Add a `CNAME` file with your domain if using a custom one.

All three include free HTTPS, which AdSense requires.

## 3. Remaining setup before/around launch

- [x] `og-image.png` created and dropped in the site root — matches the site's dark theme with the UtilX wordmark and tool chips.
- [ ] Sign up at plausible.io (or Fathom/Simple Analytics as alternatives), confirm the domain, then uncomment the `<script defer data-domain="utilx.tools" ...>` line already sitting in every page's `<head>`.
- [ ] Set the real "last updated" date in `privacy.html` (currently a bracketed placeholder) once you actually publish.
- [ ] Verify `hello@utilx.tools` is a real, monitored inbox before launch — most registrars offer free email forwarding (or use something like ImprovMX) to route it to your personal address. AdSense reviewers do check that the contact page works.

## 4. Deploy, then force indexing (don't just wait for Google to crawl)

1. Deploy via one of the options above.
2. Verify the domain in [Google Search Console](https://search.google.com/search-console), submit `sitemap.xml`, then use "URL Inspection → Request Indexing" on every individual page — this alone is the difference between pages showing up in search within a day vs. sitting unindexed for weeks.
3. Do the same in [Bing Webmaster Tools](https://www.bing.com/webmasters) — free, five minutes, commonly skipped.

## 5. Get real traffic in week one (don't wait on organic search)

A brand-new domain won't rank for competitive terms for months no matter how good the SEO is — that's a trust/authority ramp Google enforces regardless of quality. Early traffic has to come from channels that don't depend on search ranking:
- **Show HN** on Hacker News — the single highest-leverage free channel for a tool like this; post on a US weekday morning, frame it around the "no tracking, runs entirely in your browser" angle rather than pure self-promo.
- **Reddit** — r/webdev, r/SideProject, r/InternetIsBeautiful (check each subreddit's self-promo rules first).
- **Indie Hackers** — post it as a launch with the actual backstory.
- **dev.to** — write a short "why I built this" article rather than just dropping a link; it also hands you a backlink.
- **Product Hunt** — schedule a proper launch day.
- **Free tool directories** — AlternativeTo, SaaSHub, Betalist, Uneed — small trickle of direct traffic, plus backlinks that help domain authority compound faster.

## 6. Before applying for AdSense

- [ ] Let the site sit live for at least a few weeks with some real traffic before applying — Google wants evidence the site is used, not just published.
- [ ] Consider adding 2-3 more guide pages (e.g. "UUID vs auto-increment IDs," "URL encoding vs Base64," "Common HTTP status codes explained") to strengthen content depth — more indexed pages generally means a faster, smoother approval.

## 7. Apply to Google AdSense

1. Go to adsense.google.com and sign up with your domain.
2. Once approved, Google gives you a `<script>` snippet — paste it into the `<head>` of every HTML page (there's a comment marking where in each file: `<!-- Google AdSense ... -->`).
3. Replace each `<div class="ad-slot">` placeholder with an actual `<ins class="adsbygoogle">` ad unit from your AdSense dashboard.
4. Typical review time is a few days to a few weeks.

## 8. While you wait on AdSense (optional)

If you want revenue sooner, some networks approve small/new sites faster and can run alongside or before AdSense:
- **Ezoic** — works with lower traffic sites, has an "Access Now" tier with no minimum traffic requirement.
- **Media.net** — Bing/Yahoo contextual ads, sometimes faster approval than AdSense.
- **Carbon Ads** — good fit for a developer-tools audience specifically, but requires an application and has curated advertisers.

## 9. Growing traffic afterward

- Add more tools over time (URL encoder, hash generator, timestamp converter, diff checker) — each new tool page is another entry point from search.
- Keep an eye on Search Console for which queries bring impressions but few clicks (weak title/description) vs. zero impressions (not ranking yet), and expand guide content around whatever's already getting found.
- Target long-tail, specific-phrasing queries rather than head terms like "json formatter" — a new domain has a realistic shot at ranking for the former within weeks, not the latter within months.

## File structure

```
devtoolbox/
  index.html                     Home page — links to all tools and guides
  style.css                      Shared styling
  robots.txt / sitemap.xml       SEO essentials
  about.html / privacy.html / contact.html
  tools/
    json-formatter.html
    regex-tester.html
    cron-builder.html
    password-generator.html
    base64-tool.html
    color-converter.html
  guides/
    what-is-json.html
    regex-cheatsheet.html
    cron-syntax-guide.html
    understanding-base64.html
```
