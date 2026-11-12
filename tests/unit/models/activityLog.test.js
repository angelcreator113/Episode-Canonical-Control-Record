/**
 * ActivityLog: the one audit writer (issue #1948; Evoni, 2026-11-11). The
 * model itself, with no database: what an entry becomes, what is refused, and
 * what reaches ActivityLog.create. tests/integration/activityLog… writes real
 * rows.
 */
const { Sequelize } = require('sequelize');
const defineActivityLog = require('../../../src/models/ActivityLog');

const sequelize = new Sequelize('postgres://user:pass@127.0.0.1:1/none', { logging: false });
const ActivityLog = defineActivityLog(sequelize);
const UUID = '0b0f6a1e-6f0e-4f0e-9d53-3d5f3b9d7c11';

afterEach(() => jest.restoreAllMocks());

describe('the model is the table production has', () => {
  test('six columns besides id, all nullable, with production\'s names', () => {
    const fields = Object.fromEntries(Object.entries(ActivityLog.rawAttributes).map(([k, a]) => [k, a.field]));
    expect(fields).toEqual({
      id: 'id', userId: 'user_id', action: 'action', resourceType: 'resource_type', resourceId: 'resource_id',
      changes: 'changes', createdAt: 'created_at',
    });
    for (const name of ['userId', 'action', 'resourceType', 'resourceId', 'changes', 'createdAt']) {
      expect(ActivityLog.rawAttributes[name].allowNull).toBe(true);
    }
    expect(ActivityLog.tableName).toBe('activity_logs');
    expect(ActivityLog.options.timestamps).toBe(false);
  });

  test('nothing about IP addresses, user agents, old or new value columns, or enums', () => {
    const names = Object.values(ActivityLog.rawAttributes).map((a) => a.field);
    for (const gone of ['ip_address', 'user_agent', 'old_values', 'new_values', 'action_type', 'timestamp']) {
      expect(names).not.toContain(gone);
    }
    expect(Object.values(ActivityLog.rawAttributes).some((a) => a.type.key === 'ENUM')).toBe(false);
  });
});

describe('normalizeEntry: what an entry becomes', () => {
  const n = ActivityLog.normalizeEntry;

  test('a UUID resource id is kept as text; action and resource type are lower-cased', () => {
    expect(n({ userId: 'user-1', action: 'EDIT', resourceType: 'Episode', resourceId: UUID, changes: { before: { a: 1 }, after: { a: 2 } } }))
      .toEqual({ userId: 'user-1', action: 'edit', resourceType: 'episode', resourceId: UUID, changes: { before: { a: 1 }, after: { a: 2 } } });
    expect(n({ action: 'create', resourceType: 'job', resourceId: 42 }).resourceId).toBe('42');
  });

  test.each([undefined, null, '', 'anonymous', 'Anonymous', 'unknown', 'system'])('user id %p is stored as NULL, never as a placeholder', (userId) => {
    expect(n({ userId, action: 'create', resourceType: 'file', resourceId: UUID }).userId).toBeNull();
  });

  test('no resource id and no changes are NULL', () => {
    expect(n({ userId: 'u', action: 'delete', resourceType: 'metadata' })).toMatchObject({ resourceId: null, changes: null });
    expect(n({ userId: 'u', action: 'delete', resourceType: 'metadata', changes: {} }).changes).toBeNull();
  });

  test.each([
    [undefined, /takes one object/],
    ['user-1', /takes one object/],
    [{ resourceType: 'episode' }, /action is required/],
    [{ action: 'edit' }, /resourceType is required/],
    [{ action: 'edit', resourceType: 'episode', changes: 'title' }, /changes is an object or null/],
    [{ action: 'edit', resourceType: 'episode', changes: [1] }, /changes is an object or null/],
  ])('refuses %j', (entry, message) => {
    expect(() => n(entry)).toThrow(message);
  });

  test('a page view is refused: views are not audited', () => {
    expect(() => n({ userId: 'u', action: 'view', resourceType: 'episode', resourceId: UUID })).toThrow(/page views are not audited/);
    expect(() => n({ userId: 'u', action: 'VIEW', resourceType: 'episode' })).toThrow(/page views are not audited/);
  });
});

describe('logActivity: one insert, the caller\'s transaction, and no swallowed failure', () => {
  const entry = { userId: 'user-1', action: 'edit', resourceType: 'episode', resourceId: UUID, changes: { after: { title: 'x' } } };

  test('writes exactly the five columns; created_at is left to the database', async () => {
    const create = jest.spyOn(ActivityLog, 'create').mockResolvedValue({ id: 7 });
    await expect(ActivityLog.logActivity(entry)).resolves.toEqual({ id: 7 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      { userId: 'user-1', action: 'edit', resourceType: 'episode', resourceId: UUID, changes: { after: { title: 'x' } } },
      { fields: ['userId', 'action', 'resourceType', 'resourceId', 'changes'] });
  });

  test('passes the caller\'s transaction through', async () => {
    const create = jest.spyOn(ActivityLog, 'create').mockResolvedValue({ id: 8 });
    const transaction = { id: 'tx' };
    await ActivityLog.logActivity(entry, { transaction });
    expect(create.mock.calls[0][1]).toEqual({ fields: ['userId', 'action', 'resourceType', 'resourceId', 'changes'], transaction });
  });

  test('a database failure rejects: the writer never hides it', async () => {
    jest.spyOn(ActivityLog, 'create').mockRejectedValue(new Error('column "userId" does not exist'));
    await expect(ActivityLog.logActivity(entry)).rejects.toThrow('column "userId" does not exist');
  });

  test('a bad entry rejects before anything is sent', async () => {
    const create = jest.spyOn(ActivityLog, 'create').mockResolvedValue({});
    await expect(ActivityLog.logActivity({ action: 'view', resourceType: 'episode' })).rejects.toThrow(/page views/);
    await expect(ActivityLog.logActivity('user-1', 'edit', 'episode', UUID)).rejects.toThrow(/takes one object/);
    expect(create).not.toHaveBeenCalled();
  });
});
