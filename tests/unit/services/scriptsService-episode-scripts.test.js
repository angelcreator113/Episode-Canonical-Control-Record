/**
 * scriptsService.getScriptsByEpisode, and what it reads when its first query
 * fails (Evoni, 2026-11-22). The first query names script_type and
 * version_number; neither migration that creates episode_scripts gives the
 * table those columns, so the fallback is what answers where only they have
 * run. The fallback read `SELECT * ... WHERE episode_id = $1`: soft-deleted
 * scripts too, with every column, the text included whether asked for or not.
 * It now reads live rows only and returns named fields (the text when asked
 * for), as services/scriptReadFields names them.
 *
 * The pool is a stand-in: no database is read.
 */
const mockQuery = jest.fn();
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: (...a) => mockQuery(...a) })) }));
jest.mock('../../../src/services/Logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const Logger = require('../../../src/services/Logger');
const scriptsService = require('../../../src/services/scriptsService');
const { SCRIPT_FIELDS, SCRIPT_CONTENT_FIELDS } = require('../../../src/services/scriptReadFields');

const EP = '11111111-1111-4111-8111-111111111111';
// A row of the table as migration 20240101000007 creates it.
const SIMPLE = {
  id: 7, episode_id: EP, version: 1, content: 'Lala: The unpublished line.', status: 'draft', is_current: true,
  created_by: 'sub-123', notes: 'a private note', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z', deleted_at: null,
};
const missingColumn = () => Object.assign(new Error('column "script_type" does not exist'), { code: '42703' });

beforeEach(() => {
  mockQuery.mockReset();
  Logger.error.mockClear();
});

describe('the first query', () => {
  test('reads live rows, the latest of each type, by named columns', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'sc-1' }] });
    expect(await scriptsService.getScriptsByEpisode(EP)).toEqual([{ id: 'sc-1' }]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/is_latest = TRUE/);
    expect(sql).not.toMatch(/SELECT\s+\*/);
    expect(sql).not.toMatch(/\bcontent\b/);
    expect(params).toEqual([EP]);
  });

  test('the options are as they were', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await scriptsService.getScriptsByEpisode(EP, { includeAllVersions: true, includeContent: true, scriptType: 'main' });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).not.toMatch(/is_latest = TRUE/);
    expect(sql).toMatch(/script_type = \$2/);
    expect(params).toEqual([EP, 'main']);
  });
});

describe('the fallback, when the first query fails', () => {
  const failFirst = (rows) => mockQuery.mockRejectedValueOnce(missingColumn()).mockResolvedValueOnce({ rows });

  test('never reads a soft-deleted script', async () => {
    failFirst([SIMPLE]);
    await scriptsService.getScriptsByEpisode(EP);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(sql).toMatch(/WHERE episode_id = \$1 AND deleted_at IS NULL/);
    expect(params).toEqual([EP]);
  });

  test('without includeContent: named fields only, never the text, the notes or deleted_at', async () => {
    failFirst([SIMPLE]);
    const rows = await scriptsService.getScriptsByEpisode(EP);
    expect(rows).toEqual([{ id: 7, episode_id: EP, version: 1, status: 'draft', created_by: 'sub-123', created_at: SIMPLE.created_at, updated_at: SIMPLE.updated_at }]);
    for (const k of Object.keys(rows[0])) expect(SCRIPT_FIELDS).toContain(k);
    expect(JSON.stringify(rows)).not.toContain('unpublished line');
  });

  test('with includeContent: the text too, and still no column that is not named', async () => {
    failFirst([{ ...SIMPLE, script_text: 'Me: the writer text', financial_context: { balance: 12 }, author_notes: 'private' }]);
    const [row] = await scriptsService.getScriptsByEpisode(EP, { includeContent: true });
    expect(row.content).toBe(SIMPLE.content);
    expect(row.script_text).toBe('Me: the writer text');
    for (const k of Object.keys(row)) expect([...SCRIPT_FIELDS, ...SCRIPT_CONTENT_FIELDS]).toContain(k);
    for (const k of ['notes', 'is_current', 'deleted_at', 'financial_context', 'author_notes']) expect(row).not.toHaveProperty(k);
  });

  test('when it fails too: no rows, and both failures are logged', async () => {
    mockQuery.mockRejectedValueOnce(missingColumn()).mockRejectedValueOnce(new Error('relation "episode_scripts" does not exist'));
    expect(await scriptsService.getScriptsByEpisode(EP)).toEqual([]);
    expect(Logger.error).toHaveBeenCalledWith('Error fetching scripts by episode:', {
      query: 'column "script_type" does not exist', fallback: 'relation "episode_scripts" does not exist',
    });
  });
});
