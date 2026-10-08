/**
 * Every route onboarding hands out (GET /status's next_action, POST
 * /session-state's primary_action) opens a page: App.jsx renders it, or
 * redirects it to a route it renders. /character-generator has had no route
 * since #1544, so "Set up your protagonist" and "Generate your core cast"
 * landed on the home page (App.jsx's catch-all).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// App.jsx's literal routes: path -> the path it redirects to, or null for a page.
function appRoutes() {
  const routes = new Map();
  const re = /<Route\s+path="([^"]+)"\s+element=\{(<[^}]*)\}/g;
  for (const [, routePath, element] of read('frontend/src/App.jsx').matchAll(re)) {
    const redirect = element.match(/^<Navigate\s+to="([^"?]+)/);
    if (!routes.has(routePath) || routes.get(routePath) !== null) routes.set(routePath, redirect ? redirect[1] : null);
  }
  return routes;
}

// A route opens a page if App.jsx renders it, or redirects it (within a few hops) to one it renders.
function opensPage(routes, route) {
  let current = route;
  for (let hop = 0; hop < 4; hop++) {
    if (!routes.has(current)) return false;
    const next = routes.get(current);
    if (next === null) return true;
    current = next;
  }
  return false;
}

describe('onboarding routes', () => {
  const routes = appRoutes();
  const handedOut = [...new Set([...read('src/routes/onboarding.js').matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]))];

  it('reads App.jsx and onboarding as expected', () => {
    expect(routes.get('/character-registry')).toBeNull();
    expect(routes.get('/storyteller')).toBe('/stories');
    expect(handedOut).toEqual(expect.arrayContaining(['/setup', '/character-registry', '/storyteller', '/story-engine', '/']));
  });

  it('every route onboarding hands out opens a page', () => {
    expect(handedOut.filter((route) => !opensPage(routes, route))).toEqual([]);
  });

  it('the protagonist and core cast steps open the Character Registry, the cast list', () => {
    const lines = read('src/routes/onboarding.js').split('\n').filter((l) => /Set up your protagonist|Generate your core cast/.test(l));
    expect(lines).toHaveLength(4);
    for (const line of lines) expect(line).toContain("route: '/character-registry'");
  });
});
