/**
 * Which feature a logged AI call came from (Evoni, 2026-10-20: writing-tool
 * costs were landing in "Other"). A route in a sub-folder keeps its folder:
 * the AI writing hub lives in routes/memories/.
 */
const { routeNameFromStack } = require('../../../src/services/aiCostTracker');

const frame = (path) => `    at handler (/srv/app/src/${path}:12:5)`;
const stack = (...paths) => ['Error', ...paths.map(frame)].join('\n');

describe('routeNameFromStack', () => {
  test('a route in routes/ is named by its file', () => {
    expect(routeNameFromStack(stack('services/aiCostTracker.js', 'routes/castRoutes.js'))).toBe('castRoutes');
  });

  test('a route in a sub-folder keeps its folder', () => {
    expect(routeNameFromStack(stack('services/aiCostTracker.js', 'routes/memories/engine.js'))).toBe('memories/engine');
  });

  test('a route wins over a service; a service is named with svc:', () => {
    expect(routeNameFromStack(stack('services/cameraRoll.js', 'routes/cameraRollRoutes.js'))).toBe('cameraRollRoutes');
    expect(routeNameFromStack(stack('services/aiCostTracker.js', 'services/cameraRoll.js'))).toBe('svc:cameraRoll');
  });

  test('a worker is named with worker:; nothing known is unknown', () => {
    expect(routeNameFromStack(stack('workers/episodeWorker.js'))).toBe('worker:episodeWorker');
    expect(routeNameFromStack('Error\n    at node:internal/process')).toBe('unknown');
  });
});
