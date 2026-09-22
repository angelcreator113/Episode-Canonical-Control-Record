// Task #1640 follow-up — Evoni's own question before merge: with category/
// format added to the WorldEvent model, every findAll/findOne/findByPk
// call that doesn't restrict `attributes` now implicitly requests both new
// columns, and would throw "column does not exist" against any database
// the migration hasn't reached yet -- not just call sites that touch
// category/format on purpose. These tests confirm every one of the eleven
// unrestricted call sites found now scopes attributes explicitly.
const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');

const MODEL_SRC = read('src', 'models', 'WorldEvent.js');
const WORLD_EVENTS_SRC = read('src', 'routes', 'worldEvents.js');
const CALENDAR_SRC = read('src', 'routes', 'calendarRoutes.js');
const WARDROBE_EVENT_SRC = read('src', 'routes', 'wardrobeEventRoutes.js');
const CAREER_PIPELINE_SRC = read('src', 'services', 'careerPipelineService.js');
const SCRIPT_WRITER_SRC = read('src', 'services', 'episodeScriptWriterService.js');
const FEED_POST_SRC = read('src', 'services', 'feedPostGeneratorService.js');

describe('Task #1640 follow-up — WorldEvent.CURRENT_ATTRIBUTES excludes the new columns', () => {
  test('CURRENT_ATTRIBUTES is defined and excludes category/format', () => {
    const match = MODEL_SRC.match(/WorldEvent\.CURRENT_ATTRIBUTES = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const list = match[1];
    expect(list).not.toMatch(/'category'/);
    expect(list).not.toMatch(/'format'/);
    // Sanity: it should still be a substantial list, not an accidental stub.
    const count = (list.match(/'/g) || []).length / 2;
    expect(count).toBeGreaterThanOrEqual(40);
  });
});

describe('Task #1640 follow-up — every previously-unrestricted WorldEvent query now scopes attributes', () => {
  test('worldEvents.js — main list query (with includes) scopes attributes', () => {
    expect(WORLD_EVENTS_SRC).toMatch(/models\.WorldEvent\.findAll\(\{ where, include, order: \[\[sortCol, sortOrder\]\], attributes: models\.WorldEvent\.CURRENT_ATTRIBUTES \}\)/);
  });

  test('worldEvents.js — main list query (includes-failed fallback) scopes attributes', () => {
    expect(WORLD_EVENTS_SRC).toMatch(/models\.WorldEvent\.findAll\(\{ where, order: \[\[sortCol, sortOrder\]\], attributes: models\.WorldEvent\.CURRENT_ATTRIBUTES \}\)/);
  });

  test('worldEvents.js — both raw-SQL-fallback findByPk calls scope attributes', () => {
    const matches = WORLD_EVENTS_SRC.match(/models\.WorldEvent\.findByPk\(eventId, \{ attributes: models\.WorldEvent\.CURRENT_ATTRIBUTES \}\)/g) || [];
    expect(matches.length).toBe(2);
  });

  test('worldEvents.js — the next-episode candidate scorer scopes attributes to what it reads', () => {
    const block = WORLD_EVENTS_SRC.match(/const candidates = await WorldEvent\.findAll\(\{[\s\S]*?\}\);/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/attributes:\s*\[/);
    expect(block[0]).not.toMatch(/'category'|'format'/);
  });

  test('calendarRoutes.js — /events/:id/spawned scopes attributes', () => {
    const block = CALENDAR_SRC.match(/models\.WorldEvent\.findAll\(\{[\s\S]*?source_calendar_event_id[\s\S]*?\}\);/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/attributes:\s*\[/);
  });

  test('wardrobeEventRoutes.js — both findByPk calls scope attributes', () => {
    const matches = WARDROBE_EVENT_SRC.match(/findByPk\(event_id, \{\s*attributes:\s*\[/g) || [];
    expect(matches.length).toBe(2);
  });

  test('careerPipelineService.js — the completion-cascade lookup scopes attributes to [\'id\']', () => {
    expect(CAREER_PIPELINE_SRC).toMatch(/WorldEvent\.findOne\(\{ where: \{ used_in_episode_id: episodeId \}, attributes: \['id'\] \}\)/);
  });

  test('episodeScriptWriterService.js — the wardrobe-context lookup scopes attributes', () => {
    const block = SCRIPT_WRITER_SRC.match(/context\.event = await WorldEvent\.findOne\(\{[\s\S]*?\}\)\.then/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/attributes:\s*WorldEvent\.CURRENT_ATTRIBUTES/);
  });

  test('feedPostGeneratorService.js — the feed-post context lookup scopes attributes', () => {
    const block = FEED_POST_SRC.match(/event = await WorldEvent\.findOne\(\{[\s\S]*?\}\);/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/attributes:\s*\[/);
  });
});
