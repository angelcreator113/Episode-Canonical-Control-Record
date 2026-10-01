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

const CATEGORIES = ['fashion', 'social', 'brunch_dining', 'beauty_wellness', 'creator_brand', 'arts_entertainment', 'luxury_prestige', 'community_local', 'travel_destination', 'personal_relationship', 'fitness'];
const FORMATS = ['cocktail_party', 'garden_soiree', 'gallery_opening', 'gala', 'brunch', 'concert', 'brand_launch', 'premiere', 'workout_class', 'masterclass', 'workshop', 'dinner', 'showcase', 'preview', 'pop_up', 'retreat', 'meetup', 'run_club', 'performance', 'photoshoot', 'tasting', 'panel', 'competition'];

// Task #2126: the lists live in exported constants (CATEGORY_VALUES,
// FORMAT_VALUES) that the isIn validators use, so these read the model as
// Sequelize builds it (in memory, no database) instead of its source text.
const { Sequelize } = require('sequelize');
const defineWorldEvent = require('../../../src/models/WorldEvent');
const WORLD_EVENT = defineWorldEvent(new Sequelize('postgres://unused:unused@localhost:1/unused', { logging: false }));
const isInOf = (field) => WORLD_EVENT.rawAttributes[field].validate.isIn[0];

describe('Task #1640 — WorldEvent model validates the settled taxonomy', () => {
  test('category field exists with isIn validation against the exact eleven values', () => {
    expect([...isInOf('category')].sort()).toEqual([...CATEGORIES].sort());
    expect([...defineWorldEvent.CATEGORY_VALUES]).toEqual(isInOf('category'));
  });

  test('format field exists with isIn validation against the exact twenty-three values', () => {
    expect([...isInOf('format')].sort()).toEqual([...FORMATS].sort());
    expect([...defineWorldEvent.FORMAT_VALUES]).toEqual(isInOf('format'));
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
    // Since the event cost split (2026-09-30) the forecast estimates the
    // extras with the same eventExtrasFor Start Episode drafts from, and
    // selects format for it.
    expect(ROUTE_SRC).toMatch(/eventExtrasFor\(event\)/);
    expect(ROUTE_SRC).toMatch(/dress_code, format, rewards/);
    const { wantsPhotoBooth } = require('../../../src/utils/financialRates');
    for (const format of ['gala', 'premiere', 'brand_launch']) {
      expect(wantsPhotoBooth({ format, event_type: 'invite' })).toBe(true);
    }
    expect(wantsPhotoBooth({ format: 'dinner', event_type: 'invite' })).toBe(false);
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
