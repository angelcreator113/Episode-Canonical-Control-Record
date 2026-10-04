/**
 * The theme screenshot pass (audit VISUAL-01/02, batch 4, close-out).
 *
 * Serves the production build (frontend/dist, `vite build` first) with
 * `vite preview`, answers every /api call from fixtures.cjs inside the
 * browser (page.route; nothing leaves the machine), signs the session in
 * through localStorage, and shoots each migrated screen at 375, 768, 1024,
 * 1280 and 1440 wide as a full-page PNG. Prints one line per shot with the
 * page errors and the unanswered API paths, and writes an index.json.
 *
 * Not part of CI. Run from the repo root, with Playwright's Chromium:
 *   OUT=/path/to/dir NODE_PATH=$(npm root -g) node frontend/e2e/themeScreens/run.cjs [screen ...]
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const F = require('./fixtures.cjs');

const PORT = 4179;
const OUT = process.env.OUT || path.join(__dirname, 'out');
const WIDTHS = [375, 768, 1024, 1280, 1440];
const HEIGHT = { 375: 812, 768: 1024, 1024: 768, 1280: 800, 1440: 900 };

const SCREENS = [
  { key: 'producer-overview', url: `/shows/${F.SHOW}/world?tab=overview` },
  { key: 'events-queue', url: `/shows/${F.SHOW}/world?tab=events` },
  { key: 'event-detail', url: `/shows/${F.SHOW}/world?tab=events&event=${F.EV[0]}` },
  { key: 'event-package', url: `/shows/${F.SHOW}/events/${F.EV[0]}` },
  { key: 'scene-sets', url: `/shows/${F.SHOW}/world?tab=scene-sets` },
  { key: 'episode-overview', url: `/episodes/${F.EP[0]}?tab=overview` },
  { key: 'episode-script', url: `/episodes/${F.EP[0]}?tab=scripts` },
  { key: 'episode-assets', url: `/episodes/${F.EP[0]}?tab=assets` },
  { key: 'episode-scenes', url: `/episodes/${F.EP[0]}?tab=scenes` },
  { key: 'episode-money', url: `/episodes/${F.EP[0]}?tab=money` },
  { key: 'episode-phone', url: `/episodes/${F.EP[0]}?tab=phone` },
  { key: 'episode-overlays', url: `/episodes/${F.EP[0]}?tab=overlays` },
  { key: 'episode-checklist', url: `/episodes/${F.EP[0]}?tab=checklist` },
  { key: 'episode-distribution', url: `/episodes/${F.EP[0]}?tab=distribution` },
  { key: 'next-event-suggestions', url: `/episodes/${F.EP[0]}?tab=overview`, after: async (page) => { await page.click('button.ed-btn-whats-next'); await page.waitForTimeout(600); } },
];

// One answer per path; the fat envelope carries the payload under every
// key a page might read.
const list = (rows, key) => ({ success: true, data: rows, [key]: rows, pagination: { total: rows.length } });
const one = (row, key) => ({ success: true, data: row, [key]: row });
function answer(pathname, search) {
  const p = pathname.replace(/^\/api\/v1/, '');
  const q = new URLSearchParams(search);
  if (p === `/shows/${F.SHOW}`) return one(F.show, 'show');
  if (p === '/shows') return list([F.show], 'shows');
  if (/^\/episodes\/[^/]+\/events$/.test(p)) return { success: true, data: F.events.slice(0, 1), events: F.events.slice(0, 1), event: F.events[0] };
  if (/^\/episodes\/[^/]+\/overlays$/.test(p)) return list([], 'overlays');
  if (/^\/episode-brief\/[^/]+\/(production-coverage|performance-clips)$/.test(p)) return { success: true, data: { clips: [], coverage: {} }, clips: [], coverage: {} };
  if (/^\/world\/[^/]+\/season\/roadmap$/.test(p)) return { success: true, data: { slots: [] }, roadmap: [], slots: [] };
  if (p === '/episodes') return list(F.episodes, 'episodes');
  if (/^\/episodes\/[^/]+$/.test(p)) return one(F.episodes.find((e) => p.endsWith(e.id)) || F.episodes[0], 'episode');
  if (/^\/episodes\/[^/]+\/todo$/.test(p)) return one(F.todo, 'todo');
  if (/^\/episodes\/[^/]+\/todo\/social$/.test(p)) return { success: true, data: { tasks: F.todo.social_tasks, assetUrl: null }, tasks: F.todo.social_tasks };
  if (/^\/episodes\/[^/]+\/scene-sets$/.test(p)) return list(F.sceneSets.slice(0, 1), 'scene_sets');
  if (/^\/episodes\/[^/]+\/(scenes|locations|library-scenes|scripts)$/.test(p)) return list([], p.split('/').pop().replace('-', '_'));
  if (/^\/episodes\/[^/]+\/next-event-suggestions/.test(p) || /suggest/.test(p)) return F.suggestions;
  if (/^\/episode-brief\/[^/]+$/.test(p)) return one({ episode_id: F.EP[0], brief: 'A gallery opening where Lala meets the curator.', status: 'ready', event_id: F.EV[0] }, 'brief');
  if (/^\/episode-brief\/[^/]+\/plan$/.test(p)) return one({ acts: [], beats: [], scenes: [] }, 'plan');
  if (p === `/world/${F.SHOW}/events`) return list(F.events, 'events');
  if (/^\/world\/[^/]+\/events\/[^/]+$/.test(p)) return one(F.events.find((e) => p.endsWith(e.id)) || F.events[0], 'event');
  if (/money-preview$/.test(p)) return one({ income: 300, cost: 160, net: 140, affordable: true }, 'preview');
  if (/episode-locations$/.test(p)) return list(F.locations, 'locations');
  if (/^\/world\/[^/]+\/season\/event\//.test(p)) return one({ slot: { label: 'Act 2, slot 3', intention: 'raise the stakes' } }, 'slot');
  if (p === `/world/${F.SHOW}/balance`) return { success: true, data: { coins: 420 }, coins: 420, balance: 420 };
  if (/^\/world\/[^/]+\/episodes\/[^/]+\/money$/.test(p)) return F.money;
  if (/^\/world\/[^/]+\/(history|decisions|goals|financial-ledger)$/.test(p)) return list([], p.split('/').pop().replace('financial-', ''));
  if (p === '/world/locations') return list(F.locations, 'locations');
  if (p === '/world/map') return one({ cities: [], locations: F.locations }, 'map');
  if (/^\/characters\/[^/]+\/state$/.test(p)) return F.lalaState;
  if (p === '/scene-sets') return list(F.sceneSets, 'scene_sets');
  if (p === '/scene-sets/generation-check') return { success: true, data: { ok: true, can_generate: true }, ok: true };
  if (/^\/scene-sets\/[^/]+$/.test(p)) return one(F.sceneSets.find((s) => p.endsWith(s.id)) || F.sceneSets[0], 'scene_set');
  if (/^\/scene-sets\/[^/]+\/\w[\w-]*$/.test(p)) return list([], p.split('/').pop().replace('-', '_'));
  if (/^\/shows\/[^/]+\/financial-summary$/.test(p)) return { success: true, data: { total_income: 300, total_cost: 160 }, by_episode: [{ episode_id: F.EP[0], income: 300, cost: 160, net: 140 }] };
  if (/^\/shows\/[^/]+\/(financial-config|financial-breakdowns|financial-suggestions)$/.test(p)) return one({}, 'config');
  if (/^\/shows\/[^/]+\/wardrobe$/.test(p) || p === '/wardrobe') return list([], 'items');
  if (p === '/wardrobe/slot-coverage') return { success: true, data: { slots: [] }, slots: [] };
  if (p === '/wardrobe-brands/brands') return list([], 'brands');
  if (/^\/opportunities\//.test(p)) return list([], 'opportunities');
  if (/^\/ui-overlays\/[^/]+$/.test(p)) return list([], 'overlays');
  if (/^\/ui-overlays\/[^/]+\/frame$/.test(p)) return one(null, 'frame');
  if (/^\/feed-enhanced\//.test(p)) return list([], 'moments');
  if (p === '/assets') return list([], 'assets');
  if (p === '/feed-posts') return list([], 'posts');
  if (p === '/social-profiles' || /^\/social-profiles\//.test(p)) return list([], 'profiles');
  if (/^\/franchise-brain\/entries/.test(p)) return list([], 'entries');
  return null; // unanswered: recorded, answered with an empty success
}

function serve() {
  return new Promise((resolve, reject) => {
    const vite = path.join(__dirname, '../../node_modules/.bin/vite');
    const child = spawn(vite, ['preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '../..'), stdio: ['ignore', 'pipe', 'pipe'] });
    let up = false;
    const onData = (d) => { if (!up && /localhost:\d+/.test(String(d))) { up = true; resolve(child); } };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.on('exit', (code) => { if (!up) reject(new Error(`vite preview exited ${code}`)); });
    setTimeout(() => { if (!up) reject(new Error('vite preview did not start')); }, 20000);
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const screens = only.length ? SCREENS.filter((s) => only.includes(s.key)) : SCREENS;
  const server = await serve();
  const browser = await chromium.launch();
  const index = [];
  try {
    for (const screen of screens) {
      for (const width of WIDTHS) {
        // The build registers a service worker whose fetches bypass page routes; block it.
        const context = await browser.newContext({ viewport: { width, height: HEIGHT[width] }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
        await context.addInitScript(() => {
          localStorage.setItem('authToken', 'screenshot-pass');
          localStorage.setItem('user', JSON.stringify({ email: 'evoni@example.test', name: 'Evoni', role: 'ADMIN', groups: ['ADMIN'] }));
          sessionStorage.setItem('chunk-reload-attempted', '1');
        });
        const unanswered = new Set();
        const errors = [];
        await context.route('**/api/**', async (route) => {
          const u = new URL(route.request().url());
          const body = answer(u.pathname, u.search);
          if (body === null) unanswered.add(`${route.request().method()} ${u.pathname}`);
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body || { success: true, data: [] }) });
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !/favicon|sw\.js|fonts\.g|ERR_CERT/.test(m.text())) errors.push(m.text().slice(0, 160)); });
        await page.goto(`http://localhost:${PORT}${screen.url}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        if (screen.after) { try { await screen.after(page); } catch (e) { errors.push(`after: ${e.message.split('\n')[0]}`); } }
        // The app scrolls inside its content pane, not the document: grow the
        // viewport to the tallest scroll container so the shot holds the page.
        const needed = await page.evaluate(() => {
          let h = document.documentElement.scrollHeight;
          for (const el of document.querySelectorAll('*')) {
            const oy = getComputedStyle(el).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) h = Math.max(h, el.getBoundingClientRect().top + window.scrollY + el.scrollHeight + 80);
          }
          return Math.ceil(h);
        });
        const height = Math.min(Math.max(HEIGHT[width], needed), 6000);
        if (height !== HEIGHT[width]) { await page.setViewportSize({ width, height }); await page.waitForTimeout(250); }
        const file = path.join(OUT, `${screen.key}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        const entry = { screen: screen.key, width, height, file: path.basename(file), hScroll: hasHScroll, errors: [...new Set(errors)], unanswered: [...unanswered] };
        index.push(entry);
        console.log(`${screen.key.padEnd(24)} ${String(width).padStart(4)} x${String(height).padEnd(5)} ${hasHScroll ? 'H-SCROLL ' : '         '}${entry.errors.length ? `errors ${entry.errors.length} ` : ''}${entry.unanswered.length ? `unanswered ${entry.unanswered.join(', ')}` : ''}`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\n${index.length} shots in ${OUT}`);
})().catch((e) => { console.error(e); process.exit(2); });
