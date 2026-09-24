/**
 * Task #1814 (slice 1a) — the model side of the event terms:
 * WorldEvent declares restrictions and opportunity_id (and CURRENT_ATTRIBUTES
 * carries both); EventDeliverable matches migration
 * 20260924000000-add-event-terms.js and is registered in models/index.js.
 * No database: .define() never opens a connection.
 */
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const ROOT = path.join(__dirname, '..', '..', '..');
const sequelize = new Sequelize('postgres://unused:unused@localhost:1/unused', { logging: false });
const WorldEvent = require(path.join(ROOT, 'src', 'models', 'WorldEvent.js'))(sequelize);
const EventDeliverable = require(path.join(ROOT, 'src', 'models', 'EventDeliverable.js'))(sequelize);

describe('WorldEvent — restrictions and opportunity_id', () => {
  test('restrictions is JSONB, nullable, default []', () => {
    const attr = WorldEvent.rawAttributes.restrictions;
    expect(attr.type.constructor.name).toBe('JSONB');
    expect(attr.allowNull).toBe(true);
    expect(attr.defaultValue).toEqual([]);
  });

  test('opportunity_id is a nullable UUID', () => {
    const attr = WorldEvent.rawAttributes.opportunity_id;
    expect(attr.type.constructor.name).toBe('UUID');
    expect(attr.allowNull).toBe(true);
  });

  test('requirements is unchanged: JSONB object, default {}', () => {
    expect(WorldEvent.rawAttributes.requirements.defaultValue).toEqual({});
  });

  test('CURRENT_ATTRIBUTES carries both; category/format still excluded', () => {
    expect(WorldEvent.CURRENT_ATTRIBUTES).toEqual(expect.arrayContaining(['restrictions', 'opportunity_id', 'requirements']));
    expect(WorldEvent.CURRENT_ATTRIBUTES).not.toContain('category');
    expect(WorldEvent.CURRENT_ATTRIBUTES).not.toContain('format');
  });
});

describe('EventDeliverable', () => {
  test('table, paranoid, underscored', () => {
    expect(EventDeliverable.getTableName()).toBe('event_deliverables');
    expect(EventDeliverable.options.paranoid).toBe(true);
    expect(EventDeliverable.options.underscored).toBe(true);
    expect(EventDeliverable.rawAttributes.deleted_at).toBeDefined();
  });

  test('columns match the migration', () => {
    const a = EventDeliverable.rawAttributes;
    expect(a.id.type.constructor.name).toBe('UUID');
    expect(a.event_id.allowNull).toBe(false);
    expect(a.description.allowNull).toBe(false);
    expect(a.required.defaultValue).toBe(true);
    expect(a.status.defaultValue).toBe('pending');
    for (const col of ['deliverable_type', 'due_date', 'completed_at', 'submitted_at', 'approved_at', 'episode_id']) {
      expect(a[col]).toBeDefined();
      expect(a[col].allowNull).toBe(true);
    }
    const migration = fs.readFileSync(path.join(ROOT, 'src', 'migrations', '20260924000000-add-event-terms.js'), 'utf8');
    for (const col of Object.keys(a)) expect(migration).toMatch(new RegExp(`\\b${col}\\b`));
  });

  test('status accepts the four lifecycle values only', async () => {
    expect(EventDeliverable.STATUSES).toEqual(['pending', 'completed', 'submitted', 'approved']);
    const ok = EventDeliverable.build({ event_id: '00000000-0000-0000-0000-000000000001', description: 'x', status: 'submitted' });
    await expect(ok.validate()).resolves.toBeTruthy();
    const bad = EventDeliverable.build({ event_id: '00000000-0000-0000-0000-000000000001', description: 'x', status: 'paid' });
    await expect(bad.validate()).rejects.toThrow();
  });

  test('registered in models/index.js with its associations', () => {
    const index = fs.readFileSync(path.join(ROOT, 'src', 'models', 'index.js'), 'utf8');
    expect(index).toMatch(/EventDeliverable = require\('\.\/EventDeliverable'\)\(sequelize\);/);
    expect(index).toMatch(/EventDeliverable\.associate\(requiredModels\);/);
    expect(index).toMatch(/module\.exports\.EventDeliverable = EventDeliverable;/);
  });
});

describe('migration 20260924000000-add-event-terms', () => {
  const migration = require(path.join(ROOT, 'src', 'migrations', '20260924000000-add-event-terms.js'));
  const DataTypes = require('sequelize').DataTypes;

  function fakeQI({ hasColumn = false, hasTable = false } = {}) {
    const calls = [];
    return {
      calls,
      describeTable: jest.fn(async () => (hasColumn ? { restrictions: {} } : { id: {} })),
      showAllTables: jest.fn(async () => (hasTable ? ['world_events', 'event_deliverables'] : ['world_events'])),
      addColumn: jest.fn(async (...a) => calls.push(['addColumn', ...a])),
      removeColumn: jest.fn(async (...a) => calls.push(['removeColumn', ...a])),
      createTable: jest.fn(async (...a) => calls.push(['createTable', ...a])),
      dropTable: jest.fn(async (...a) => calls.push(['dropTable', ...a])),
      addIndex: jest.fn(async (...a) => calls.push(['addIndex', ...a])),
    };
  }

  test('up adds restrictions and creates event_deliverables with deleted_at and two indexes', async () => {
    const qi = fakeQI();
    await migration.up(qi, { ...DataTypes, NOW: DataTypes.NOW, UUIDV4: DataTypes.UUIDV4 });
    expect(qi.calls.map((c) => c[0])).toEqual(['addColumn', 'createTable', 'addIndex', 'addIndex']);
    expect(qi.calls[0].slice(1, 3)).toEqual(['world_events', 'restrictions']);
    const [, table, cols] = qi.calls[1];
    expect(table).toBe('event_deliverables');
    expect(cols.deleted_at).toBeDefined();
    expect(cols.event_id.references).toEqual({ model: 'world_events', key: 'id' });
    expect(qi.calls[2][2]).toEqual(['event_id']);
    expect(qi.calls[3][2]).toEqual(['episode_id']);
  });

  test('up is a no-op when both already exist (describeTable/showAllTables guards)', async () => {
    const qi = fakeQI({ hasColumn: true, hasTable: true });
    await migration.up(qi, DataTypes);
    expect(qi.calls).toEqual([]);
  });

  test('down is symmetric', async () => {
    const qi = fakeQI({ hasColumn: true, hasTable: true });
    await migration.down(qi, DataTypes);
    expect(qi.calls).toEqual([['dropTable', 'event_deliverables'], ['removeColumn', 'world_events', 'restrictions']]);
  });
});
