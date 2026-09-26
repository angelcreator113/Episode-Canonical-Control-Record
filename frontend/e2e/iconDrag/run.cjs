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
    await page.click('role=tab[name="Icon"]');
    const icon = await page.waitForSelector('.zones-tab__canvas [data-icon-id="z-call"]');
    // Record where pointer and click events land, in the capture phase.
    await page.evaluate(() => {
      window.__events = [];
      const where = (t) => (t.closest && t.closest('[data-icon-id]') ? 'icon' : (t.closest && t.closest('[style*="crosshair"]') ? 'phone' : 'other'));
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
      iconSelected: await page.isVisible('.zones-tab__icon-panel input[placeholder="Label"]'),
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

  console.log(JSON.stringify([drag, click], null, 1));
  await browser.close();
  const ok = drag.moved && !drag.pickerOpen && drag.cursorDuring === 'grabbing'
    && !click.moved && !click.pickerOpen && click.iconSelected
    && drag.pageErrors.length === 0 && click.pageErrors.length === 0;
  console.log(ok ? 'PASS: the icon drags with the mouse, a click selects it, and no picker opens' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
