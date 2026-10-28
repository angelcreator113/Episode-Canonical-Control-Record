/**
 * episode_raw_clips.end_beat_number on Postgres (Evoni, 2026-10-28: "show
 * where a video starts and ends"). Migration 20261028120000 down, the app
 * as it is before the update runs (clips list without the field, a PATCH of
 * it is a plain 409, a scene link still works), then up twice, the field
 * kept and checked, the 1-14 check in the database, and down twice. The
 * column is left as the test found it.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const clips = require('../../src/services/rawClipsService');
const migration = require('../../src/migrations/20261028120000-add-episode-raw-clips-end-beat-number');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const qi = () => sequelize.getQueryInterface();
const hasColumn = async () => (await run(`SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'episode_raw_clips' AND column_name = 'end_beat_number'`))[0].length > 0;

(shouldSkip ? describe.skip : describe)('episode_raw_clips.end_beat_number (Postgres)', () => {
  const show = uuid();
  const ep = uuid();
  let hadColumn = false;

  beforeAll(async () => {
    hadColumn = await hasColumn();
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())', { id: show, n: `endbeat-${show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
      VALUES (:ep, :show, 'End beat', 9101, 'draft', NOW(), NOW())`, { ep, show });
  });

  afterAll(async () => {
    await run('DELETE FROM episode_raw_clips WHERE episode_id = :ep', { ep });
    await run('DELETE FROM episodes WHERE id = :ep', { ep });
    await run('DELETE FROM shows WHERE id = :show', { show });
    if (hadColumn) await migration.up(qi(), sequelize.constructor);
    else await migration.down(qi());
    await sequelize.close();
  });

  const newClip = (beat = 1) => clips.createClip(sequelize, {
    id: uuid(), episode_id: ep, show_id: show, performer: 'lala', label: 'phone.mp4', beat_number: beat, s3_key_raw: `k/${uuid()}`,
  });

  test('before the update: the clip lists without it, a PATCH of it is a plain 409, a scene link still works', async () => {
    await migration.down(qi());
    expect(await hasColumn()).toBe(false);
    const clip = await newClip(1);
    expect(clip).not.toHaveProperty('end_beat_number');
    const listed = (await clips.listClips(sequelize, ep)).find((c) => c.id === clip.id);
    expect(listed).not.toHaveProperty('end_beat_number');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(clips.updateClip(sequelize, ep, clip.id, { end_beat_number: 11 })).rejects.toMatchObject({ status: 409, message: clips.END_BEAT_MISSING });
    await expect(clips.updateClip(sequelize, ep, clip.id, { beat_number: 2, end_beat_number: 11 })).rejects.toMatchObject({ status: 409, message: clips.END_BEAT_MISSING });
    console.error.mockRestore();
    const linked = await clips.updateClip(sequelize, ep, clip.id, { beat_number: 3 });
    expect(linked).toMatchObject({ id: clip.id, beat_number: 3 });
    expect(linked).not.toHaveProperty('end_beat_number');
  });

  test('up twice: one nullable integer column with its 1-14 check; the field is kept and checked', async () => {
    await migration.up(qi(), sequelize.constructor);
    await migration.up(qi(), sequelize.constructor);
    const [[col]] = await run(`SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'episode_raw_clips' AND column_name = 'end_beat_number'`);
    expect(col).toEqual({ data_type: 'integer', is_nullable: 'YES' });
    const [checks] = await run("SELECT conname FROM pg_constraint WHERE conname = 'episode_raw_clips_end_beat_number_range'");
    expect(checks).toHaveLength(1);

    const clip = await newClip(1);
    expect(clip.end_beat_number).toBeNull();
    const ranged = await clips.updateClip(sequelize, ep, clip.id, { end_beat_number: 11 });
    expect(ranged).toMatchObject({ beat_number: 1, end_beat_number: 11 });
    expect((await clips.listClips(sequelize, ep)).find((c) => c.id === clip.id).end_beat_number).toBe(11);
    await expect(clips.updateClip(sequelize, ep, clip.id, { beat_number: 5, end_beat_number: 3 })).rejects.toMatchObject({ status: 400 });
    // Moving the start past the end makes it one beat again.
    expect(await clips.updateClip(sequelize, ep, clip.id, { beat_number: 12 })).toMatchObject({ beat_number: 12, end_beat_number: null });
    // An upload's end beat, kept after the row is made.
    const up = await newClip(11);
    expect(await clips.storeTakeExtras(sequelize, ep, up.id, { end_beat_number: 14 })).toMatchObject({ stored: ['end_beat_number'], notStored: [] });
    // The database refuses a beat outside 1-14 even past the service.
    await expect(run('UPDATE episode_raw_clips SET end_beat_number = 15 WHERE id = :id', { id: up.id })).rejects.toThrow(/episode_raw_clips_end_beat_number_range/);
  });

  test('down twice removes the column and its check', async () => {
    await migration.down(qi());
    await migration.down(qi());
    expect(await hasColumn()).toBe(false);
    const [checks] = await run("SELECT conname FROM pg_constraint WHERE conname = 'episode_raw_clips_end_beat_number_range'");
    expect(checks).toHaveLength(0);
    const rows = await clips.listClips(sequelize, ep);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect(r).not.toHaveProperty('end_beat_number'));
  });
});
