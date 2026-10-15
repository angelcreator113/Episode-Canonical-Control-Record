// ============================================================================
// UNIT TEST — the writing tools' AI routes carry aiRateLimiter
// ============================================================================
// Each of these routes calls Claude. They had requireAuth but no
// aiRateLimiter, so a loop or a stuck button could spend without a cap.

const fs = require('fs');
const path = require('path');

const ROUTES = {
  'memories/planning.js': ['/prose-critique', '/chapter-synopsis', '/scene-transition'],
  'memories/stories.js': ['/character-dilemma', '/attribute-voices', '/ai-writer-action'],
  'memories/engine.js': ['/pipeline-generate', '/pipeline-generate-background', '/batch-generate', '/batch-generate-background'],
  'storyteller.js': ['/chapters/:id/emotional-impact'],
  'worldEvents.js': ['/world/:showId/episodes/:episodeId/generate-story'],
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

describe.each(Object.entries(ROUTES))('%s', (file, routes) => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', file), 'utf8');
  test.each(routes)('POST %s → requireAuth + aiRateLimiter', (route) => {
    expect(src).toMatch(new RegExp(`router\\.post\\('${escape(route)}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`));
  });
});
