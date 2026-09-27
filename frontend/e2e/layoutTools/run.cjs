/**
 * Connect's layout tools on zones of different sizes, in real Chromium
 * (Task #2030).
 *
 * Bundles the real Phone Hub page (UIOverlaysTab) with a stubbed API
 * (apiStub.js: a Homepage with a 12×6 camera, a 16×8 phone and a 22×11 map
 * pin), opens Connect, and for each tool on a fresh page presses its button
 * with nothing selected (so it acts on every zone). It then records each
 * zone's x, y, w, h (from its style, in % of the screen) and the centre of
 * the icon as drawn (from the browser's layout, in % of the screen), and
 * checks the tool's intended result:
 *
 *   Make Row     centres on one row, evenly spaced
 *   Make Column  centres in one column, evenly spaced
 *   Align L / R  left / right edges equal
 *   Align C      centres on one vertical line
 *   Dist H / V   centres evenly spaced
 *   Equal Size   one size, each zone's centre kept
 *   Snap to Grid / Auto Layout  each centre on a home-grid slot's centre
 *
 * Every zone must stay inside 0–100. Exits non-zero if any check fails.
 *
 * Not part of CI. Run from the repo root, with Playwright's Chromium:
 *   NODE_PATH=$(npm root -g) node frontend/e2e/layoutTools/run.cjs
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { build } = require(path.join(__dirname, '../../node_modules/esbuild'));
const { chromium } = require('playwright');

// The home grid (frontend/src/components/phone/homeGrid.js).
const GRID = { columns: 4, originX: 8, originY: 14, stepX: 21, stepY: 14, width: 12, height: 9 };
const TOL = 0.05; // % of the screen; the drawn centre is rounded to whole pixels

const TOOLS = [
  'Make Row', 'Make Column', 'Align L', 'Align C', 'Align R',
  'Dist H', 'Dist V', 'Equal Size', 'Snap to Grid', 'Auto Layout',
];

const near = (a, b) => Math.abs(a - b) <= TOL;
const allNear = (xs) => xs.every((x) => near(x, xs[0]));
const evenSteps = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const steps = s.slice(1).map((x, i) => x - s[i]);
  return steps.every((d) => near(d, steps[0]));
};
const onSlotCentre = (z) => {
  const col = (z.cx - GRID.width / 2 - GRID.originX) / GRID.stepX;
  const row = (z.cy - GRID.height / 2 - GRID.originY) / GRID.stepY;
  return near(col, Math.round(col)) && near(row, Math.round(row));
};

function check(tool, before, after) {
  const cx = after.map((z) => z.cx);
  const cy = after.map((z) => z.cy);
  const inside = after.every((z) => z.x >= -TOL && z.y >= -TOL && z.x + z.w <= 100 + TOL && z.y + z.h <= 100 + TOL);
  const drawnMatches = after.every((z) => near(z.cx, z.drawnCx) && near(z.cy, z.drawnCy));
  let ok;
  switch (tool) {
    case 'Make Row': ok = allNear(cy) && evenSteps(cx); break;
    case 'Make Column': ok = allNear(cx) && evenSteps(cy); break;
    case 'Align L': ok = allNear(after.map((z) => z.x)); break;
    case 'Align C': ok = allNear(cx); break;
    case 'Align R': ok = allNear(after.map((z) => z.x + z.w)); break;
    case 'Dist H': ok = evenSteps(cx); break;
    case 'Dist V': ok = evenSteps(cy); break;
    case 'Equal Size': {
      const byId = new Map(before.map((z) => [z.id, z]));
      ok = allNear(after.map((z) => z.w)) && allNear(after.map((z) => z.h))
        && after.every((z) => near(z.cx, byId.get(z.id).cx) && near(z.cy, byId.get(z.id).cy));
      break;
    }
    case 'Snap to Grid':
    case 'Auto Layout': ok = after.every(onSlotCentre); break;
    default: ok = false;
  }
  return { ok: ok && inside && drawnMatches, inside, drawnMatches };
}

(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-tools-'));
  await build({
    entryPoints: [path.join(__dirname, '../iconDrag/entry.jsx')],
    bundle: true, outdir: out, jsx: 'automatic', logLevel: 'error',
    loader: { '.js': 'jsx', '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.MODE': '"production"', 'import.meta.env.VITE_API_URL': '""' },
    plugins: [{ name: 'stub-api', setup(b) { b.onResolve({ filter: /services\/api$/ }, () => ({ path: path.join(__dirname, 'apiStub.js') })); } }],
  });
  fs.copyFileSync(path.join(__dirname, '../../src/styles/design-tokens.css'), path.join(out, 'design-tokens.css'));
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="design-tokens.css"><link rel="stylesheet" href="entry.css"><style>body{margin:0;background:#FAF7F0}</style></head><body><div id="root"></div><script src="entry.js"></script></body></html>`);

  const browser = await chromium.launch();

  // Each zone's box from its style, and the drawn icon's centre from layout,
  // both in % of the screen surface the zones sit on.
  const measure = (page) => page.evaluate(() => {
    const zones = [...document.querySelectorAll('.zones-tab__canvas [data-zone-id]')];
    // Zones are placed in % of the surface's padding box, inside its border.
    const host = zones[0].parentElement;
    const outer = host.getBoundingClientRect();
    const surface = { left: outer.left + host.clientLeft, top: outer.top + host.clientTop, width: host.clientWidth, height: host.clientHeight };
    return zones.map((el) => {
      const img = el.querySelector('img').getBoundingClientRect();
      const n = (v) => Math.round(parseFloat(v) * 100) / 100;
      const z = { id: el.dataset.zoneId, x: n(el.style.left), y: n(el.style.top), w: n(el.style.width), h: n(el.style.height) };
      z.cx = Math.round((z.x + z.w / 2) * 100) / 100;
      z.cy = Math.round((z.y + z.h / 2) * 100) / 100;
      z.drawnCx = Math.round(((img.left + img.width / 2 - surface.left) / surface.width) * 10000) / 100;
      z.drawnCy = Math.round(((img.top + img.height / 2 - surface.top) / surface.height) * 10000) / 100;
      return z;
    });
  });

  const fmt = (z) => `${z.id.padEnd(9)} x ${String(z.x).padStart(6)} y ${String(z.y).padStart(6)} w ${String(z.w).padStart(5)} h ${String(z.h).padStart(5)}  centre (${z.cx}, ${z.cy})  drawn (${z.drawnCx}, ${z.drawnCy})`;

  let failed = 0;
  let printedStart = false;
  for (const tool of TOOLS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file://' + path.join(out, 'index.html'));
    await page.click('.phone-hub-stage-row >> text=Connect');
    await page.waitForSelector('.zones-tab__canvas [data-zone-id="z-pin"] img');
    await page.waitForTimeout(100);
    const before = await measure(page);
    if (!printedStart) {
      console.log('START (every tool begins here)');
      before.forEach((z) => console.log('  ' + fmt(z)));
      printedStart = true;
    }
    await page.click(`.zones-tap-tools button:text-is("${tool}")`);
    await page.waitForTimeout(150);
    const after = await measure(page);
    const r = check(tool, before, after);
    if (!r.ok || errors.length) failed += 1;
    console.log(`\n${tool}: ${r.ok && !errors.length ? 'PASS' : 'FAIL'}${r.inside ? '' : ' (outside 0–100)'}${r.drawnMatches ? '' : ' (drawn centre differs)'}${errors.length ? ' errors: ' + errors.join('; ') : ''}`);
    after.forEach((z) => console.log('  ' + fmt(z)));
    await page.close();
  }
  await browser.close();
  console.log(`\n${TOOLS.length - failed} of ${TOOLS.length} tools pass`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
