// ============================================================================
// Task #2154 (§8(v)) — the creation draft on the calendar auto-spawn path.
// spawnEventsFromCalendar calls draftEventConcept once per event, with the
// host profile, the venue name, the user id and the calendar event as
// context. Per field (docs/EVENT_CREATE_PATHS_READ.md, the calendar row):
//   (a) a value the calendar event supplies (activities.dress_code) is kept;
//   (b) a template value (name, description) is replaced by the draft's;
//   (c) an empty field (event_time, category, format, dress_code_keywords,
//       dress_code when the calendar gives none) is filled by the draft.
// A null draft leaves the event exactly as before. Mocked models and a
// mocked draft service; no database, no network.
// ============================================================================

const mockDraft = jest.fn();
jest.mock('../../../src/services/eventConceptDraftService', () => ({
  draftEventConcept: (...a) => mockDraft(...a),
}));
jest.mock('../../../src/services/episodeGeneratorService', () => ({ buildSocialTasks: () => [] }));

const { spawnEventsFromCalendar } = require('../../../src/services/eventAutomationService');

const HOST = {
  id: 7, handle: 'hosty', display_name: 'Hosty', content_category: 'fashion', archetype: 'soft_life',
  registry_character_id: null, brand_partnerships: [],
};

// The draft as draftEventConcept returns it (parsed and validated).
const DRAFT = {
  concept: 'A candlelit winter gala for the season\'s tastemakers.',
  activity: 'Guests walk a short runway, then dine and toast the season.',
  description: 'The Holiday Gala closes the year in style: a runway walk, dinner and a midnight toast.',
  category: 'luxury_prestige',
  format: 'gala',
  event_time: '20:00',
  styling: {
    dress_code: 'winter black tie',
    dress_code_keywords: ['elegant', 'glamorous', 'sparkling'],
    styling_brief: {
      activity: 'Walking a short runway, then seated dinner.',
      formality: 'black-tie',
      function_requirements: ['walkable hem'],
      avoid: ['sneakers'],
      style_direction: 'Deep jewel tones with metallic accents.',
    },
  },
  name: 'The Midnight Velvet Gala',
};

const DRAFT_KEYS = ['concept', 'activity', 'styling_brief', 'auto_drafted', 'drafted_values'];

// A calendar event. what_only_we_know is private and must never reach the draft.
const cal = (extra = {}) => ({
  id: 'cal-1', title: 'Holiday Gala', cultural_category: 'luxury_prestige', severity_level: 5,
  what_world_knows: 'The season\'s biggest night.', what_only_we_know: 'SECRET: the host is leaving.',
  ...extra,
});

// Models: one host, one existing venue, no guests. Only WorldEvent.create writes.
function models() {
  const create = jest.fn(async (d) => ({ toJSON: () => d }));
  return {
    create,
    m: {
      SocialProfile: { findAll: jest.fn(async () => [HOST]) },
      // findVenue's category match (findOne) returns this venue.
      WorldLocation: { findOne: jest.fn(async () => ({ id: 'loc-1', name: 'Club Noir', street_address: '1 Main St', district: null, city: 'Velour City' })) },
      WorldEvent: { create },
    },
  };
}

let randomSpy;
beforeEach(() => {
  mockDraft.mockReset();
  // Deterministic template name, prestige and host pick.
  randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the draft call', () => {
  test('one call per event, with the host, venue name, user id and the calendar context (never the private field)', async () => {
    mockDraft.mockResolvedValue(null);
    const { m } = models();
    await spawnEventsFromCalendar(cal(), 'show-1', m, { userId: 'u1' });

    expect(mockDraft).toHaveBeenCalledTimes(1);
    const [profile, ctx] = mockDraft.mock.calls[0];
    expect(profile).toMatchObject({ id: 7, display_name: 'Hosty' });
    expect(ctx).toEqual({
      venueName: 'Club Noir',
      userId: 'u1',
      context: { title: 'Holiday Gala', theme: 'luxury_prestige', description: 'The season\'s biggest night.' },
      // The models and show, so the draft reads the show's Bible rules (2026-10-06).
      models: m,
      showId: 'show-1',
    });
    expect(JSON.stringify(ctx)).not.toContain('SECRET');
  });

  test('events are drafted one after another, and one null draft does not affect the others', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const replies = [null, DRAFT, DRAFT];
    mockDraft.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return replies.shift();
    });
    const { m, create } = models();
    await spawnEventsFromCalendar(cal(), 'show-1', m, { eventCount: 3 });

    expect(mockDraft).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
    const [first, second, third] = create.mock.calls.map(([d]) => d);
    expect(first.description).toBe('Holiday Gala — The season\'s biggest night.');
    expect(first.canon_consequences.automation).not.toHaveProperty('auto_drafted');
    for (const d of [second, third]) {
      expect(d.description).toBe(DRAFT.description);
      expect(d.canon_consequences.automation.auto_drafted.description).toBe('ai_draft');
    }
  });
});

describe('a null draft leaves the event exactly as before', () => {
  test('template name and description, no time, category, format or keywords, no draft keys', async () => {
    mockDraft.mockResolvedValue(null);
    const { m, create } = models();
    await spawnEventsFromCalendar(cal(), 'show-1', m);
    const d = create.mock.calls[0][0];

    // Math.random 0: the first luxury_prestige template, else default's first.
    expect(d.name).not.toBe(DRAFT.name);
    expect(d.description).toBe('Holiday Gala — The season\'s biggest night.');
    expect(d.event_time).toBeNull();
    expect(d.dress_code).toBeNull();
    for (const key of ['category', 'format', 'dress_code_keywords']) expect(d).not.toHaveProperty(key);
    for (const key of DRAFT_KEYS) expect(d.canon_consequences.automation).not.toHaveProperty(key);
    expect(d.canon_consequences.automation.dress_code).toBeNull();
  });

  test('with no what_world_knows the template description still falls back to the template name', async () => {
    mockDraft.mockResolvedValue(null);
    const { m, create } = models();
    await spawnEventsFromCalendar(cal({ what_world_knows: null }), 'show-1', m);
    const d = create.mock.calls[0][0];
    expect(d.description).toBe(`Holiday Gala — ${d.name}`);
  });
});

describe('with a draft', () => {
  test('(b) template name and description are replaced, marked ai_draft, with drafted_values', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const { m, create } = models();
    await spawnEventsFromCalendar(cal(), 'show-1', m);
    const d = create.mock.calls[0][0];
    const auto = d.canon_consequences.automation;

    expect(d.name).toBe(DRAFT.name);
    expect(d.description).toBe(DRAFT.description);
    expect(auto).toMatchObject({ concept: DRAFT.concept, activity: DRAFT.activity });
    expect(auto.auto_drafted).toMatchObject({ name: 'ai_draft', description: 'ai_draft', concept: 'ai_draft', activity: 'ai_draft' });
    expect(auto.drafted_values).toMatchObject({ name: DRAFT.name, description: DRAFT.description });
  });

  test('(c) empty fields are filled: time, category, format, and styling when the calendar gives no dress code', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const { m, create } = models();
    await spawnEventsFromCalendar(cal(), 'show-1', m);
    const d = create.mock.calls[0][0];
    const auto = d.canon_consequences.automation;

    expect(d).toMatchObject({
      event_time: '20:00', category: 'luxury_prestige', format: 'gala',
      dress_code: 'winter black tie', dress_code_keywords: ['elegant', 'glamorous', 'sparkling'],
    });
    expect(auto.styling_brief).toEqual(DRAFT.styling.styling_brief);
    expect(auto.auto_drafted).toMatchObject({
      event_time: 'ai_draft', category: 'ai_draft', format: 'ai_draft',
      dress_code: 'ai_draft', dress_code_keywords: 'ai_draft', styling_brief: 'ai_draft',
    });
    expect(auto.drafted_values).toMatchObject({
      event_time: '20:00', category: 'luxury_prestige', format: 'gala',
      dress_code: 'winter black tie', dress_code_keywords: ['elegant', 'glamorous', 'sparkling'],
    });
  });

  test('(a) a calendar-supplied dress code is kept, and none of the drafted styling is used', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const { m, create } = models();
    await spawnEventsFromCalendar(cal({ activities: { dress_code: 'black tie' } }), 'show-1', m);
    const d = create.mock.calls[0][0];
    const auto = d.canon_consequences.automation;

    expect(d.dress_code).toBe('black tie');
    expect(auto.dress_code).toBe('black tie');
    expect(d).not.toHaveProperty('dress_code_keywords');
    expect(auto).not.toHaveProperty('styling_brief');
    for (const key of ['dress_code', 'dress_code_keywords', 'styling_brief']) {
      expect(auto.auto_drafted).not.toHaveProperty(key);
      expect(auto.drafted_values).not.toHaveProperty(key);
    }
    // The rest of the draft is still used.
    expect(d.description).toBe(DRAFT.description);
    expect(d.format).toBe('gala');
  });

  test('a field the draft dropped stays as before (partial draft)', async () => {
    const { name: _n, event_time: _t, styling: _s, ...partial } = DRAFT;
    mockDraft.mockResolvedValue(partial);
    const { m, create } = models();
    await spawnEventsFromCalendar(cal(), 'show-1', m);
    const d = create.mock.calls[0][0];
    const auto = d.canon_consequences.automation;

    expect(d.name).not.toBe(DRAFT.name);
    expect(d.event_time).toBeNull();
    expect(d.dress_code).toBeNull();
    expect(auto.auto_drafted).not.toHaveProperty('name');
    expect(auto.auto_drafted).not.toHaveProperty('event_time');
    expect(auto.drafted_values).not.toHaveProperty('name');
  });
});

describe('the auto-spawn route passes the user id (source check)', () => {
  test('POST /events/:id/auto-spawn passes req.user?.id as userId to spawnEventsFromCalendar', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'calendarRoutes.js'), 'utf8');
    expect(src).toMatch(
      /spawnEventsFromCalendar\(\s*calendarEvent, show_id, models,[\s\S]{0,120}\{ eventCount: requestedCount, maxGuests: maxGuestsInt, userId: req\.user\?\.id \|\| null \}/,
    );
  });
});
