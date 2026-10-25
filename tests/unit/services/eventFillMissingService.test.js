/**
 * Fill what's missing (src/services/eventFillMissingService.js): the drafts
 * are checked against the asked fields and the event PUT's allowlist, a
 * budget refusal is a 429 and never retried, an overload is tried twice,
 * and a deal's missing fees come from the rate card, not the AI. The SDK
 * client is passed in; no database, no network.
 */
// The cost tracker's spend read needs the database; the budget refusal it
// raises is stood in for by the client below.
jest.mock('../../../src/services/aiCostTracker', () => ({}));
jest.mock('../../../src/services/seasonSlotService', () => ({
  eventSeasonContext: jest.fn(async () => ({
    arc_title: 'Rise', label: 'S1 · E3', phase: { title: 'Arrival' }, desired_pressure: 'Rising',
    story_purposes: [{ text: 'She meets the brand that could make her', primary: false }, { text: 'Lala is seen by the fashion press', primary: true }],
  })),
}));

const svc = require('../../../src/services/eventFillMissingService');
const { EVENT_PUT_FIELDS } = require('../../../src/routes/worldEvents/update');

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Night', event_type: 'invite', prestige: 7, host_brand: 'Maison Velour',
  source_profile_id: 5, venue_location_id: 'loc-1', category: null, format: 'gala', event_time: null, description: null,
  dress_code: 'Black tie', theme: null, mood: null, narrative_stakes: null, fail_consequence: null, success_unlock: null,
  career_milestone: null, deal_type: null, canon_consequences: {},
};
const select = (rows) => [rows];
const models = (queries = {}) => ({
  sequelize: {
    query: jest.fn(async (sql) => {
      if (/MAX\(version\)/.test(sql)) return select([{ version: queries.cardVersion ?? null }]);
      if (/FROM deal_rate_anchors/.test(sql)) return select(queries.anchors || []);
      if (/FROM deal_rate_premiums/.test(sql)) return select([]);
      if (/FROM character_state/.test(sql)) return select(queries.state || []);
      return select([]);
    }),
  },
  SocialProfile: { findByPk: jest.fn(async () => ({ display_name: 'Ama Velour' })) },
  WorldLocation: { findByPk: jest.fn(async () => ({ name: 'The Glasshouse', city: 'Lalaville', venue_type: 'rooftop_bar' })) },
});
const reply = (drafts) => ({ content: [{ text: JSON.stringify({ drafts }) }] });
const clientWith = (impl) => ({ messages: { create: jest.fn(impl) } });
const budgetError = () => Object.assign(new Error('Daily AI budget reached'), { code: 'AI_BUDGET_EXCEEDED', status: 429 });

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the fields', () => {
  test('every AI field is on the event PUT allowlist', () => {
    for (const f of svc.AI_FIELD_NAMES) expect(EVENT_PUT_FIELDS).toContain(f);
    for (const f of ['appearance_fee', 'partnership_base_fee', 'performance_fee']) expect(EVENT_PUT_FIELDS).toContain(f);
  });
  test('only the empty ones are asked for; a time in the automation copy counts as set', () => {
    expect(svc.emptyAiFields(EVENT)).toEqual(['category', 'event_date', 'event_time', 'description', 'theme', 'mood', 'narrative_stakes', 'fail_consequence', 'success_unlock', 'career_milestone']);
    expect(svc.emptyAiFields({ ...EVENT, canon_consequences: { automation: { event_time: '19:00' } } })).not.toContain('event_time');
  });
  test('it covers every field Suggest with AI did; ideas are those six', () => {
    const { SUGGEST_BASICS_FIELDS } = require('../../../src/utils/suggestBasics');
    for (const f of SUGGEST_BASICS_FIELDS) expect(svc.AI_FIELD_NAMES).toContain(f);
    expect([...svc.IDEA_FIELDS].sort()).toEqual([...SUGGEST_BASICS_FIELDS].sort());
    expect(svc.MODES).toEqual(['missing', 'ideas']);
  });
  test('the model is the repo default', () => {
    expect(svc.MODELS).toEqual(['claude-sonnet-4-6']);
  });
});

describe('draftsFromReply: the allowlist and the rules', () => {
  const fields = ['category', 'event_time', 'description', 'theme', 'name'];
  test('drops a field not asked for, not on the allowlist, or with a value or reason that fails', () => {
    const text = JSON.stringify({ drafts: [
      { field: 'category', value: 'luxury_prestige', reason: 'A gala.' },
      { field: 'category', value: 'fashion', reason: 'A second one for the same field.' },
      { field: 'event_time', value: '7pm', reason: 'Not HH:MM.' },
      { field: 'description', value: 'x'.repeat(1201), reason: 'Too long.' },
      { field: 'theme', value: 'Midnight velvet', reason: 'r'.repeat(141) },
      { field: 'used_in_episode_id', value: 'ep-1', reason: 'Not asked.' },
      { field: 'status', value: 'used', reason: 'Not asked.' },
      { field: 'format', value: 'gala', reason: 'Not asked (already set).' },
      { field: 'name', value: 'Asked but not an AI field', reason: 'x' },
    ] });
    expect(svc.draftsFromReply(`Here you go: ${text}`, { fields, allowed: EVENT_PUT_FIELDS })).toEqual([
      { field: 'category', label: 'Category', value: 'luxury_prestige', source: 'ai', reason: 'A gala.' },
    ]);
  });
  test('a date is real and today or later', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    const pick = (value) => svc.draftsFromReply(JSON.stringify({ drafts: [{ field: 'event_date', value, reason: 'Fits.' }] }), { fields: ['event_date'], allowed: EVENT_PUT_FIELDS, now });
    expect(pick('2026-10-25')).toEqual([{ field: 'event_date', label: 'Date', value: '2026-10-25', source: 'ai', reason: 'Fits.' }]);
    expect(pick('2026-10-24')).toEqual([]);
    expect(pick('2026-02-30')).toEqual([]);
    expect(pick('Nov 9')).toEqual([]);
  });
  test('ideas: each draft says what it replaces; one equal to the current value is dropped', () => {
    const event = { ...EVENT, category: 'fashion', dress_code: 'Black tie' };
    const text = JSON.stringify({ drafts: [
      { field: 'category', value: 'luxury_prestige', reason: 'Grander.' },
      { field: 'dress_code', value: 'Black tie', reason: 'The same.' },
      { field: 'event_time', value: '20:00', reason: 'Later.' },
    ] });
    expect(svc.draftsFromReply(text, { fields: svc.IDEA_FIELDS, allowed: EVENT_PUT_FIELDS, event })).toEqual([
      { field: 'category', label: 'Category', value: 'luxury_prestige', source: 'ai', reason: 'Grander.', current: 'fashion' },
      { field: 'event_time', label: 'Time', value: '20:00', source: 'ai', reason: 'Later.' },
    ]);
  });
  test('a field the PUT would not accept is dropped even when asked for', () => {
    const text = JSON.stringify({ drafts: [{ field: 'theme', value: 'Velvet', reason: 'Fits.' }] });
    expect(svc.draftsFromReply(text, { fields: ['theme'], allowed: ['description'] })).toEqual([]);
  });
  test('unreadable: []', () => {
    expect(svc.draftsFromReply('no json', { fields, allowed: EVENT_PUT_FIELDS })).toEqual([]);
    expect(svc.draftsFromReply('{bad json}', { fields, allowed: EVENT_PUT_FIELDS })).toEqual([]);
  });
});

describe('rateCardDrafts: a deal\'s missing fees from the card, never the AI', () => {
  const card = { version: 2, anchors: { brand_partnership_base: { 3: 1500 }, paid_appearance: { 3: 800 }, performance_booking: { 3: null } } };
  test('the missing components of the deal at the tier', () => {
    expect(svc.rateCardDrafts({ deal_type: 'brand_partnership', deal_components: null, partnership_base_fee: null }, card, 3)).toEqual([
      { field: 'partnership_base_fee', label: 'Partnership base', value: 1500, source: 'rate_card', reason: "The rate card's partnership base at tier 3" },
    ]);
  });
  test('a fee already set, a deal with no cash, and an anchor the card lacks: nothing', () => {
    expect(svc.rateCardDrafts({ deal_type: 'paid_appearance', appearance_fee: 900 }, card, 3)).toEqual([]);
    expect(svc.rateCardDrafts({ deal_type: 'gifted' }, card, 3)).toEqual([]);
    expect(svc.rateCardDrafts({ deal_type: 'performance_booking', performance_fee: null }, card, 3)).toEqual([]);
    expect(svc.rateCardDrafts({ deal_type: null }, card, 3)).toEqual([]);
  });
});

describe('draftMissing', () => {
  test('one call with the host, venue, slot purposes and season line; the drafts that pass', async () => {
    const client = clientWith(async () => reply([
      { field: 'category', value: 'luxury_prestige', reason: 'A black-tie gala.' },
      { field: 'theme', value: 'Midnight velvet', reason: 'Matches the house.' },
      { field: 'dress_code', value: 'Cocktail', reason: 'Already set, not asked.' },
    ]));
    const got = await svc.draftMissing(models(), { showId: 'show-1', event: EVENT, allowed: EVENT_PUT_FIELDS, client });
    expect(got.status).toBe(200);
    expect(got.drafts).toEqual([
      { field: 'category', label: 'Category', value: 'luxury_prestige', source: 'ai', reason: 'A black-tie gala.' },
      { field: 'theme', label: 'Invitation theme', value: 'Midnight velvet', source: 'ai', reason: 'Matches the house.' },
    ]);
    expect(client.messages.create).toHaveBeenCalledTimes(1);
    const { model, messages } = client.messages.create.mock.calls[0][0];
    expect(model).toBe('claude-sonnet-4-6');
    const prompt = messages[0].content;
    for (const fact of ['Velour Night', 'Maison Velour', 'Ama Velour', 'The Glasshouse, Lalaville (rooftop bar)', 'Rise · S1 · E3 · Arrival', 'Story purpose of its slot: Lala is seen by the fashion press', 'Also: She meets the brand', 'Desired pressure: Rising', 'dress_code: Black tie']) {
      expect(prompt).toContain(fact);
    }
    expect(prompt).not.toMatch(/- dress_code:/);
  });

  test('a budget refusal is a 429 with its reason, and is not retried', async () => {
    const client = clientWith(async () => { throw budgetError(); });
    const got = await svc.draftMissing(models(), { showId: 'show-1', event: EVENT, allowed: EVENT_PUT_FIELDS, client });
    expect(got).toEqual({ status: 429, error: 'Daily AI budget reached', code: 'AI_BUDGET_EXCEEDED' });
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  test('two attempts on an overload, then the second answer', async () => {
    let n = 0;
    const client = clientWith(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error('Overloaded'), { status: 529 });
      return reply([{ field: 'mood', value: 'Hushed glamour', reason: 'A late gala.' }]);
    });
    const wait = jest.fn(async () => {});
    const got = await svc.draftMissing(models(), { showId: 'show-1', event: EVENT, allowed: EVENT_PUT_FIELDS, client, wait });
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(2000);
    expect(got.drafts.map((d) => d.field)).toEqual(['mood']);
  });

  test('overloaded twice: 502, two attempts only; another error is not retried', async () => {
    const overloaded = clientWith(async () => { throw Object.assign(new Error('Overloaded'), { status: 529 }); });
    expect(await svc.draftMissing(models(), { showId: 'show-1', event: EVENT, allowed: EVENT_PUT_FIELDS, client: overloaded, wait: async () => {} }))
      .toEqual({ status: 502, error: "Couldn't draft the missing fields right now." });
    expect(overloaded.messages.create).toHaveBeenCalledTimes(2);
    const broken = clientWith(async () => { throw Object.assign(new Error('Bad request'), { status: 400 }); });
    expect((await svc.draftMissing(models(), { showId: 'show-1', event: EVENT, allowed: EVENT_PUT_FIELDS, client: broken })).status).toBe(502);
    expect(broken.messages.create).toHaveBeenCalledTimes(1);
  });

  test('nothing empty: no model call; the rate card still prices a missing fee', async () => {
    const full = Object.fromEntries(svc.AI_FIELD_NAMES.map((f) => [f, f === 'category' ? 'fashion' : f === 'event_time' ? '19:00' : 'set']));
    const event = { ...EVENT, ...full, deal_type: 'paid_appearance', appearance_fee: null, career_tier: 2 };
    const client = clientWith(async () => reply([]));
    const m = models({ cardVersion: 2, anchors: [{ component: 'paid_appearance', career_tier: 2, amount: '650' }] });
    const got = await svc.draftMissing(m, { showId: 'show-1', event, allowed: EVENT_PUT_FIELDS, client });
    expect(client.messages.create).not.toHaveBeenCalled();
    expect(got).toEqual({ status: 200, asked: [], drafts: [
      { field: 'appearance_fee', label: 'Appearance fee', value: 650, source: 'rate_card', reason: "The rate card's appearance fee at tier 2" },
    ] });
  });

  test('ideas: the six basics even when set, with their current values in the prompt; fees still priced', async () => {
    const full = Object.fromEntries(svc.AI_FIELD_NAMES.map((f) => [f, f === 'category' ? 'fashion' : f === 'event_time' ? '19:00' : f === 'event_date' ? '2026-11-09' : 'set']));
    const event = { ...EVENT, ...full, format: 'gala', deal_type: 'paid_appearance', appearance_fee: null, career_tier: 2 };
    const client = clientWith(async () => reply([
      { field: 'format', value: 'dinner', reason: 'A seated dinner instead.' },
      { field: 'theme', value: 'Not asked', reason: 'Not one of the six.' },
    ]));
    const m = models({ cardVersion: 2, anchors: [{ component: 'paid_appearance', career_tier: 2, amount: '650' }] });
    const got = await svc.draftMissing(m, { showId: 'show-1', event, allowed: EVENT_PUT_FIELDS, client, mode: 'ideas', now: new Date('2026-10-25T00:00:00Z') });
    expect(got.status).toBe(200);
    expect(got.asked).toEqual(['category', 'format', 'event_date', 'event_time', 'description', 'dress_code']);
    expect(got.drafts).toEqual([
      { field: 'format', label: 'Format', value: 'dinner', source: 'ai', reason: 'A seated dinner instead.', current: 'gala' },
      { field: 'appearance_fee', label: 'Appearance fee', value: 650, source: 'rate_card', reason: "The rate card's appearance fee at tier 2" },
    ]);
    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('suggesting fresh ideas');
    expect(prompt).toContain('Their current values:\ncategory: fashion\nformat: gala\nevent_date: 2026-11-09');
    expect(prompt).toContain('different from its current value');
    expect(prompt).toContain('- event_date: a date on or after 2026-10-25, as YYYY-MM-DD');
    expect(prompt).not.toMatch(/- theme:/);
  });

  test('no API key and no client: 503', async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect((await svc.draftMissing(models(), { showId: 'show-1', event: EVENT, allowed: EVENT_PUT_FIELDS })).status).toBe(503);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
