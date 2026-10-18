// CP12 — therapy.js. The Therapy Room is retired (Evoni, 2026-10-18: "we can
// retire/delete the therapy room"): its session-close wrote into characters
// with no approval step. The Talk tab (services/characterTalk) replaces it.
// The route file, its mount and its page stay gone; the past therapy
// profiles (CharacterTherapyProfile) are still read.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const exists = (...p) => fs.existsSync(path.join(ROOT, ...p));
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('CP12 — the Therapy Room is retired', () => {
  test('no therapy route file, mount or page', () => {
    expect(exists('src', 'routes', 'therapy.js')).toBe(false);
    expect(read('src', 'app.js')).not.toMatch(/require\('\.\/routes\/therapy'\)/);
    expect(exists('frontend', 'src', 'pages', 'CharacterTherapy.jsx')).toBe(false);
    expect(read('frontend', 'src', 'App.jsx')).not.toMatch(/\/therapy\/:registryId/);
  });
  test('the session-close write into characters is gone; the past profiles stay readable', () => {
    expect(read('src', 'services', 'registrySync.js')).not.toMatch(/onTherapySessionClose/);
    expect(read('src', 'models', 'index.js')).toMatch(/CharacterTherapyProfile/);
  });
});
