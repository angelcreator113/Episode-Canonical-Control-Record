// The Consciousness Layer routes were retired 2026-10-18 (Evoni: "retire the
// two you suggested"): no page called them, and /save wrote straight into a
// character's writer_notes. This keeps them gone.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');

describe('the Consciousness Layer routes stay retired', () => {
  test('the route file and its mount are gone', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'routes', 'consciousness.js'))).toBe(false);
    const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
    expect(app).not.toMatch(/require\(['"]\.\/routes\/consciousness['"]\)/);
    expect(app).not.toMatch(/app\.use\(['"]\/api\/v1\/consciousness['"]/);
  });
});
