/**
 * The Event Venue Look, L(b) (Evoni's ruling L1, 2026-10-02, with her
 * answers Q1-Q10; docs/EVENT_EPISODE_FLOW.md §8(hh)), on the migrated
 * database through the real routes:
 * - Evoni's save: seven parts, each Edited; reference images by asset ID,
 *   at most 3 used as references (Q1, Q2, Q6);
 * - "Draft from event details": host, description, activity, dress code,
 *   prestige, and the venue's description as context only (Q7); parts she
 *   edited are kept, the rest Auto-drafted, no confirm (Q8);
 * - the brief's event layer reads the look in place of theme, mood and
 *   colours; its lighting replaces the time line (Q3, Q4);
 * - editable while the episode is a draft, locked once accepted (Q9);
 * - shown in the Episode Locations step's proposal (Q10).
 * The AI client is mocked.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const lookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');
const { prepareSceneBrief } = require('../../src/services/sceneBriefService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const DRAFT = {
  overall: 'A candlelit greenhouse gala in ivory and gold.',
  decor: 'White orchids, gold-rimmed glassware, ivory linens.',
  lighting: 'Warm candlelight at dusk, with gold uplighting on the glass.',
  areas: ['Bar', 'Runway', 'VIP lounge'],
  signage: 'Gold easel frames by the entrance.',
  must_include: 'A long runway between the planters.',
  must_avoid: 'Neon, plastic flowers.',
};
const reply = (json) => ({ content: [{ text: JSON.stringify(json) }] });

(shouldSkip ? describe.skip : describe)('Event Venue Look (§8(hh) L1)', () => {
  const show = uuid();
  const location = uuid();
  const sceneSet = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (eventId, tail = '') => `/api/v1/world/${show}/events/${eventId}/venue-look${tail}`;

  async function event(extra = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, host_brand, description, format,
                 dress_code, theme, mood, color_palette, event_time, venue_location_id, scene_set_id, created_at, updated_at)
               VALUES (:id, :show, 'Velour Gala', 'invite', 'ready', 8, 'Velour', 'An awards night for new designers. Dinner follows.',
                 'gala', 'Black tie', 'Midnight garden', 'Romantic', '["emerald","blush"]', '10:00', :location, :sceneSet, NOW(), NOW())`,
    { id, show, location, sceneSet });
    if (extra.episodeStatus) {
      const ep = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
                 VALUES (:ep, :show, 'Gala ep', :n, 'draft', :evaluation, NOW(), NOW())`,
      { ep, show, n: Math.floor(Math.random() * 100000) + 100, evaluation: extra.episodeStatus });
      await run('UPDATE world_events SET used_in_episode_id = :ep WHERE id = :id', { ep, id });
    }
    return id;
  }
  async function asset() {
    const id = uuid();
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, show_id, s3_url_raw, s3_url_processed,
                 approval_status, is_global, metadata, created_at, updated_at)
               VALUES (:id, 'Moodboard', 'CUSTOM_GRAPHIC', 'CUSTOM_GRAPHIC', 'SHOW', 'SHOW', :show, 'https://x/raw.png', :processed,
                 'pending', false, '{}', NOW(), NOW())`,
    { id, show, processed: `https://x/${id}.png` });
    return id;
  }

  beforeAll(async () => {
    await lookMigration.up(sequelize.getQueryInterface());
    token = TokenService.generateTokenPair({
      id: 'test-user-look', email: 'user@look.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id: show, name: `Look ${show.slice(0, 8)}`, slug: `look-${show.slice(0, 8)}` });
    await run(`INSERT INTO world_locations (id, name, description, created_at, updated_at)
               VALUES (:location, 'The Glasshouse', 'A Victorian glass conservatory with iron ribs and tiled floors.', NOW(), NOW())`, { location });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, created_at, updated_at)
               VALUES (:sceneSet, 'The Glasshouse', 'EVENT_LOCATION', :show, :location, NOW(), NOW())`, { sceneSet, show, location });
  });
  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable and adds venue_look', async () => {
    await lookMigration.up(sequelize.getQueryInterface());
    const cols = await rows(`SELECT data_type FROM information_schema.columns WHERE table_name = 'world_events' AND column_name = 'venue_look'`);
    expect(cols).toEqual([{ data_type: 'jsonb' }]);
  });

  it('Evoni saves the seven parts: each is Edited, references are asset IDs with their images', async () => {
    const id = await event();
    const a1 = await asset(); const a2 = await asset();
    const res = await auth(request(app).put(url(id))).send({ venue_look: {
      ...DRAFT, references: [{ asset_id: a1, use_as_reference: true }, { asset_id: a2 }],
    } });
    expect(res.status).toBe(200);
    const look = res.body.data.venue_look;
    expect(look.overall).toBe(DRAFT.overall);
    expect(look.areas).toEqual(['Bar', 'Runway', 'VIP lounge']);
    expect(look.references).toEqual([
      { asset_id: a1, use_as_reference: true, url: `https://x/${a1}.png` },
      { asset_id: a2, use_as_reference: false, url: `https://x/${a2}.png` },
    ]);
    expect(Object.values(look.sources)).toEqual(Array(7).fill('edited'));

    const [stored] = await rows('SELECT venue_look FROM world_events WHERE id = :id', { id });
    expect(stored.venue_look.references).toEqual([{ asset_id: a1, use_as_reference: true }, { asset_id: a2, use_as_reference: false }]);

    const got = await auth(request(app).get(url(id)));
    expect(got.body.data).toEqual({ venue_look: look, editable: true });
  });

  it('at most 3 references are used as references; a missing asset is refused', async () => {
    const id = await event();
    const refs = [];
    for (let i = 0; i < 4; i += 1) refs.push({ asset_id: await asset(), use_as_reference: true });
    const four = await auth(request(app).put(url(id))).send({ venue_look: { overall: 'x', references: refs } });
    expect(four.status).toBe(400);
    expect(four.body.error).toMatch(/At most 3/);

    const gone = await auth(request(app).put(url(id))).send({ venue_look: { overall: 'x', references: [{ asset_id: uuid() }] } });
    expect(gone.status).toBe(404);
    const [stored] = await rows('SELECT venue_look FROM world_events WHERE id = :id', { id });
    expect(stored.venue_look).toBeNull();
  });

  it('Draft from event details reads the event and the venue (context only), keeps what Evoni edited, and needs no confirm', async () => {
    const id = await event();
    await auth(request(app).put(url(id))).send({ venue_look: { decor: 'Her own décor: peonies and brass.' } });

    mockCreate.mockResolvedValue(reply(DRAFT));
    const res = await auth(request(app).post(url(id, '/draft'))).send({});
    expect(res.status).toBe(200);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(mockCreate.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
    expect(prompt).toContain('Host: Velour');
    expect(prompt).toContain('Description: An awards night for new designers.');
    expect(prompt).toContain('Activity: gala');
    expect(prompt).toContain('Dress code: Black tie');
    expect(prompt).toContain('Prestige (1-10): 8');
    expect(prompt).toContain('The venue, for context only');
    expect(prompt).toContain('A Victorian glass conservatory');

    const look = res.body.data.venue_look;
    expect(look.decor).toBe('Her own décor: peonies and brass.');
    expect(look.sources.decor).toBe('edited');
    expect(look.overall).toBe(DRAFT.overall);
    expect(look.sources.overall).toBe('auto-drafted');
    expect(look.sources.areas).toBe('auto-drafted');
    expect(res.body.data.kept_edited).toEqual(['decor']);

    // Saving the drafted overall unchanged keeps it Auto-drafted; changing it makes it Edited.
    const same = await auth(request(app).put(url(id))).send({ venue_look: { overall: DRAFT.overall } });
    expect(same.body.data.venue_look.sources.overall).toBe('auto-drafted');
    const changed = await auth(request(app).put(url(id))).send({ venue_look: { overall: 'Her own overall look.' } });
    expect(changed.body.data.venue_look.sources.overall).toBe('edited');
  });

  it('a failed draft changes nothing and says so', async () => {
    const id = await event();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockResolvedValue({ content: [{ text: 'no json here' }] });
    const res = await auth(request(app).post(url(id, '/draft'))).send({});
    expect(res.status).toBe(502);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const [stored] = await rows('SELECT venue_look FROM world_events WHERE id = :id', { id });
    expect(stored.venue_look).toBeNull();
  });

  it("the brief's event layer reads the look in place of theme, mood and colours; its lighting is the time line", async () => {
    const id = await event();
    await auth(request(app).put(url(id))).send({ venue_look: DRAFT });
    const [set] = await rows('SELECT * FROM scene_sets WHERE id = :sceneSet', { sceneSet });
    const brief = await prepareSceneBrief(sequelize, set, { eventId: id });
    const line = (key) => brief.lines.find((l) => l.key === key);

    expect(line('concept')).toMatchObject({ text: `Dressed for Velour Gala: ${DRAFT.overall}`, source: 'look' });
    expect(line('decor')).toMatchObject({ source: 'look' });
    expect(line('decor').text).toContain('White orchids');
    expect(line('areas').text).toBe('Event areas: Bar, Runway, VIP lounge.');
    expect(line('must_avoid').text).toBe('Must avoid: Neon, plastic flowers.');
    expect(line('time')).toMatchObject({ text: DRAFT.lighting, source: 'look' });
    expect(line('mood')).toBeUndefined();
    expect(line('decor_colours')).toBeUndefined();
    expect(brief.lines.map((l) => l.text).join(' ')).not.toMatch(/Midnight garden|emerald|Romantic/);
  });

  it('the look is editable while the episode is a draft, and locked once it is accepted', async () => {
    const draftEp = await event({ episodeStatus: 'pending' });
    expect((await auth(request(app).put(url(draftEp))).send({ venue_look: { overall: 'Still editable.' } })).status).toBe(200);

    const accepted = await event({ episodeStatus: 'accepted' });
    const put = await auth(request(app).put(url(accepted))).send({ venue_look: { overall: 'Too late.' } });
    expect(put.status).toBe(409);
    expect(put.body.code).toBe('VENUE_LOOK_LOCKED');
    const draft = await auth(request(app).post(url(accepted, '/draft'))).send({});
    expect(draft.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
    expect((await auth(request(app).get(url(accepted)))).body.data.editable).toBe(false);
  });

  it("the Episode Locations step's proposal carries the look (Q10)", async () => {
    const id = await event();
    await auth(request(app).put(url(id))).send({ venue_look: { overall: DRAFT.overall } });
    const res = await auth(request(app).get(`/api/v1/world/${show}/events/${id}/episode-locations`));
    expect(res.status).toBe(200);
    expect(res.body.data.event_look.overall).toBe(DRAFT.overall);
  });
});
