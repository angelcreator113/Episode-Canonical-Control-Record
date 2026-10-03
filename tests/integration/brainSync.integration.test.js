/**
 * Brain Update, step 1 (Evoni, 2026-10-03; docs/BRAIN_OWNERSHIP.md): the
 * Social Systems page syncs into franchise_knowledge by source key. A second
 * sync of the same page writes nothing; an edit supersedes; a removed item
 * retires; entries the page never keyed are left alone; a synced entry is
 * edited on its page, not in the Brain. On the migrated database through
 * the real routes.
 */
jest.unmock('uuid');

const request = require('supertest');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261003120000-franchise-knowledge-source-key');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const PAGE = () => ({
  ARCHETYPES: [
    { num: '11', name: 'The Connector', icon: '🔗', color: '#6bba9a', content: 'Collaborations, group events', audience: 'Creates network clusters', narrative: 'The bridge.' },
    { num: '06', name: 'The Drama Magnet', icon: '🔥', color: '#d4789a', content: 'Arguments, callouts', audience: 'Viral gossip cycles', narrative: 'Catalyst.' },
  ],
  INFLUENCE_FORCES: [
    { force: 'Reach', icon: '📡', color: '#7ab3d4', definition: 'Follower count', built: 'Consistency', destroys: 'Bans' },
  ],
});

(shouldSkip ? describe.skip : describe)('Brain sync (Brain Update step 1)', () => {
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const preview = (page) => auth(request(app).post('/api/v1/franchise-brain/sync/social_systems/preview')).send({ page_data: page });
  const apply = (page, fingerprint) => auth(request(app).post('/api/v1/franchise-brain/sync/social_systems/apply')).send({ page_data: page, fingerprint });
  const active = () => rows(`SELECT id, source_key, title, content, status, superseded_by FROM franchise_knowledge
                               WHERE source_key LIKE 'social_systems:%' AND status = 'active' AND deleted_at IS NULL ORDER BY source_key`);

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-brain-sync', email: 'user@brainsync.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await rows("DELETE FROM franchise_knowledge WHERE source_key LIKE 'social_systems:%' OR source_document = 'influencer-systems-v1.0'");
    // An entry from before source keys (seeder or the old Push to Brain).
    await rows(`INSERT INTO franchise_knowledge (title, content, category, severity, source_document, extracted_by, status, created_at, updated_at)
                VALUES ('Legacy archetype law', 'Old extracted text', 'franchise_law', 'critical', 'influencer-systems-v1.0', 'document_ingestion', 'active', NOW(), NOW())`);
  });

  test('the migration is guarded: running it again changes nothing', async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    const idx = await rows("SELECT indexname FROM pg_indexes WHERE tablename = 'franchise_knowledge' AND indexname LIKE '%source_key%' ORDER BY 1");
    expect(idx.map((r) => r.indexname)).toEqual(['franchise_knowledge_active_source_key', 'franchise_knowledge_source_key']);
  });

  test('an unconnected page previews every card as new, keyed, without presentation fields; legacy is counted', async () => {
    const res = await preview(PAGE());
    expect(res.status).toBe(200);
    const p = res.body.data;
    expect(p).toMatchObject({ source: 'social_systems', label: 'Social Systems', state: 'not_connected', pending: 3, legacy: 1 });
    expect(p.new.map((c) => c.source_key)).toEqual([
      'social_systems:archetype:the-connector', 'social_systems:archetype:the-drama-magnet', 'social_systems:influence-force:reach',
    ]);
    expect(p.new[0].title).toBe('The Connector — Social Archetype');
    expect(p.new[0].content).toBe('The Connector (Social Archetype)\nContent: Collaborations, group events\nAudience effect: Creates network clusters\nNarrative use: The bridge.');
    expect(p.new[0].content).not.toMatch(/#6bba9a|🔗|\b11\b/);
    expect(await active()).toEqual([]);
  });

  test('applying writes active entries; syncing the same page again writes nothing', async () => {
    const p = (await preview(PAGE())).body.data;
    const res = await apply(PAGE(), p.fingerprint);
    expect(res.status).toBe(200);
    expect(res.body.data.applied).toEqual({ new: 3, changed: 0, retired: 0 });
    expect(res.body.data.preview).toMatchObject({ state: 'up_to_date', pending: 0 });
    expect(res.body.data.preview.unchanged).toHaveLength(3);
    const after = await active();
    expect(after).toHaveLength(3);
    expect(after.every((e) => e.status === 'active')).toBe(true);

    const again = (await preview(PAGE())).body.data;
    expect(again.state).toBe('up_to_date');
    const res2 = await apply(PAGE(), again.fingerprint);
    expect(res2.body.data.applied).toEqual({ new: 0, changed: 0, retired: 0 });
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM franchise_knowledge WHERE source_key LIKE 'social_systems:%'");
    expect(n).toBe(3);
  });

  test('an edited item supersedes its entry with before and after; a removed item retires; legacy is untouched', async () => {
    const page = PAGE();
    page.ARCHETYPES[0].audience = 'Creates network clusters and hosts gatherings';
    page.ARCHETYPES[0].color = '#000000'; // presentation only: not a change on its own
    page.INFLUENCE_FORCES = [];
    const p = (await preview(page)).body.data;
    expect(p.state).toBe('updates');
    expect(p.changed).toHaveLength(1);
    expect(p.changed[0].before.content).toMatch(/Audience effect: Creates network clusters\n/);
    expect(p.changed[0].content).toMatch(/hosts gatherings/);
    expect(p.retired.map((r) => r.source_key)).toEqual(['social_systems:influence-force:reach']);
    expect(p.unchanged.map((u) => u.source_key)).toEqual(['social_systems:archetype:the-drama-magnet']);

    const oldId = p.changed[0].entry_id;
    const res = await apply(page, p.fingerprint);
    expect(res.body.data.applied).toEqual({ new: 0, changed: 1, retired: 1 });
    const [old] = await rows('SELECT status, superseded_by FROM franchise_knowledge WHERE id = :oldId', { oldId });
    const now = (await active()).find((e) => e.source_key === 'social_systems:archetype:the-connector');
    expect(old).toEqual({ status: 'superseded', superseded_by: now.id });
    expect(now.content).toMatch(/hosts gatherings/);
    const [reach] = await rows("SELECT status, review_note FROM franchise_knowledge WHERE source_key = 'social_systems:influence-force:reach'");
    expect(reach).toEqual({ status: 'archived', review_note: 'Removed from Social Systems; retired by Brain sync' });
    const [legacy] = await rows("SELECT status, content FROM franchise_knowledge WHERE title = 'Legacy archetype law'");
    expect(legacy).toEqual({ status: 'active', content: 'Old extracted text' });
  });

  test('a stale review is refused and writes nothing; bad requests say why', async () => {
    const stale = (await preview(PAGE())).body.data.fingerprint;
    const page = PAGE();
    page.ARCHETYPES[1].narrative = 'Catalyst, changed after the review.';
    const res = await apply(page, stale);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/changed since this review/);
    expect((await active()).find((e) => e.source_key === 'social_systems:archetype:the-drama-magnet').content).toMatch(/Narrative use: Catalyst\.$/);

    expect((await auth(request(app).post('/api/v1/franchise-brain/sync/nope/preview')).send({ page_data: {} })).status).toBe(404);
    expect((await apply(PAGE(), '')).status).toBe(400);
    expect((await request(app).post('/api/v1/franchise-brain/sync/social_systems/preview').send({ page_data: PAGE() })).status).toBe(401);
  });

  test('a synced entry is edited on its page, not in the Brain; an unkeyed entry still edits', async () => {
    const [connector] = (await active()).filter((e) => e.source_key === 'social_systems:archetype:the-connector');
    const res = await auth(request(app).patch(`/api/v1/franchise-brain/entries/${connector.id}`)).send({ content: 'A second copy' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ managed_by: 'Social Systems' });
    const [legacy] = await rows("SELECT id FROM franchise_knowledge WHERE title = 'Legacy archetype law'");
    const ok = await auth(request(app).patch(`/api/v1/franchise-brain/entries/${legacy.id}`)).send({ content: 'Edited legacy text' });
    expect(ok.status).toBe(200);
  });
});
