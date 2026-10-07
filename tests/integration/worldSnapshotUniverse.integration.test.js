/**
 * The script writers read world_state_snapshots WHERE show_id = :showId,
 * a column the table does not have, so every read failed and they wrote
 * with no world state. Evoni's ruling (2026-10-07): scope by universe. The
 * writers read the newest snapshot of the show's universe or of none, never
 * a temperature reading; a snapshot saved with a show_id is filed under that
 * show's universe (wiring map, docs/reads/2026-10-06-lalaverse-wiring-map.md,
 * fix-list item 17).
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { latestWorldSnapshotForShow } = require('../../src/services/worldSnapshotForShow');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('World snapshots by universe', () => {
  const uniA = uuid();
  const uniB = uuid();
  const show = uuid();
  const bare = uuid();
  const snaps = [];
  let token;

  // created_at in the future keeps these newest whatever else the test DB holds.
  async function snap(label, universe, days) {
    const id = uuid();
    snaps.push(id);
    await run(`INSERT INTO world_state_snapshots (id, universe_id, snapshot_label, world_facts, created_at, updated_at)
               VALUES (:id, :universe, :label, '["a fact"]'::jsonb, NOW() + (:days || ' days')::interval, NOW())`,
    { id, universe, label, days: String(days) });
    return id;
  }

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-snapshot-universe', email: 'test@snapshot-universe.dev', name: 'Snapshot Universe Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [id, name] of [[uniA, 'A'], [uniB, 'B']]) {
      await run(`INSERT INTO universes (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name: `Universe ${name} ${id.slice(0, 8)}`, slug: `uni-${id.slice(0, 8)}` });
    }
    await run(`INSERT INTO shows (id, name, slug, universe_id, created_at, updated_at) VALUES (:show, 'In A', :slug, :uniA, NOW(), NOW())`,
      { show, slug: `in-a-${show.slice(0, 8)}`, uniA });
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:bare, 'No universe', :slug, NOW(), NOW())`,
      { bare, slug: `bare-${bare.slice(0, 8)}` });
  });

  afterAll(async () => {
    await run('DELETE FROM world_state_snapshots WHERE id IN (:snaps) OR universe_id IN (:unis)', { snaps: snaps.length ? snaps : [uuid()], unis: [uniA, uniB] });
    await run('DELETE FROM shows WHERE id IN (:shows)', { shows: [show, bare] });
    await run('DELETE FROM universes WHERE id IN (:unis)', { unis: [uniA, uniB] });
  });

  it('reads the newest of its universe or of none; never another universe\'s, never a temperature reading', async () => {
    await snap('World, no universe', null, 1);
    const mine = await snap('Universe A after the Gala', uniA, 2);
    await snap('Universe B', uniB, 3);
    await snap('temperature_update', uniA, 4);

    expect((await latestWorldSnapshotForShow(sequelize, show)).id).toBe(mine);
  });

  it('a show with no universe reads the newest snapshot with none', async () => {
    const world = await snap('World, newest with none', null, 5);
    expect((await latestWorldSnapshotForShow(sequelize, bare)).id).toBe(world);
  });

  it('a snapshot saved with a show_id is filed under that show\'s universe; a bad show_id is a 400', async () => {
    const res = await request(app).post('/api/v1/world/state/snapshots')
      .set('Authorization', `Bearer ${token}`)
      .send({ snapshot_label: 'Saved on the State tab', show_id: show, world_facts: ['Velvet is in'] });
    expect(res.status).toBe(200);
    snaps.push(res.body.snapshot.id);
    const [row] = await q('SELECT universe_id FROM world_state_snapshots WHERE id = :id', { id: res.body.snapshot.id });
    expect(row.universe_id).toBe(uniA);

    const none = await request(app).post('/api/v1/world/state/snapshots')
      .set('Authorization', `Bearer ${token}`)
      .send({ snapshot_label: 'No show' });
    snaps.push(none.body.snapshot.id);
    const [noneRow] = await q('SELECT universe_id FROM world_state_snapshots WHERE id = :id', { id: none.body.snapshot.id });
    expect(noneRow.universe_id).toBeNull();

    const bad = await request(app).post('/api/v1/world/state/snapshots')
      .set('Authorization', `Bearer ${token}`)
      .send({ snapshot_label: 'Bad', show_id: 'show-b' });
    expect(bad.status).toBe(400);
  });
});
