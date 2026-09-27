/**
 * Icon drag with a real mouse, in real Chromium (Task #2018).
 *
 * Bundles the real Phone Hub page (UIOverlaysTab) with a stubbed API
 * (apiStub.js), opens Connect → Icon, and uses page.mouse on the placed Call
 * icon twice: a drag (move, down, six moves, up) and a plain click. Prints
 * where the pointer and click events landed and what happened, and exits
 * non-zero unless the drag moved the icon with the grabbing cursor, the
 * click selected it, and neither opened the new-icon picker.
 *
 * Task #2020 adds two TAP-mode scenarios: dragging the placed zone with the
 * mouse, and a mouse tap on an empty spot that opens the picker beside the
 * phone, where picking Call places it.
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

  async function scenario(name, steps, mode = 'icon') {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file://' + path.join(out, 'index.html'));
    await page.click('.phone-hub-stage-row >> text=Connect');
    if (mode === 'icon') await page.click('role=tab[name="Icon"]');
    const icon = await page.waitForSelector(mode === 'icon'
      ? '.zones-tab__canvas [data-icon-id="z-call"]'
      : '.zones-tab__canvas [data-zone-id="z-call"]');
    // Record where pointer and click events land, in the capture phase.
    await page.evaluate(() => {
      window.__events = [];
      const where = (t) => (t.closest && t.closest('[data-icon-id], [data-zone-id]') ? 'icon' : (t.closest && t.closest('[style*="crosshair"]') ? 'phone' : 'other'));
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        document.addEventListener(type, (e) => window.__events.push(`${type}→${where(e.target)}`), true);
      }
    });
    const styleOf = () => icon.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    const before = await styleOf();
    const box = await icon.boundingBox();
    const sx = box.x + box.width / 2; const sy = box.y + box.height / 2;
    const cursorDuring = await steps(page, sx, sy, icon);
    await page.waitForTimeout(150);
    const after = await styleOf();
    const result = {
      scenario: name,
      before,
      after,
      moved: before.left !== after.left || before.top !== after.top,
      pickerOpen: await page.isVisible('text=PICK AN ICON + WHERE IT OPENS'),
      iconSelected: mode === 'icon'
        ? await page.isVisible('.zones-tab__icon-panel input[placeholder="Label"]')
        : await page.evaluate(() => !!document.querySelector('.zones-tap-row.active')),
      zoneCount: await page.evaluate(() => document.querySelectorAll('.zones-tab__canvas [data-zone-id], .zones-tab__canvas [data-icon-id]').length),
      events: await page.evaluate(() => window.__events),
      cursorDuring,
      pageErrors: errors,
    };
    await page.close();
    return result;
  }

  // 1. Drag: press on the icon, move in six steps, release.
  const drag = await scenario('drag', async (page, sx, sy, icon) => {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    let cursor = null;
    for (let i = 1; i <= 6; i += 1) {
      await page.mouse.move(sx + i * 8, sy + i * 12);
      if (i === 3) cursor = await icon.evaluate((el) => el.style.cursor);
    }
    await page.mouse.up();
    return cursor;
  });
  // 2. Click: press and release on the icon without moving (select it).
  const click = await scenario('click', async (page, sx, sy) => {
    await page.mouse.click(sx, sy);
    return null;
  });

  // 3. TAP mode: drag the placed zone with the mouse.
  const tapDrag = await scenario('tap-drag', async (page, sx, sy) => {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i += 1) await page.mouse.move(sx + i * 8, sy + i * 12);
    await page.mouse.up();
    return null;
  }, 'tap');
  // 4. TAP mode: a mouse tap on an empty spot opens the picker beside the
  //    phone; picking Call places a second zone.
  const tapPlace = await scenario('tap-place', async (page) => {
    const canvas = await page.$('.zones-tab__canvas [style*="crosshair"]');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
    const beside = await page.isVisible('.zones-tab__icon-panel >> text=PICK AN ICON + WHERE IT OPENS');
    await page.click('.zones-tab__icon-panel [title="Call"]');
    return beside ? 'picker beside the phone' : 'picker NOT beside the phone';
  }, 'tap');

  console.log(JSON.stringify([drag, click, tapDrag, tapPlace], null, 1));
  await browser.close();
  const ok = drag.moved && !drag.pickerOpen && drag.cursorDuring === 'grabbing'
    && !click.moved && !click.pickerOpen && click.iconSelected
    && tapDrag.moved && !tapDrag.pickerOpen && tapDrag.iconSelected
    && tapPlace.cursorDuring === 'picker beside the phone' && tapPlace.zoneCount === 2 && !tapPlace.pickerOpen
    && [drag, click, tapDrag, tapPlace].every(r => r.pageErrors.length === 0);
  console.log(ok ? 'PASS: icons drag and click in ICON mode; in TAP a zone drags and a tap places an icon from the picker beside the phone' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
