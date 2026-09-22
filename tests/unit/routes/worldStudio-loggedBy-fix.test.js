// Task #1638 — POST /world/state/timeline's World → Calendar sync wrote
// logged_by: 'world_state' into StoryCalendarEvent, whose model only allows
// 'evoni' | 'amber' | 'system' (src/models/StoryCalendarEvent.js). The insert
// failed on every call, and the surrounding try/catch swallowed the error
// with no log — a silent, guaranteed data-loss path for the calendar mirror.
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'worldStudio.js'), 'utf8');

describe('Task #1638 — worldStudio.js calendar-sync logged_by fix', () => {
  test('the invalid logged_by value is gone', () => {
    expect(SRC).not.toMatch(/logged_by:\s*'world_state'/);
  });

  test('the calendar-sync StoryCalendarEvent.create call uses a valid enum value', () => {
    const match = SRC.match(/await SCE\.create\(\{[^}]*logged_by:\s*'([^']+)'/);
    expect(match).not.toBeNull();
    expect(['evoni', 'amber', 'system']).toContain(match[1]);
  });

  test('the calendar-sync catch block no longer swallows the error silently', () => {
    const match = SRC.match(/await SCE\.create\([\s\S]*?\n\s*\}\s*\n\s*\} catch \(([^)]*)\) \{([^}]*)\}/);
    expect(match).not.toBeNull();
    const [, catchParam, catchBody] = match;
    expect(catchParam.trim()).not.toBe('_');
    expect(catchBody).toMatch(/console\.(warn|error)/);
  });
});
