// ============================================================================
// Task #2156 (§8(v)) — the creation draft on "Schedule as Event"
// (scheduleOpportunityAsEvent). After the existing venue call, the
// connector's profile is loaded (one findByPk) and draftEventConcept is
// called with it, the venue line as venue, the user id, an explicit creator
// role and the opportunity's public title, type and brand as context.
//   (a) the opportunity's own values are kept (name, dress code);
//   (b) the description (the opportunity's story stakes or the type's
//       template today) is replaced;
//   (c) empty fields (time, category, format; styling when the opportunity
//       gives no dress code) are filled.
// No profile, or a null draft, leaves the path exactly as before.
// Mocked models and a mocked draft service; no database, no network.
// ============================================================================

const mockDraft = jest.fn();
jest.mock('../../../src/services/eventConceptDraftService', () => ({
  draftEventConcept: (...a) => mockDraft(...a),
}));
jest.mock('../../../src/services/eventAutomationService', () => ({
  assembleGuestList: jest.fn(async () => []),
}));

const { scheduleOpportunityAsEvent } = require('../../../src/services/feedEventPipelineService');

const PROFILE = { id: 42, handle: 'mayamoves', display_name: 'Maya Moves', content_category: 'fitness', archetype: 'soft_life' };

// Private or story-only opportunity fields, each with a value the tests can
// look for in the draft call.
const PRIVATE = {
  narrative_stakes: 'PRIV-stakes Lala could lose everything.',
  what_lala_wants: 'PRIV-wants to be taken seriously.',
  what_could_go_wrong: 'PRIV-wrong she freezes.',
  emotional_arc: 'PRIV-arc anxiety to confidence',
  connection_story: 'PRIV-story met at an afterparty',
  career_impact: 'PRIV-impact opens Paris',
  career_milestone: 'PRIV-milestone first cover',
  reputation_risk: 'PRIV-risk controversial brand',
  exclusivity: 'PRIV-excl no competing brands',
  contact_name: 'PRIV-contact creative director',
};

const opportunity = (extra = {}) => ({
  id: 'opp-1', show_id: 'show-1', name: "Maya Moves's casting call", event_id: null,
  opportunity_type: 'casting_call', category: 'fashion', prestige: 5,
  brand_or_company: 'Velour', connector_handle: 'mayamoves', connector_profile_id: 42,
  wardrobe_brief: null, payment_amount: 0, deliverables: [],
  ...PRIVATE,
  ...extra,
});

const DRAFT = {
  concept: 'An open casting for a new streetwear line.',
  activity: 'Models walk for the casting director, then shoot quick polaroids.',
  description: 'Velour opens its doors for a fast, friendly casting: walk, shoot, and meet the team.',
  category: 'fashion',
  format: 'showcase',
  event_time: '10:00',
  styling: {
    dress_code: 'model-off-duty',
    dress_code_keywords: ['minimal', 'clean', 'modern'],
    styling_brief: {
      activity: 'Walking and posing for polaroids.', formality: 'casual',
      function_requirements: ['easy to walk in'], avoid: ['logos'], style_direction: 'Plain basics.',
    },
  },
  name: 'The Velour Open Call',
};

function makeModels({ opp = opportunity(), profile = PROFILE } = {}) {
  const inserts = [];
  const findByPk = jest.fn(async () => (profile ? { toJSON: () => profile } : null));
  return {
    inserts,
    findByPk,
    models: {
      sequelize: {
        query: jest.fn(async (sql, opts) => {
          if (/FROM opportunities WHERE id/.test(sql)) return [[opp]];
          if (/FROM world_events WHERE show_id/.test(sql)) return [[]];
          if (/INSERT INTO world_events/.test(sql)) { inserts.push({ sql, replacements: opts.replacements }); return [[]]; }
          if (/UPDATE opportunities SET event_id/.test(sql)) return [[]];
          throw new Error(`Unexpected query in test: ${sql}`);
        }),
      },
      SocialProfile: { findByPk },
    },
  };
}

const run = async (opts = {}, callOpts = { userId: 'u1' }) => {
  const m = makeModels(opts);
  await scheduleOpportunityAsEvent('opp-1', 'show-1', m.models, callOpts);
  const { sql, replacements } = m.inserts[0];
  return { ...m, sql, r: replacements, auto: JSON.parse(replacements.canon_consequences).automation };
};

const originalKey = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  mockDraft.mockReset();
  delete process.env.ANTHROPIC_API_KEY; // the venue line comes from the pool, no model call
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
});

describe('no profile or a null draft: exactly as before', () => {
  const DRAFT_KEYS = ['concept', 'activity', 'styling_brief', 'auto_drafted', 'drafted_values'];
  const expectUnchanged = ({ sql, r, auto }) => {
    expect(r.description).toBe(PRIVATE.narrative_stakes);
    expect(r.name).toBe("Maya Moves's casting call");
    expect(r.dress_code).toBeNull();
    for (const key of ['category', 'format', 'event_time', 'dress_code_keywords']) {
      expect(r).not.toHaveProperty(key);
      expect(sql).not.toMatch(new RegExp(`\\b${key}\\b`));
    }
    for (const key of DRAFT_KEYS) expect(auto).not.toHaveProperty(key);
  };

  test('no connector: no profile lookup and no draft call', async () => {
    const out = await run({ opp: opportunity({ connector_profile_id: null }) });
    expect(out.findByPk).not.toHaveBeenCalled();
    expect(mockDraft).not.toHaveBeenCalled();
    expectUnchanged(out);
  });

  test('profile not found: no draft call', async () => {
    const out = await run({ profile: null });
    expect(out.findByPk).toHaveBeenCalledTimes(1);
    expect(mockDraft).not.toHaveBeenCalled();
    expectUnchanged(out);
  });

  test('null draft: the same statement and values as with no profile', async () => {
    mockDraft.mockResolvedValue(null);
    const drafted = await run();
    const noProfile = await run({ profile: null });
    expect(mockDraft).toHaveBeenCalledTimes(1);
    expectUnchanged(drafted);
    expect(drafted.sql).toBe(noProfile.sql);
    const strip = ({ id: _i, canon_consequences: _c, ...rest }) => rest;
    expect(strip(drafted.r)).toEqual(strip(noProfile.r));
  });
});

describe('the draft call', () => {
  test('one profile query by primary key, with the fields the draft reads', async () => {
    mockDraft.mockResolvedValue(null);
    const { findByPk } = await run();
    expect(findByPk).toHaveBeenCalledTimes(1);
    expect(findByPk).toHaveBeenCalledWith(42, { attributes: ['id', 'handle', 'display_name', 'content_category', 'archetype'] });
  });

  test('profile, venue line, user id and the public opportunity context', async () => {
    mockDraft.mockResolvedValue(null);
    await run();
    const [profile, ctx] = mockDraft.mock.calls[0];
    expect(profile).toEqual(PROFILE);
    expect(ctx).toEqual({
      venueName: expect.any(String),
      userId: 'u1',
      creatorRole: 'started_from',
      context: { kind: 'opportunity', title: "Maya Moves's casting call", type: 'casting_call', brand: 'Velour' },
    });
    expect(ctx.venueName.length).toBeGreaterThan(0);
    expect(ctx.venueName.length).toBeLessThanOrEqual(200);
  });

  test('private and story-only opportunity fields never reach the draft', async () => {
    mockDraft.mockResolvedValue(null);
    await run();
    const sent = JSON.stringify(mockDraft.mock.calls[0]);
    for (const value of Object.values(PRIVATE)) expect(sent).not.toContain(value);
    expect(sent).not.toContain('PRIV-');
  });

  test('host role: a brand organizes (started_from); with no brand the creator is the host', async () => {
    mockDraft.mockResolvedValue(null);
    await run();
    expect(mockDraft.mock.calls[0][1].creatorRole).toBe('started_from');
    mockDraft.mockClear();
    await run({ opp: opportunity({ brand_or_company: null }) });
    expect(mockDraft.mock.calls[0][1].creatorRole).toBe('host');
    expect(mockDraft.mock.calls[0][1].context.brand).toBeNull();
  });
});

describe('with a draft', () => {
  test('(a) the opportunity name is kept; the drafted name is not used', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const { r, auto } = await run();
    expect(r.name).toBe("Maya Moves's casting call");
    expect(auto.auto_drafted).not.toHaveProperty('name');
    expect(auto.drafted_values).not.toHaveProperty('name');
  });

  test('(b) the description is replaced, marked ai_draft, with drafted_values', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const { r, auto } = await run();
    expect(r.description).toBe(DRAFT.description);
    expect(auto).toMatchObject({ concept: DRAFT.concept, activity: DRAFT.activity });
    expect(auto.auto_drafted).toMatchObject({ description: 'ai_draft', concept: 'ai_draft', activity: 'ai_draft' });
    expect(auto.drafted_values.description).toBe(DRAFT.description);
    // The story stakes still go to narrative_stakes, not the description.
    expect(r.narrative_stakes).toBe(PRIVATE.what_could_go_wrong);
  });

  test('(c) empty fields are filled, written to the INSERT (keywords as jsonb)', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const { sql, r, auto } = await run();
    expect(r).toMatchObject({
      category: 'fashion', format: 'showcase', event_time: '10:00', dress_code: 'model-off-duty',
      dress_code_keywords: JSON.stringify(['minimal', 'clean', 'modern']),
    });
    // opportunity_id follows payment_amount since Task #2314.
    expect(sql).toMatch(/payment_amount, opportunity_id, category, format, event_time, dress_code_keywords,\s*status/);
    expect(sql).toMatch(/:payment_amount, :opportunity_id, :category, :format, :event_time, :dress_code_keywords::jsonb,\s*:status/);
    expect(auto.styling_brief).toEqual(DRAFT.styling.styling_brief);
    expect(auto.auto_drafted).toMatchObject({
      category: 'ai_draft', format: 'ai_draft', event_time: 'ai_draft',
      dress_code: 'ai_draft', dress_code_keywords: 'ai_draft', styling_brief: 'ai_draft',
    });
    expect(auto.drafted_values).toMatchObject({
      category: 'fashion', format: 'showcase', event_time: '10:00',
      dress_code: 'model-off-duty', dress_code_keywords: ['minimal', 'clean', 'modern'],
    });
  });

  test('(a) the opportunity dress code is kept, and none of the drafted styling is used', async () => {
    mockDraft.mockResolvedValue(DRAFT);
    const { sql, r, auto } = await run({ opp: opportunity({ wardrobe_brief: { dress_code: 'all black' } }) });
    expect(r.dress_code).toBe('all black');
    expect(r).not.toHaveProperty('dress_code_keywords');
    expect(sql).not.toMatch(/dress_code_keywords/);
    expect(auto).not.toHaveProperty('styling_brief');
    for (const key of ['dress_code', 'dress_code_keywords', 'styling_brief']) {
      expect(auto.auto_drafted).not.toHaveProperty(key);
      expect(auto.drafted_values).not.toHaveProperty(key);
    }
    expect(r.format).toBe('showcase');
  });
});

describe('the schedule route passes the user id (source check)', () => {
  test('POST /:showId/schedule/:opportunityId passes req.user?.id', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'feedPipelineRoutes.js'), 'utf8');
    expect(src).toMatch(/scheduleOpportunityAsEvent\(req\.params\.opportunityId, req\.params\.showId, models, \{ userId: req\.user\?\.id \|\| null \}\)/);
  });
});
