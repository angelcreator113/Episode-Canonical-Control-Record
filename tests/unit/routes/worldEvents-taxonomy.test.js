// Task #1640 — category/format added to world_events. These are guard
// tests against the exact failure shape this whole taxonomy effort exists
// to prevent: a frontend field that's sent but silently dropped because a
// backend route's allowlist was never updated (the #1638 logged_by bug,
// and the risk this task's own issue explicitly called out for the PUT
// route's allowedFields and the POST route's destructured fields).
const fs = require('fs');
const path = require('path');

const MODEL_SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'models', 'WorldEvent.js'), 'utf8');
const ROUTE_SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'worldEvents.js'), 'utf8');
const QEC_SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'components', 'QuickEpisodeCreator.jsx'), 'utf8');

const CATEGORIES = ['fashion', 'social', 'brunch_dining', 'beauty_wellness', 'creator_brand', 'arts_entertainment', 'luxury_prestige', 'community_local', 'travel_destination', 'personal_relationship'];
const FORMATS = ['cocktail_party', 'garden_soiree', 'gallery_opening', 'gala', 'brunch', 'concert', 'brand_launch', 'premiere'];

describe('Task #1640 — WorldEvent model validates the settled taxonomy', () => {
  test('category field exists with isIn validation against the exact ten values', () => {
    const match = MODEL_SRC.match(/category:\s*\{[\s\S]*?isIn:\s*\[\[([\s\S]*?)\]\]/);
    expect(match).not.toBeNull();
    const listed = match[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(listed.sort()).toEqual([...CATEGORIES].sort());
  });

  test('format field exists with isIn validation against the exact eight values', () => {
    const match = MODEL_SRC.match(/format:\s*\{[\s\S]*?isIn:\s*\[\[([\s\S]*?)\]\]/);
    expect(match).not.toBeNull();
    const listed = match[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(listed.sort()).toEqual([...FORMATS].sort());
  });

  test('red_carpet is not a format value anywhere in the model', () => {
    expect(MODEL_SRC).not.toMatch(/red_carpet/);
  });
});

describe('Task #1640 — worldEvents.js routes accept category/format, not just define them', () => {
  test('POST /:showId/events destructures category and format from the body', () => {
    expect(ROUTE_SRC).toMatch(/category\s*=\s*null,\s*format\s*=\s*null/);
  });

  test('POST /:showId/events passes category/format into WorldEvent.create', () => {
    const createBlock = ROUTE_SRC.match(/models\.WorldEvent\.create\(\{[\s\S]*?\}\);/);
    expect(createBlock).not.toBeNull();
    expect(createBlock[0]).toMatch(/category,\s*format/);
  });

  test('PUT /:showId/events/:eventId allowedFields includes category and format', () => {
    const allowedBlock = ROUTE_SRC.match(/const allowedFields = \[[\s\S]*?\];/);
    expect(allowedBlock).not.toBeNull();
    expect(allowedBlock[0]).toMatch(/'category'/);
    expect(allowedBlock[0]).toMatch(/'format'/);
  });

  test('the photo-booth check reads event.format for format-shaped values, not event.event_type', () => {
    const checkBlock = ROUTE_SRC.match(/const wantsPhotoBooth = [\s\S]*?;/);
    expect(checkBlock).not.toBeNull();
    expect(checkBlock[0]).toMatch(/\['gala', 'premiere', 'brand_launch'\]\.includes\(event\.format\)/);
    expect(checkBlock[0]).not.toMatch(/includes\(event\.event_type\)/);
  });
});

describe('Task #1640 — QuickEpisodeCreator no longer conflates format with event_type', () => {
  test('no eventType/setEventType state remains', () => {
    expect(QEC_SRC).not.toMatch(/\beventType\b/);
  });

  test('all seven real presets use a format value from the approved list, not event_type', () => {
    const presetMatches = [...QEC_SRC.matchAll(/format:\s*'([^']*)'/g)].map((m) => m[1]).filter(Boolean);
    expect(presetMatches.length).toBeGreaterThanOrEqual(7);
    presetMatches.forEach((value) => expect(FORMATS).toContain(value));
  });

  test('the two create-event call sites hardcode event_type: \'invite\'', () => {
    const matches = QEC_SRC.match(/event_type:\s*'invite'/g) || [];
    expect(matches.length).toBe(2);
  });

  test('the update-existing-event call site does not send event_type at all', () => {
    const putBlock = QEC_SRC.match(/api\.put\(`\/api\/v1\/world\/\$\{effectiveShowId\}\/events\/\$\{existingEvent\.id\}`,\s*\{[\s\S]*?\}\);/);
    expect(putBlock).not.toBeNull();
    expect(putBlock[0]).not.toMatch(/event_type:/);
    expect(putBlock[0]).toMatch(/format:\s*format/);
  });
});
