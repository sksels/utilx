// Single source of truth for "what tools/guides exist on this site" -- backlog #69 (sub-item
// of CR#8 #35, the command palette). Built ahead of the palette itself per the site owner's
// call to do this "fundamental design change" upfront rather than retrofit it later.
//
// Today this only drives the homepage tile grid (see src/pages/index.astro). The point of
// putting it here, instead of a plain src/data/tools.js array, is the Zod schema below: a
// missing/misspelled field on a new tool entry fails the build loudly instead of silently
// drifting out of sync the way the toolbar-centering CSS rule once did (see that fix's own
// comment in style.css). When #35 is implemented, its search index and quick-actions list
// should read from getCollection('tools')/getCollection('guides') too, not keep a second
// hand-typed list -- that was the whole reason this was worth doing now instead of later.
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

const tools = defineCollection({
  loader: file('src/data/tools.json'),
  schema: z.object({
    // Default homepage tile order (ascending). Required, not inferred from JSON array
    // position -- verified locally that Astro's file() loader does not preserve source
    // array order (getCollection() returned these 6 entries sorted alphabetically by id
    // instead), which would have silently reordered the homepage on first visit. This field
    // exists specifically so that regression can't reoccur. tile-order.js's own saved
    // drag-reorder (once a visitor has customized it) still takes priority over this, same
    // as before -- this only sets the *default*.
    order: z.number(),
    // Display name, shown as the tile's <h3> and (future) the palette's result label.
    label: z.string(),
    // One-line description, shown under the label.
    description: z.string(),
    // Tool page URL, e.g. '/tools/json-formatter.html'.
    url: z.string(),
    // Must match one of style.css's existing chip-* classes (chip-json, chip-regex, chip-cron,
    // chip-password, chip-base64, chip-color) -- also drives the popup border/icon-chip color
    // via :root.popup-mode[data-tool-id="..."] (CR#8 #57/#58). Enforced by the regex below so
    // a typo'd chip class fails the build rather than silently rendering unstyled.
    chipClass: z.string().regex(/^chip-[a-z0-9-]+$/, 'chipClass must match an existing chip-* class in style.css'),
    // Raw inner SVG markup (path/circle/line elements only, no outer <svg> tag) -- every tile
    // icon shares the same outer <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    // stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"> wrapper, hardcoded
    // once in index.astro, so only the per-tool inner shape needs to live in data.
    iconSvg: z.string(),
    // The tile's second link -- either "Guide: X" (points into /guides/) or "Related: X"
    // (points at another tool page, for tools with no guide page of their own today).
    relatedLabel: z.string(),
    relatedUrl: z.string(),
    // Extra search terms a fuzzy match against `label` alone would miss (see backlog #68,
    // e.g. "beautify"/"prettify" for JSON Formatter, "guid" for the UUID generator). Not
    // consumed anywhere yet -- populated now so #35/#68 don't need a second data pass later.
    aliases: z.array(z.string()).default([]),
  }),
});

const guides = defineCollection({
  loader: file('src/data/guides.json'),
  schema: z.object({
    label: z.string(),
    description: z.string(),
    url: z.string(),
  }),
});

export const collections = { tools, guides };
