/**
 * The Show Bible's other readers (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list item 25). The
 * franchise guard, the line rewrite, Amber, the tier guard and the rest
 * read franchise_knowledge with their own findAll: no show scope, so a
 * show's canon check counted another show's rules, and in whatever order
 * Postgres returned. They now select through services/brainRules.
 *
 * The AI is stubbed; the database is the local migrated test DB. The rows
 * here are this file's own; other rows in the table are left alone, so
 * counts are compared with what the same rule finds.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');
const { selectRules } = require('../../src/services/brainRules');
const { buildKnowledgeInjection } = require('../../src/routes/franchiseBrainRoutes');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (text) => ({ content: [{ text }], usage: { input_tokens: 1, output_tokens: 1 } });
const promptOf = (call) => call[0].messages[0].content;

const SOURCE = 'brain-direct-readers-test';
const TITLE = 'Readers test';

(shouldSkip ? describe.skip : describe)('Show Bible readers: show scope and the shared order', () => {
  const showA = crypto.randomUUID();
  const showB = crypto.randomUUID();
  const titles = {
    franchise: `${TITLE}: franchise law`,
    showA: `${TITLE}: show A law`,
    showB: `${TITLE}: show B law`,
    unassigned: `${TITLE}: show law not yet assigned`,
    archived: `${TITLE}: archived law`,
    card: `${TITLE}: important card`,
    alwaysImportant: `${TITLE}: important always-inject rule`,
  };
  let token;
  let savedKey;

  const insert = async ({ title, severity = 'critical', always = true, status = 'active', scope = 'franchise', show = null, source = SOURCE, category = 'franchise_law' }) => {
    const [row] = await q(
      `INSERT INTO franchise_knowledge (title, content, category, severity, always_inject, source_document, status, scope, show_id, created_at, updated_at)
       VALUES (:title, :content, :category, :severity, :always, :source, :status, :scope, :show, NOW(), NOW())
       RETURNING id`,
      { title, content: `${title}, in full.`, category, severity, always, source, status, scope, show });
    return row.id;
  };
  const counts = async () => Object.fromEntries((await q(
    `SELECT title, COALESCE(injection_count, 0) AS n FROM franchise_knowledge WHERE title LIKE :like`, { like: `${TITLE}%` },
  )).map((r) => [r.title, Number(r.n)]));
  const guardRuleCount = async (show) => Number((await q(
    `SELECT COUNT(*) AS n FROM franchise_knowledge
      WHERE status = 'active' AND (severity = 'critical' OR always_inject = true)
        ${show ? 'AND (show_id IS NULL OR show_id = :show)' : ''}`, { show },
  ))[0].n);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-brain-readers', email: 'test@brain-readers.dev', name: 'Brain Readers Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    savedKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-used';
    // Inserted in this order, so ids ascend: within critical the order is
    // franchise, show A, show B, not yet assigned.
    await insert({ title: titles.franchise });
    await insert({ title: titles.showA, scope: 'show', show: showA });
    await insert({ title: titles.showB, scope: 'show', show: showB });
    await insert({ title: titles.unassigned, scope: 'show' });
    await insert({ title: titles.archived, status: 'archived' });
    await insert({ title: titles.card, severity: 'important', always: false });
    await insert({ title: titles.alwaysImportant, severity: 'important', always: true });
  });

  afterAll(async () => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
    await sequelize.query(`DELETE FROM franchise_knowledge WHERE title LIKE :like`, { replacements: { like: `${TITLE}%` } });
  });

  beforeEach(() => mockCreate.mockReset());

  const guard = (body) => request(app).post('/api/v1/franchise-brain/guard').set('Authorization', `Bearer ${token}`).send(body);

  it('the guard with a show checks the franchise tier, that show and unassigned show entries, never another show', async () => {
    mockCreate.mockResolvedValue(reply('{"passed": true, "warnings": []}'));
    const res = await guard({ scene_brief: 'Lala arrives at the gala alone.', show_id: showA });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('passed');
    expect(res.body.rules_checked).toBe(await guardRuleCount(showA));
    const prompt = promptOf(mockCreate.mock.calls[0]);
    for (const t of [titles.franchise, titles.showA, titles.unassigned, titles.alwaysImportant]) expect(prompt).toContain(t);
    for (const t of [titles.showB, titles.archived, titles.card]) expect(prompt).not.toContain(t);
    // The shared order: critical by id, then important.
    const at = (t) => prompt.indexOf(t);
    expect(at(titles.franchise)).toBeLessThan(at(titles.showA));
    expect(at(titles.showA)).toBeLessThan(at(titles.unassigned));
    expect(at(titles.unassigned)).toBeLessThan(at(titles.alwaysImportant));
  });

  it('the canon check (items) is scoped the same way', async () => {
    mockCreate.mockResolvedValue(reply('{"passed": true, "warnings": []}'));
    const res = await guard({ items: [{ key: 'episode:1', label: 'Episode 1', brief: 'No venue.' }], show_id: showB });
    expect(res.status).toBe(200);
    expect(res.body.rules_checked).toBe(await guardRuleCount(showB));
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain(titles.showB);
    expect(prompt).not.toContain(titles.showA);
  });

  it('without a show the guard still checks every show\'s rules', async () => {
    mockCreate.mockResolvedValue(reply('{"passed": true, "warnings": []}'));
    const res = await guard({ scene_brief: 'Lala arrives at the gala alone.' });
    expect(res.body.rules_checked).toBe(await guardRuleCount(null));
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain(titles.showA);
    expect(prompt).toContain(titles.showB);
  });

  it('a show_id that is not a show id is refused before any AI call', async () => {
    const res = await guard({ scene_brief: 'Lala arrives.', show_id: 'show-b' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('show_id must be a show id (UUID)');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('the line rewrite reads the Script tab\'s show: its always-inject rules and the franchise\'s, not another show\'s', async () => {
    mockCreate.mockResolvedValue(reply('Bestie, we are SO back.'));
    const episodeId = crypto.randomUUID();
    const res = await request(app).post(`/api/v1/episode-brief/${episodeId}/rewrite-line`).set('Authorization', `Bearer ${token}`)
      .send({ line: 'We are back.', speaker: 'Lala', showId: showA });
    expect(res.status).toBe(200);
    expect(res.body.rewrittenLine).toBe('Bestie, we are SO back.');
    const prompt = promptOf(mockCreate.mock.calls[0]);
    for (const t of [titles.franchise, titles.showA, titles.unassigned, titles.alwaysImportant]) expect(prompt).toContain(t);
    for (const t of [titles.showB, titles.archived, titles.card]) expect(prompt).not.toContain(t);

    const bad = await request(app).post(`/api/v1/episode-brief/${episodeId}/rewrite-line`).set('Authorization', `Bearer ${token}`)
      .send({ line: 'We are back.', speaker: 'Lala', showId: 'show-a' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('showId must be a show id (UUID)');
  });

  it('Amber\'s knowledge block lists critical and always-inject rules in the shared order and counts each use', async () => {
    const before = await counts();
    const block = await buildKnowledgeInjection();
    const at = (t) => block.indexOf(t);
    for (const t of [titles.franchise, titles.showA, titles.showB, titles.unassigned, titles.alwaysImportant]) expect(at(t)).toBeGreaterThan(-1);
    for (const t of [titles.archived, titles.card]) expect(at(t)).toBe(-1);
    expect(at(titles.franchise)).toBeLessThan(at(titles.showA));
    expect(at(titles.showB)).toBeLessThan(at(titles.unassigned));
    expect(at(titles.unassigned)).toBeLessThan(at(titles.alwaysImportant));
    const after = await counts();
    expect(after[titles.franchise]).toBe(before[titles.franchise] + 1);
    expect(after[titles.alwaysImportant]).toBe(before[titles.alwaysImportant] + 1);
    expect(after[titles.card]).toBe(before[titles.card]);
    expect(after[titles.archived]).toBe(before[titles.archived]);
  });

  // The tier guard reads the franchise tier only (Evoni's ruling,
  // 2026-10-08, the item 25 follow-up), so a show's entries are not
  // checked and not counted.
  it('the tier guard still counts each law it checked, in one statement', async () => {
    mockCreate.mockResolvedValue(reply('{"violations": [], "score": 100, "summary": "Clean."}'));
    const before = await counts();
    const res = await request(app).post('/api/v1/tier/franchise-guard-check').set('Authorization', `Bearer ${token}`)
      .send({ scene_text: 'JustAWoman opens the studio at dawn.' });
    expect(res.status).toBe(200);
    expect(res.body.score).toBe(100);
    const after = await counts();
    for (const t of [titles.franchise, titles.card, titles.alwaysImportant]) expect(after[t]).toBe(before[t] + 1);
    for (const t of [titles.showA, titles.showB, titles.unassigned, titles.archived]) expect(after[t]).toBe(before[t]);
  });

  it('the database orders severity as the Bible ranks it, so a limit cuts the same set', async () => {
    // Ids ascend context, important, critical: by name the order would be
    // context first; by the severity ENUM it is critical first.
    const ids = [];
    for (const severity of ['context', 'important', 'critical']) {
      ids.push(await insert({ title: `${TITLE}: order ${severity}`, severity, always: false, source: `${SOURCE}-order` }));
    }
    const where = { source_document: `${SOURCE}-order` };
    const [first] = await selectRules(db.FranchiseKnowledge, { where, limit: 1 });
    expect(first.title).toBe(`${TITLE}: order critical`);
    const all = await selectRules(db.FranchiseKnowledge, { where });
    expect(all.map((r) => r.id)).toEqual([ids[2], ids[1], ids[0]]);
  });
});
