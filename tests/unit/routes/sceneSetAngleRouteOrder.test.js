/**
 * Express matches routes in the order they are registered. PATCH
 * /:id/angles/:angleId was registered before PATCH /:id/angles/reorder, so
 * "reorder" was read as an angle id and every reorder of a set's angles
 * failed ("Failed to reorder angles"). The literal route must come first.
 */
const router = require('../../../src/routes/sceneSetRoutes');

const patchPaths = () => router.stack
  .filter((layer) => layer.route && layer.route.methods.patch)
  .map((layer) => layer.route.path);

describe('scene set angle PATCH routes', () => {
  test('PATCH /:id/angles/reorder is matched before /:id/angles/:angleId', () => {
    const paths = patchPaths();
    const reorder = paths.indexOf('/:id/angles/reorder');
    const byId = paths.indexOf('/:id/angles/:angleId');
    expect(reorder).toBeGreaterThanOrEqual(0);
    expect(byId).toBeGreaterThanOrEqual(0);
    expect(reorder).toBeLessThan(byId);
  });
});
