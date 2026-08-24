// CR#8 #35 (backlog #236): command-palette.js is an ES module (uses import()/export, needed
// for the dynamic-import lazy-load design -- see backlog #70), unlike this repo's other
// public/ libs which use the UMD pattern for CommonJS interop. Node's `import()` works from a
// CommonJS test file either way, so no special test-runner config is needed -- just load it
// async. Only buildEntries() is unit-tested here: everything else in that file touches the DOM
// directly (open/close, keyboard nav, Fuse wiring) and is covered by
// e2e/command-palette.spec.js instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule() {
  const modPath = path.join(__dirname, '..', 'public', 'command-palette.js');
  return import(pathToFileURL(modPath).href);
}

test('buildEntries maps tools with kind, chipClass, iconSvg preserved', async () => {
  const { buildEntries } = await loadModule();
  const entries = buildEntries({
    tools: [
      { id: 'json-formatter', label: 'JSON Formatter & Validator', description: 'Beautify JSON.', url: '/tools/json-formatter.html', chipClass: 'chip-json', iconSvg: '<path d="M1 1"/>' },
    ],
    guides: [],
  });
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    id: 'json-formatter',
    kind: 'tool',
    label: 'JSON Formatter & Validator',
    description: 'Beautify JSON.',
    url: '/tools/json-formatter.html',
    chipClass: 'chip-json',
    iconSvg: '<path d="M1 1"/>',
  });
});

test('buildEntries maps guides with kind "guide" and null chip/icon fields', async () => {
  const { buildEntries } = await loadModule();
  const entries = buildEntries({
    tools: [],
    guides: [
      { id: 'what-is-json', label: 'JSON Basics', description: 'A guide.', url: '/guides/what-is-json.html' },
    ],
  });
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    id: 'what-is-json',
    kind: 'guide',
    label: 'JSON Basics',
    description: 'A guide.',
    url: '/guides/what-is-json.html',
    chipClass: null,
    iconSvg: null,
  });
});

test('buildEntries concatenates tools before guides, preserving each list\'s own order', async () => {
  const { buildEntries } = await loadModule();
  const entries = buildEntries({
    tools: [
      { id: 't1', label: 'Tool 1', description: '', url: '/t1', chipClass: 'chip-json', iconSvg: '' },
      { id: 't2', label: 'Tool 2', description: '', url: '/t2', chipClass: 'chip-regex', iconSvg: '' },
    ],
    guides: [
      { id: 'g1', label: 'Guide 1', description: '', url: '/g1' },
    ],
  });
  assert.deepEqual(entries.map((e) => e.id), ['t1', 't2', 'g1']);
});

test('buildEntries returns an empty array for missing/empty tools and guides', async () => {
  const { buildEntries } = await loadModule();
  assert.deepEqual(buildEntries({}), []);
  assert.deepEqual(buildEntries({ tools: [], guides: [] }), []);
});
