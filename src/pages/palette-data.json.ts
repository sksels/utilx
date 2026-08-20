// CR#8 #35/#70: build-time-generated static JSON, fetched lazily by the palette module only
// when a visitor actually opens the palette (see public/command-palette.js) -- deliberately
// NOT inlined into every page's HTML, so visitors who never open the palette pay zero bytes
// for it. Since the whole site is output:'static', this endpoint is pre-rendered at build
// time into a real dist/palette-data.json file, same as any other static asset -- no server
// involved at request time. Cache-Control is scoped separately in netlify.toml (a real
// max-age, not the sitewide /*.js no-cache rule) since this only changes when
// src/data/tools.json / guides.json do, not on every deploy.
import { getCollection } from 'astro:content';

export async function GET() {
  const tools = (await getCollection('tools'))
    .sort((a, b) => a.data.order - b.data.order)
    .map((t) => ({ id: t.id, ...t.data }));
  const guides = (await getCollection('guides')).sort((a, b) => a.data.order - b.data.order);
  const guidesData = guides.map((g) => ({ id: g.id, ...g.data }));

  return new Response(JSON.stringify({ tools, guides: guidesData }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
