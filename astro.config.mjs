// Static output on purpose: the site has zero server-rendering needs -- every tool runs
// entirely client-side ("0 cookies, 0 trackers, nothing leaves your browser" is the whole
// pitch), and the 2 backend endpoints (netlify/functions/stats.js, track.js) are plain
// Netlify Functions that live and deploy independently of the frontend framework. No Netlify
// adapter needed for that reason -- Netlify serves netlify/functions/ alongside whatever
// static dist/ Astro produces, exactly like it did with the hand-written HTML before this
// migration.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://utilx.tools',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file', // about.html, not about/index.html -- preserves the site's existing URLs
  },
});
