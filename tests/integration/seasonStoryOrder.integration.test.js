/**
 * The season's story order read from the database (services/seasonStoryOrder;
 * Lala's Phone phase 7 ruling G1, PR 0): arcs, weekly slots, a bonus and a
 * two-parter in season_specials, an unslotted episode. Read only: the test
 * checks nothing is written. Against the test database.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { seasonStoryOrder, precedingEpisodes } = require('../../src/services/seasonStoryOrder');

const { sequelize } = models;
const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL?.includes('amazonaws.com') || !process.env.DATABASE_URL?.includes('episode_metadata_test');
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('seasonStoryOrder against the database', () => {
  const show = uuid();
  const arc = uuid();
  const ep = { w1: uuid(), w2: uuid(), bonus: uuid(), p1: uuid(), p2: uuid(), free: uuid() };
  const slot = { s1: uuid(), s2: uuid(), s3: uuid(), s4: uuid() };

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Order ${show.slice(0, 8)}`, slug: `order-${show.slice(0, 8)}` });
    await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end, created_at, updated_at)
               VALUES (:arc, :show, 1, 'Season one', 1, 1, 24, NOW(), NOW())`, { arc, show });
    // episode_number deliberately out of story order: the bonus is 40, the free one 2.
    const eps = [[ep.w1, 1, 'accepted'], [ep.w2, 2, 'accepted'], [ep.bonus, 40, 'accepted'], [ep.p1, 3, 'accepted'], [ep.p2, 4, null], [ep.free, 5, 'accepted']];
    for (const [id, n, st] of eps) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
                 VALUES (:id, :show, :t, :n, 'draft', :st, NOW(), NOW())`, { id, show, t: `Ep ${n}`, n, st });
    }
    const slots = [[slot.s1, 1, ep.w1], [slot.s2, 2, ep.w2], [slot.s3, 3, ep.p1], [slot.s4, 4, ep.p2]];
    for (const [id, n, e] of slots) {
      await run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, created_at, updated_at)
                 VALUES (:id, :show, :arc, 1, :n, 1, :e, NOW(), NOW())`, { id, show, arc, n, e });
    }
    await run(`INSERT INTO season_specials (id, show_id, arc_id, kind, after_slot_number, episode_id, created_at, updated_at)
               VALUES (:id, :show, :arc, 'bonus', 1, :e, NOW(), NOW())`, { id: uuid(), show, arc, e: ep.bonus });
    await run(`INSERT INTO season_specials (id, show_id, arc_id, kind, part_one_slot_id, part_two_slot_id, created_at, updated_at)
               VALUES (:id, :show, :arc, 'two_part', :p1, :p2, NOW(), NOW())`, { id: uuid(), show, arc, p1: slot.s3, p2: slot.s4 });
  });

  afterAll(async () => {
    await run('DELETE FROM season_specials WHERE show_id = :show', { show });
    await run('DELETE FROM season_slots WHERE show_id = :show', { show });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
  });

  it('orders by slot with the bonus after its slot and the two-parter in its slots; the unslotted one apart', async () => {
    const before = (await q('SELECT updated_at FROM episodes WHERE show_id = :show ORDER BY id', { show })).map((r) => String(r.updated_at));
    const order = await seasonStoryOrder(sequelize, show);
    expect(order.entries.map((e) => [e.episode_id, e.kind, e.part, e.continuity])).toEqual([
      [ep.w1, 'weekly', null, 'canonical'],
      [ep.bonus, 'bonus', null, 'needs_review'],
      [ep.w2, 'weekly', null, 'canonical'],
      [ep.p1, 'two_part', 1, 'canonical'],
      [ep.p2, 'two_part', 2, 'canonical'],
    ]);
    expect(order.unslotted.map((u) => u.episode_id)).toEqual([ep.free]);
    expect(order.issues.map((i) => i.code).sort()).toEqual(['continuity_needs_review', 'unslotted']);
    // Read only: nothing was written.
    const after = (await q('SELECT updated_at FROM episodes WHERE show_id = :show ORDER BY id', { show })).map((r) => String(r.updated_at));
    expect(after).toEqual(before);
  });

  it('Part 2 carries from the accepted canonical episodes before it; the bonus needs review; a draft preview adds nothing more here', async () => {
    const order = await seasonStoryOrder(sequelize, show);
    const carry = precedingEpisodes(order, ep.p2);
    expect(carry.episodes.map((e) => e.episode_id)).toEqual([ep.w1, ep.w2, ep.p1]);
    expect(carry.excluded).toEqual([{ episode_id: ep.bonus, position: 2, reason: 'needs_review' }]);
    expect(precedingEpisodes(order, ep.p2, { includeUnaccepted: true }).episodes.map((e) => e.episode_id)).toEqual([ep.w1, ep.w2, ep.p1]);
  });
});
