/**
 * Zone drag, click and tap-to-place with a real mouse, in real Chromium
 * (Task #2018; one Connect editor since Task #2021).
 *
 * Bundles the real Phone Hub page (UIOverlaysTab) with a stubbed API
 * (apiStub.js), opens Connect, and uses page.mouse on the placed Call zone:
 * a drag (move, down, six moves, up), a plain click, and a tap on an empty
 * spot that opens the picker beside the phone, where picking Call places a
 * second zone. Prints where the pointer and click events landed and what
 * happened, and exits non-zero unless the drag moved and selected the zone,
 * the click selected it, neither left the picker open, and the tap placed
 * the icon from the picker beside the phone.
 *
 * Not part of CI. Run from the repo root, with Playwright's Chromium:
 *   NODE_PATH=$(npm root -g) node frontend/e2e/iconDrag/run.cjs
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { build } = require(path.join(__dirname, '../../node_modules/esbuild'));
const { chromium } = require('playwright');

(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-drag-'));
  await build({
    entryPoints: [path.join(__dirname, 'entry.jsx')],
    bundle: true, outdir: out, jsx: 'automatic', logLevel: 'error',
    loader: { '.js': 'jsx', '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.MODE': '"production"', 'import.meta.env.VITE_API_URL': '""' },
    plugins: [{ name: 'stub-api', setup(b) { b.onResolve({ filter: /services\/api$/ }, () => ({ path: path.join(__dirname, 'apiStub.js') })); } }],
  });
  fs.copyFileSync(path.join(__dirname, '../../src/styles/design-tokens.css'), path.join(out, 'design-tokens.css'));
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="design-tokens.css"><link rel="stylesheet" href="entry.css"><style>body{margin:0;background:#FAF7F0}</style></head><body><div id="root"></div><script src="entry.js"></script></body></html>`);

  const browser = await chromium.launch();

  async function scenario(name, steps) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file://' + path.join(out, 'index.html'));
    await page.click('.phone-hub-stage-row >> text=Connect');
    const zone = await page.waitForSelector('.zones-tab__canvas [data-zone-id="z-call"]');
    // Record where pointer and click events land, in the capture phase.
    await page.evaluate(() => {
      window.__events = [];
      const where = (t) => (t.closest && t.closest('[data-zone-id]') ? 'zone' : (t.closest && t.closest('[style*="crosshair"]') ? 'phone' : 'other'));
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        document.addEventListener(type, (e) => window.__events.push(`${type}→${where(e.target)}`), true);
      }
    });
    const styleOf = () => zone.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    const before = await styleOf();
    const box = await zone.boundingBox();
    const note = await steps(page, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
    const after = await styleOf();
    const result = {
      scenario: name,
      before,
      after,
      moved: before.left !== after.left || before.top !== after.top,
      pickerOpen: await page.isVisible('text=PICK AN ICON + WHERE IT OPENS'),
      selected: await page.evaluate(() => !!document.querySelector('.zones-tap-row.active')),
      zoneCount: await page.evaluate(() => document.querySelectorAll('.zones-tab__canvas [data-zone-id]').length),
      note,
      events: await page.evaluate(() => window.__events),
      pageErrors: errors,
    };
    await page.close();
    return result;
  }

  // 1. Drag: press on the zone, move in six steps, release.
  const drag = await scenario('drag', async (page, sx, sy) => {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i += 1) await page.mouse.move(sx + i * 8, sy + i * 12);
    await page.mouse.up();
    return null;
  });
  // 2. Click: press and release on the zone without moving (select it).
  const click = await scenario('click', async (page, sx, sy) => {
    await page.mouse.click(sx, sy);
    return null;
  });
  // 3. Tap on an empty spot: the picker opens beside the phone; pick Call.
  const tapPlace = await scenario('tap-place', async (page) => {
    const canvas = await page.$('.zones-tab__canvas [style*="crosshair"]');
    const cb = await canvas.boundingBox();
    await page.mouse.click(cb.x + cb.width * 0.7, cb.y + cb.height * 0.6);
    const beside = await page.isVisible('.zones-tab__icon-panel >> text=PICK AN ICON + WHERE IT OPENS');
    await page.click('.zones-tab__icon-panel [title="Call"]');
    return beside ? 'picker beside the phone' : 'picker NOT beside the phone';
  });

  console.log(JSON.stringify([drag, click, tapPlace], null, 1));
  await browser.close();
  const ok = drag.moved && !drag.pickerOpen && drag.selected
    && !click.moved && !click.pickerOpen && click.selected
    && tapPlace.note === 'picker beside the phone' && tapPlace.zoneCount === 2 && !tapPlace.pickerOpen
    && [drag, click, tapPlace].every(r => r.pageErrors.length === 0);
  console.log(ok ? 'PASS: a zone drags and a click selects it with the mouse, and a tap places an icon from the picker beside the phone' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
