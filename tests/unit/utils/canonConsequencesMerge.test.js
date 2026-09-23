// Task #1747 — PUT /world/:showId/events/:eventId used to replace the whole
// canon_consequences column with whatever the sender had, so the old event
// modal's 💾 Save could wipe an invitation the server wrote after the modal
// opened. The route now merges (mergeCanonConsequences) two levels deep:
// top-level keys and automation keys the sender omits survive; anything
// deeper is replaced whole; an explicit null deletes a key.
//
// Part 1 tests the pure helper. Part 2 drives the real route handler with
// models.sequelize mocked (no database) and captures the UPDATE's
// replacements to show the merged JSON is what gets written.

const { mergeCanonConsequences } = require('../../../src/utils/canonConsequencesMerge');

const STORED = {
  invitation_text: { headline: 'You are invited', body: 'Rooftop at nine' },
  feed_activity: [{ id: 'p1' }],
  automation: {
    host: 'Mara Vale',
    venue_name: 'The Glasshouse',
    social_tasks: [{ id: 't1' }],
    guest_profiles: [{ profile_id: 7, featured: true, story_role: 'rival' }],
  },
};

describe('mergeCanonConsequences (pure helper)', () => {
  test('a save that omits the automation block leaves the stored one intact', () => {
    const out = mergeCanonConsequences(STORED, { invitation_text: { headline: 'New' } });
    expect(out.automation).toEqual(STORED.automation);
  });

  test('a save that includes the automation block updates it (keys sent win, keys omitted survive)', () => {
    const out = mergeCanonConsequences(STORED, { automation: { host: 'Jun Park', event_date: '2026-10-01' } });
    expect(out.automation.host).toBe('Jun Park');
    expect(out.automation.event_date).toBe('2026-10-01');
    expect(out.automation.venue_name).toBe('The Glasshouse');
    expect(out.automation.social_tasks).toEqual([{ id: 't1' }]);
    expect(out.automation.guest_profiles).toEqual(STORED.automation.guest_profiles);
  });

  test('an invitation written between opening and saving survives when the sender never had one', () => {
    // What the old modal sends: its open-time copy (no invitation_text yet)
    // with automation re-spread and hydrated fields laid over it.
    const openedWith = { automation: { ...STORED.automation } };
    const sent = { ...openedWith, automation: { ...openedWith.automation, dress_code: 'Black tie' } };
    const out = mergeCanonConsequences(STORED, sent);
    expect(out.invitation_text).toEqual(STORED.invitation_text);
    expect(out.feed_activity).toEqual(STORED.feed_activity);
    expect(out.automation.dress_code).toBe('Black tie');
  });

  test('keys the sender does send still win, including a stale value (no merge can protect those)', () => {
    const staleInvite = { headline: 'Old headline' };
    const staleGuests = [{ profile_id: 7 }];
    const out = mergeCanonConsequences(STORED, {
      invitation_text: staleInvite,
      automation: { guest_profiles: staleGuests },
    });
    expect(out.invitation_text).toEqual(staleInvite);
    expect(out.automation.guest_profiles).toEqual(staleGuests);
  });

  test('values below automation are replaced whole, not merged (invitation_text object)', () => {
    const out = mergeCanonConsequences(STORED, { invitation_text: { headline: 'Only this' } });
    expect(out.invitation_text).toEqual({ headline: 'Only this' });
  });

  test('arrays are replaced, never concatenated', () => {
    const out = mergeCanonConsequences(STORED, {
      feed_activity: [{ id: 'p2' }],
      automation: { guest_profiles: [], social_tasks: [{ id: 't2' }] },
    });
    expect(out.feed_activity).toEqual([{ id: 'p2' }]);
    expect(out.automation.guest_profiles).toEqual([]);
    expect(out.automation.social_tasks).toEqual([{ id: 't2' }]);
  });

  test('deliberate removal: an explicit null deletes the key, at the top level and inside automation', () => {
    const out = mergeCanonConsequences(STORED, { invitation_text: null, automation: { venue_name: null } });
    expect(out).not.toHaveProperty('invitation_text');
    expect(out.automation).not.toHaveProperty('venue_name');
    expect(out.automation.host).toBe('Mara Vale');
  });

  test('deliberate removal: automation: null deletes the whole automation block', () => {
    const out = mergeCanonConsequences(STORED, { automation: null });
    expect(out).not.toHaveProperty('automation');
    expect(out.invitation_text).toEqual(STORED.invitation_text);
  });

  test('nothing stored (null, empty, or a JSON string) behaves sensibly', () => {
    expect(mergeCanonConsequences(null, { a: 1 })).toEqual({ a: 1 });
    expect(mergeCanonConsequences(undefined, { automation: { x: 1, y: null } })).toEqual({ automation: { x: 1 } });
    expect(mergeCanonConsequences(JSON.stringify({ a: 1, automation: { x: 1 } }), { automation: { y: 2 } }))
      .toEqual({ a: 1, automation: { x: 1, y: 2 } });
  });

  test('a non-object incoming value is returned unchanged (old replace behaviour)', () => {
    expect(mergeCanonConsequences(STORED, ['x'])).toEqual(['x']);
    expect(mergeCanonConsequences(STORED, 'text')).toBe('text');
  });

  test('does not mutate the stored or incoming objects', () => {
    const stored = JSON.parse(JSON.stringify(STORED));
    const incoming = { automation: { host: null } };
    mergeCanonConsequences(stored, incoming);
    expect(stored).toEqual(STORED);
    expect(incoming).toEqual({ automation: { host: null } });
  });
});

// ── Part 2: the route handler, models mocked ────────────────────────────

const mockQuery = jest.fn();
const mockTransaction = jest.fn(async (cb) => cb({ id: 'tx' }));

jest.mock('../../../src/models', () => ({
  sequelize: { query: (...a) => mockQuery(...a), transaction: (...a) => mockTransaction(...a) },
  SceneSet: { findByPk: jest.fn() },
}));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => next(),
  optionalAuth: (req, _res, next) => next(),
  authorize: () => (req, _res, next) => next(),
}));
jest.mock('../../../src/middleware/aiRateLimiter', () => ({
  aiRateLimiter: (req, _res, next) => next(),
}));

const express = require('express');
const request = require('supertest');

describe('PUT /world/:showId/events/:eventId writes the merged canon_consequences', () => {
  let app;
  let stored;
  let writes;

  beforeAll(() => {
    const router = require('../../../src/routes/worldEvents');
    app = express();
    app.use('/api/v1', router);
  });

  beforeEach(() => {
    stored = JSON.parse(JSON.stringify(STORED));
    writes = [];
    mockQuery.mockReset();
    mockTransaction.mockClear();
    mockQuery.mockImplementation(async (sql, opts = {}) => {
      if (/^SELECT canon_consequences FROM world_events/.test(sql)) {
        return [[{ canon_consequences: stored }]];
      }
      if (/^UPDATE world_events/.test(sql)) {
        writes.push({ sql, replacements: { ...opts.replacements }, transaction: opts.transaction });
        return [[], 1];
      }
      if (/^SELECT \* FROM world_events/.test(sql)) return [[{ id: 'e1' }]];
      throw new Error(`unexpected SQL: ${sql}`);
    });
  });

  test('the old modal Save shape (no invitation_text, stale automation) keeps the stored invitation', async () => {
    const res = await request(app)
      .put('/api/v1/world/s1/events/e1')
      .send({ name: 'Gala', canon_consequences: { automation: { host: 'Mara Vale', dress_code: 'Black tie' } } });

    expect(res.status).toBe(200);
    expect(writes).toHaveLength(1);
    const written = JSON.parse(writes[0].replacements.canon_consequences);
    expect(written.invitation_text).toEqual(STORED.invitation_text);
    expect(written.automation.dress_code).toBe('Black tie');
    expect(written.automation.social_tasks).toEqual(STORED.automation.social_tasks);
    expect(written.automation.guest_profiles).toEqual(STORED.automation.guest_profiles);
    expect(writes[0].replacements.name).toBe('Gala');
  });

  test('the read is locked and in the same transaction as the write', async () => {
    await request(app).put('/api/v1/world/s1/events/e1').send({ canon_consequences: { a: 1 } });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const select = mockQuery.mock.calls.find(([sql]) => /^SELECT canon_consequences/.test(sql));
    expect(select[0]).toMatch(/FOR UPDATE$/);
    expect(select[1].transaction).toEqual({ id: 'tx' });
    expect(writes[0].transaction).toEqual({ id: 'tx' });
  });

  test('a save that does not send canon_consequences neither reads nor writes it', async () => {
    await request(app).put('/api/v1/world/s1/events/e1').send({ name: 'Gala' });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(writes[0].sql).not.toMatch(/canon_consequences/);
  });

  test('canon_consequences: null still clears the column (unchanged)', async () => {
    await request(app).put('/api/v1/world/s1/events/e1').send({ canon_consequences: null });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(writes[0].replacements.canon_consequences).toBeNull();
  });

  test('the core-only retry after a missing-column error writes the merged value too', async () => {
    let first = true;
    mockQuery.mockImplementation(async (sql, opts = {}) => {
      if (/^SELECT canon_consequences FROM world_events/.test(sql)) return [[{ canon_consequences: stored }]];
      if (/^UPDATE world_events/.test(sql)) {
        if (first) { first = false; throw new Error('column "theme" of relation "world_events" does not exist'); }
        writes.push({ sql, replacements: { ...opts.replacements } });
        return [[], 1];
      }
      if (/^SELECT \* FROM world_events/.test(sql)) return [[{ id: 'e1' }]];
      throw new Error(`unexpected SQL: ${sql}`);
    });

    const res = await request(app)
      .put('/api/v1/world/s1/events/e1')
      .send({ name: 'Gala', theme: 'noir', canon_consequences: { automation: { dress_code: 'Black tie' } } });

    expect(res.status).toBe(200);
    const retry = writes.find(w => /canon_consequences = :canon_consequences/.test(w.sql));
    expect(retry.sql).not.toMatch(/theme/);
    const written = JSON.parse(retry.replacements.canon_consequences);
    expect(written.invitation_text).toEqual(STORED.invitation_text);
    expect(written.automation.host).toBe('Mara Vale');
    expect(written.automation.dress_code).toBe('Black tie');
  });
});
