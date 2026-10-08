/**
 * brain_documents was created only by a migration in the dead root tree, so
 * ingest-document's document row always failed (logged, not raised) and the
 * Show Bible's Documents tab and "from N documents" read nothing (wiring
 * map, docs/reads/2026-10-06-lalaverse-wiring-map.md §5 finding 5a, fix-list
 * item 19). src/migrations/20261008100000-create-brain-documents.js creates
 * it, with deleted_at.
 *
 * The extraction call is stubbed; the database is the local migrated test DB.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261008100000-create-brain-documents');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const SOURCE = 'Brain documents test';
const columns = async () => (await q(
  `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'brain_documents'`,
)).map((r) => r.column_name).sort();

(shouldSkip ? describe.skip : describe)('brain_documents', () => {
  let token;
  const qi = () => sequelize.getQueryInterface();
  const Sequelize = require('sequelize');

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-brain-documents', email: 'test@brain-documents.dev', name: 'Brain Documents Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    await run('DELETE FROM brain_documents WHERE source_name = :source', { source: SOURCE });
    await run('DELETE FROM franchise_knowledge WHERE source_document = :source', { source: SOURCE });
  });

  it('the migrated table has the model\'s columns and deleted_at', async () => {
    expect(await columns()).toEqual([
      'created_at', 'deleted_at', 'document_text', 'entries_created', 'id',
      'ingested_at', 'ingested_by', 'source_name', 'updated_at',
    ]);
  });

  it('ingest-document stores the document, and the Documents list returns it', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ entries: [{ title: 'Brain documents test: Velvet', content: 'Velvet is in.', category: 'world', severity: 'context' }] }) }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const res = await request(app).post('/api/v1/franchise-brain/ingest-document')
      .set('Authorization', `Bearer ${token}`)
      .send({ document_text: 'Velvet is in this season.', source_name: SOURCE });
    expect(res.status).toBe(200);
    expect(res.body.entries_created).toBe(1);

    const [row] = await q('SELECT source_name, document_text, entries_created FROM brain_documents WHERE source_name = :source', { source: SOURCE });
    expect(row).toEqual({ source_name: SOURCE, document_text: 'Velvet is in this season.', entries_created: 1 });

    const list = await request(app).get('/api/v1/franchise-brain/documents').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.documents.map((d) => d.source_name)).toContain(SOURCE);
  });

  it('up is guarded: a table already there only gains deleted_at, and a second run changes nothing', async () => {
    await run('ALTER TABLE brain_documents DROP COLUMN deleted_at');
    await migration.up(qi(), Sequelize);
    expect(await columns()).toContain('deleted_at');
    await migration.up(qi(), Sequelize);
    expect(await columns()).toContain('deleted_at');
    // The document read in above is still there.
    expect((await q('SELECT COUNT(*)::int AS n FROM brain_documents WHERE source_name = :source', { source: SOURCE }))[0].n).toBe(1);
  });

  it('down keeps a table that holds documents, and drops an empty one', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await migration.down(qi(), Sequelize);
    expect(await columns()).not.toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not dropped'));
    warn.mockRestore();

    const kept = await q('SELECT * FROM brain_documents');
    await run('DELETE FROM brain_documents');
    await migration.down(qi(), Sequelize);
    expect(await columns()).toEqual([]);

    // Put the table and its rows back for the rest of the suite.
    await migration.up(qi(), Sequelize);
    for (const r of kept) {
      await run(`INSERT INTO brain_documents (id, source_name, document_text, entries_created, ingested_by, ingested_at, created_at, updated_at)
                 VALUES (:id, :source_name, :document_text, :entries_created, :ingested_by, :ingested_at, :created_at, :updated_at)`, r);
    }
    await run(`SELECT setval(pg_get_serial_sequence('brain_documents', 'id'), GREATEST(COALESCE(MAX(id), 0), 1)) FROM brain_documents`);
    expect(await columns()).toContain('deleted_at');
  });
});
