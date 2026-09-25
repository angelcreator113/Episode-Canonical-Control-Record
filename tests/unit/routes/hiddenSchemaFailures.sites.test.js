/**
 * Task #1883 (#1870 step 2) — the hidden schema failures, one test per site,
 * each driven through its real call site.
 *
 * Every site below ran a query naming something its model does not declare
 * (docs/SCHEMA_AGREEMENT_READ.md §1.1) and hid the failure: it logged and
 * carried on with a fallback, or swallowed the error. The models here are
 * schema-checked fakes (tests/unit/helpers/schemaCheckedModel.js), which throw
 * "column … does not exist" exactly where production does, so on origin/main
 * every test here fails: the fallback is what comes back. With the site fixed,
 * the real value comes back, or the site fails loudly.
 *
 * Include aliases are checked against the associations src/models/index.js
 * actually registers (loaded, never connected), since the fake does not
 * check includes.
 *
 * Mocked models, no database.
 */
const express = require('express');
const request = require('supertest');

const MODELS = '../../../src/models';
const AUTH = '../../../src/middleware/auth';
const RATE = '../../../src/middleware/aiRateLimiter';

function passAuth() {
  jest.doMock(AUTH, () => {
    const actual = jest.requireActual(AUTH);
    return {
      ...actual,
      requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
      optionalAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
    };
  });
  jest.doMock(RATE, () => ({ aiRateLimiter: (_q, _s, next) => next() }));
}

function schemaChecked(name, impls) {
  return require('../helpers/schemaCheckedModel').schemaCheckedModel(name, impls);
}

// The include aliases production registers for a model: the real
// src/models/index.js, loaded once and never connected.
let realModels;
function registeredAliases(modelName) {
  if (!realModels) {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    realModels = jest.requireActual(MODELS);
    log.mockRestore();
    warn.mockRestore();
  }
  return new Set(Object.keys(realModels[modelName].associations));
}

/** Throw as Sequelize does when an include names an alias that is not associated. */
function assertIncludesAssociated(modelName, opts = {}) {
  const aliases = registeredAliases(modelName);
  for (const inc of [].concat(opts.include || [])) {
    if (inc && inc.as && !aliases.has(inc.as)) {
      throw new Error(`SequelizeEagerLoadingError: ${inc.as} is not associated to ${modelName}!`);
    }
  }
}

// engine.js starts a module-level cleanup interval on load; hold it on the
// fake clock so the suite can exit (as storyEngineArcSaved.test.js does).
function requireEngine() {
  jest.useFakeTimers();
  try {
    return require('../../../src/routes/memories/engine');
  } finally {
    jest.useRealTimers();
  }
}

function mockAnthropic(create) {
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
}

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ── 1. sceneProposeRoute /arc-stage (Evoni's priority) ──────────────────────
describe('POST /arc-stage (src/routes/sceneProposeRoute.js calculateArcStage)', () => {
  test('never stores the establishment fallback of a stage it cannot compute', async () => {
    const StorytellerBook = schemaChecked('StorytellerBook');
    jest.doMock(MODELS, () => ({
      StorytellerStory: schemaChecked('StorytellerStory', { findAll: async () => [] }),
      StorytellerBook,
    }));
    mockAnthropic(jest.fn());
    passAuth();

    const app = express();
    app.use(express.json());
    app.use('/', require('../../../src/routes/sceneProposeRoute'));

    const res = await request(app).post('/arc-stage').send({ book_id: 'book-1' });
    expect(StorytellerBook.update).not.toHaveBeenCalled();
    expect(res.status).toBe(501);
    expect(res.body.error).toMatch(/cannot be computed/);
    expect(res.body.stage).toBeUndefined();
  });
});

// ── 2. metadataController.listMetadata ──────────────────────────────────────
describe('GET /metadata (src/controllers/metadataController.js listMetadata)', () => {
  test('a failed list is a 500, not an empty 200 with a warning', async () => {
    const MetadataStorage = schemaChecked('MetadataStorage', {
      // MetadataStorage's camelCase attributes have no field mapping onto
      // metadata_storage's snake_case columns, so the query still fails in
      // production; the site must say so.
      findAndCountAll: async () => { throw new Error('column "extractedText" does not exist'); },
    });
    jest.doMock(MODELS, () => ({ models: { MetadataStorage, Episode: {} } }));
    jest.doMock('../../../src/middleware/auditLog', () => ({ logger: { logAction: jest.fn() } }));

    const controller = require('../../../src/controllers/metadataController');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await controller.listMetadata({ query: {}, ip: '::1', get: () => 'ua' }, res);

    // The query itself names only declared attributes now.
    expect(MetadataStorage.findAndCountAll).toHaveBeenCalledTimes(1);
    expect(MetadataStorage.findAndCountAll.mock.calls[0][0].order).toEqual([['id', 'DESC']]);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].warning).toBeUndefined();
  });
});

// ── 3–5. amberDiagnosticRoutes runDiagnosticScan ────────────────────────────
describe('runDiagnosticScan (src/routes/amberDiagnosticRoutes.js)', () => {
  async function scan({ FranchiseKnowledge, StorytellerMemory, RegistryCharacter }) {
    const AmberFinding = { findAll: jest.fn(async () => []), create: jest.fn(async (v) => v) };
    jest.doMock(MODELS, () => ({
      FranchiseKnowledge: FranchiseKnowledge || { findAll: async () => [] },
      StorytellerMemory: StorytellerMemory || { count: async () => 0 },
      RegistryCharacter: RegistryCharacter || { findAll: async () => [] },
      StorytellerLine: { findOne: async () => null },
      AmberScanRun: { create: async () => ({ update: async () => {} }) },
      AmberFinding,
    }));
    mockAnthropic(jest.fn());
    passAuth();
    jest.spyOn(global, 'fetch').mockResolvedValue({ status: 200 });
    await require('../../../src/routes/amberDiagnosticRoutes').runDiagnosticScan('test');
    return AmberFinding.create.mock.calls.map(([f]) => f);
  }

  test('checkDuplicateBrainEntries reads source_document and finds the duplicate', async () => {
    const checked = schemaChecked('FranchiseKnowledge', {
      findAll: async () => [{ id: 'k1', title: 'Rule' }, { id: 'k2', title: 'rule ' }],
    });
    // franchise_knowledge has deleted_at in production but the model does
    // not declare it (report-only drift, not this site); let it through.
    const FranchiseKnowledge = {
      findAll: jest.fn(async ({ where: { deleted_at: _d, ...where } = {}, ...opts }) => checked.findAll({ ...opts, where })),
    };
    const findings = await scan({ FranchiseKnowledge });
    expect(findings.map(f => f.type)).toContain('duplicate_brain_entry');
  });

  test('checkUnapprovedMemories counts unconfirmed memories', async () => {
    const StorytellerMemory = schemaChecked('StorytellerMemory', { count: async () => 3 });
    const findings = await scan({ StorytellerMemory });
    expect(StorytellerMemory.count.mock.calls[0][0].where.confirmed).toBe(false);
    expect(findings.map(f => f.type)).toContain('unapproved_memory');
  });

  test('checkCharactersStuckInDraft reads display_name', async () => {
    const RegistryCharacter = schemaChecked('RegistryCharacter', {
      findAll: async () => [{ id: 'c1', display_name: 'Marcus', updatedAt: new Date(0) }],
    });
    const findings = await scan({ RegistryCharacter });
    const stuck = findings.find(f => /stuck in draft/.test(f.title));
    expect(stuck).toBeDefined();
    expect(stuck.description).toContain('Marcus');
  });
});

// ── 6–8. amberSessionRoutes readSystemState ─────────────────────────────────
describe('GET /status (src/routes/amberSessionRoutes.js readSystemState)', () => {
  test('approved lines are read by text and pending memories by confirmed', async () => {
    const StorytellerLine = schemaChecked('StorytellerLine', {
      findOne: async () => null,
      count: async () => 0,
      findAll: async () => [{ text: 'one two three', updatedAt: new Date(0) }],
    });
    const StorytellerMemory = schemaChecked('StorytellerMemory', { count: async () => 2 });
    jest.doMock(MODELS, () => ({
      StorytellerLine,
      StorytellerMemory,
      RegistryCharacter: { count: async () => 0 },
      sequelize: { query: async () => [{ count: 0 }], QueryTypes: { SELECT: 'SELECT' } },
    }));
    mockAnthropic(jest.fn());
    passAuth();

    const app = express();
    app.use(express.json());
    app.use('/', require('../../../src/routes/amberSessionRoutes'));

    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.novelWordCount).toBe(3);
    expect(res.body.recentActivity).toEqual([{ excerpt: 'one two three', date: new Date(0).toISOString() }]);
    expect(res.body.pendingMemories).toBe(2);
  });
});

// ── 9. characterAI gatherCharacterContext relationships ─────────────────────
describe('POST /write-scene (src/routes/characterAI.js gatherCharacterContext)', () => {
  test('relationships are matched by character id and reach the prompt', async () => {
    const people = {
      c1: { id: 'c1', selected_name: 'JustAWoman', display_name: 'JustAWoman', registry_id: 'r1' },
      c2: { id: 'c2', selected_name: 'David', display_name: 'David' },
    };
    const RegistryCharacter = {
      findByPk: jest.fn(async () => ({ ...people.c1, registry: null })),
      findAll: jest.fn(async ({ where }) => (Array.isArray(where.id) ? where.id.map(id => people[id]) : [])),
    };
    const CharacterRelationship = schemaChecked('CharacterRelationship', {
      findAll: async () => [{ character_id_a: 'c1', character_id_b: 'c2', relationship_type: 'spouse' }],
    });
    jest.doMock(MODELS, () => ({
      RegistryCharacter,
      CharacterRegistry: {},
      CharacterRelationship,
      StorytellerMemory: { findAll: async () => [] },
      StorytellerLine: { findAll: async () => [] },
      StorytellerBook: { findOne: async () => null },
      CharacterTherapyProfile: { findOne: async () => null },
    }));
    const create = jest.fn(async () => ({ content: [{ text: 'prose' }] }));
    mockAnthropic(create);
    passAuth();

    const app = express();
    app.use(express.json());
    app.use('/', require('../../../src/routes/characterAI'));

    const res = await request(app).post('/write-scene').send({ character_id: 'c1' });
    expect(res.status).toBe(200);
    expect(res.body.context_used.relationships).toBe(1);
    const system = create.mock.calls[0][0].system[0].text;
    expect(system).toContain('═══ RELATIONSHIPS ═══');
    expect(system).toContain('David:');
    expect(system).toContain('Type: spouse');
  });
});

// ── 10. memories/engine.js /generate-relationship-web ───────────────────────
describe('POST /generate-relationship-web (src/routes/memories/engine.js)', () => {
  test('orders by the chapter\'s declared sort_order and reaches Claude', async () => {
    const chapterDeclared = schemaChecked('StorytellerChapter').DECLARED;
    const StorytellerChapter = schemaChecked('StorytellerChapter');
    const checked = schemaChecked('StorytellerLine', {
      findAll: async () => [{ text: 'David watched her edit.' }],
    });
    const StorytellerLine = {
      findAll: jest.fn(async (opts) => {
        for (const inc of opts.include || []) {
          for (const a of inc.attributes || []) {
            if (!chapterDeclared.has(a)) throw new Error(`column chapter.${a} does not exist`);
          }
        }
        for (const o of opts.order || []) {
          if (typeof o[0] === 'object' && !chapterDeclared.has(o[1])) throw new Error(`column chapter.${o[1]} does not exist`);
        }
        return checked.findAll({ where: opts.where });
      }),
    };
    jest.doMock(MODELS, () => ({ StorytellerLine, StorytellerChapter }));
    const create = jest.fn(async () => ({ content: [{ text: '[]' }] }));
    mockAnthropic(create);
    passAuth();

    const app = express();
    app.use(express.json());
    app.use('/', requireEngine());

    const res = await request(app).post('/generate-relationship-web').send({});
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('enriched');
    expect(create.mock.calls[0][0].messages[0].content).toContain('David watched her edit.');
  });
});

// ── 11. memories/engine.js loadCharacterRelationships ───────────────────────
describe('loadCharacterRelationships (src/routes/memories/engine.js)', () => {
  test('builds the relationship web without the unregistered characterA/characterB include', async () => {
    const checked = schemaChecked('CharacterRelationship', {
      findAll: async () => [{
        character_id_a: 'c1', character_id_b: 'c2', relationship_type: 'rival',
        is_romantic: false, family_role: null, is_blood_relation: false,
      }],
    });
    const CharacterRelationship = {
      findAll: jest.fn(async (opts) => {
        assertIncludesAssociated('CharacterRelationship', opts);
        return checked.findAll(opts);
      }),
    };
    const RegistryCharacter = schemaChecked('RegistryCharacter', {
      findAll: async ({ where }) => (where.character_key
        ? [{ id: 'c1', display_name: 'JustAWoman' }]
        : [{ id: 'c1', display_name: 'JustAWoman' }, { id: 'c2', display_name: 'Chloe' }]),
    });
    jest.doMock(MODELS, () => ({ CharacterRelationship, RegistryCharacter }));
    mockAnthropic(jest.fn());
    passAuth();

    const { loadCharacterRelationships } = requireEngine();
    const web = await loadCharacterRelationships('justawoman');
    expect(web).toContain('OTHER RELATIONSHIPS:');
    expect(web).toContain('Chloe — rival');
  });
});

// ── 12. onboarding /session-state ───────────────────────────────────────────
describe('POST /session-state (src/routes/onboarding.js)', () => {
  test('the last line is read by text, so a written world continues writing', async () => {
    const StorytellerLine = schemaChecked('StorytellerLine', {
      findAll: async () => [{ id: 'l1', text: 'She opened the laptop.', status: 'approved' }],
    });
    jest.doMock(MODELS, () => ({
      StorytellerLine,
      StorytellerChapter: { findAll: async () => [] },
      StorytellerBook: { findAll: async () => [{ id: 'b1' }] },
      RegistryCharacter: {},
      CharacterRegistry: {
        findAll: async () => [{
          characters: [
            { role_type: 'special', status: 'accepted' },
            { role_type: 'pressure' }, { role_type: 'mirror' }, { role_type: 'support' },
          ],
        }],
      },
      Sequelize: { Op: require('sequelize').Op },
    }));
    passAuth();

    const app = express();
    app.use(express.json());
    app.use('/', require('../../../src/routes/onboarding'));

    const res = await request(app).post('/session-state').send({ show_id: 's1' });
    expect(res.status).toBe(200);
    expect(res.body.ready_to_write).toBe(true);
    expect(res.body.primary_action.label).toBe('Continue writing');
  });
});

// ── 13. wardrobeApprovalController.bulkApprove ──────────────────────────────
describe('bulkApprove (src/controllers/wardrobeApprovalController.js)', () => {
  test('includes the registered wardrobeItem alias and approves', async () => {
    const row = {
      approval_status: 'pending',
      wardrobeItem: { library_item_id: null },
      update: jest.fn(async () => {}),
    };
    const checked = schemaChecked('EpisodeWardrobe', { findOne: async () => row });
    const EpisodeWardrobe = {
      findOne: jest.fn(async (opts) => {
        assertIncludesAssociated('EpisodeWardrobe', opts);
        return checked.findOne(opts);
      }),
    };
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    jest.doMock(MODELS, () => ({
      models: {
        EpisodeWardrobe, Wardrobe: {}, Episode: {}, WardrobeLibrary: {},
        WardrobeUsageHistory: { create: jest.fn() },
        sequelize: { transaction: async () => transaction },
      },
    }));

    const controller = require('../../../src/controllers/wardrobeApprovalController');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await controller.bulkApprove({ params: { episodeId: 'ep1' }, body: { wardrobeIds: ['w1'] }, user: { id: 'u1' } }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.errors).toBeUndefined();
    expect(body.approvedCount).toBe(1);
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ approval_status: 'approved' }), { transaction });
  });
});

// ── 14. wardrobeLibrary.js /analyze-image context ───────────────────────────
describe('POST /analyze-image (src/routes/wardrobeLibrary.js)', () => {
  test('the episode line reaches the gameplay prompt', async () => {
    const Episode = schemaChecked('Episode', {
      findByPk: async () => ({ id: 'ep1', title: 'Velvet Gala', episode_number: 4 }),
    });
    jest.doMock(MODELS, () => ({ Episode, models: {} }));
    jest.doMock('../../../src/controllers/wardrobeLibraryController', () => new Proxy({}, {
      get: () => (_req, res) => res.status(204).end(),
    }));
    jest.doMock('../../../src/services/notifications', () => ({}));
    const chain = {
      rotate: () => chain, resize: () => chain, jpeg: () => chain,
      toBuffer: async () => Buffer.from('jpg'),
    };
    jest.doMock('sharp', () => () => chain);
    const create = jest.fn(async () => ({ content: [{ text: '{"name":"Gown","item_type":"dress"}' }] }));
    mockAnthropic(create);
    passAuth();
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';

    try {
      const app = express();
      app.use(express.json());
      app.use('/', require('../../../src/routes/wardrobeLibrary'));

      const res = await request(app)
        .post('/analyze-image')
        .field('showId', 'show-1')
        .field('episodeId', 'ep1')
        .attach('image', Buffer.from('fake-image'), { filename: 'g.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(200);
      const prompt = create.mock.calls[0][0].messages[0].content[1].text;
      expect(prompt).toContain('SHOW CONTEXT');
      expect(prompt).toContain('Episode 4: "Velvet Gala"');
    } finally {
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });
});

// ── 15. groundedScriptGeneratorService wardrobe ─────────────────────────────
describe('generateGroundedScript (src/services/groundedScriptGeneratorService.js)', () => {
  test('owned wardrobe reaches the prompt instead of "Wardrobe not loaded"', async () => {
    const Wardrobe = schemaChecked('Wardrobe', {
      findAll: async () => [{ name: 'Silk Gown', clothing_category: 'dress' }],
    });
    const create = jest.fn(async () => ({ content: [{ text: 'SCRIPT' }] }));
    mockAnthropic(create);
    const { generateGroundedScript } = require('../../../src/services/groundedScriptGeneratorService');
    const models = {
      EpisodeBrief: { findOne: async () => null },
      ScenePlan: { findAll: async () => [] },
      SceneSet: {},
      sequelize: { query: async () => [[]] },
      Wardrobe,
      // The old site read WardrobeLibrary, which declares none of its names.
      WardrobeLibrary: schemaChecked('WardrobeLibrary'),
    };
    await generateGroundedScript('ep1', 'show-1', models);
    const prompt = create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('dress: Silk Gown');
    expect(prompt).not.toContain('Wardrobe not loaded');
  });
});

// ── 16. registrySync.onLineApproved ─────────────────────────────────────────
describe('registrySync.onLineApproved (src/services/registrySync.js)', () => {
  test('recent lines are ordered by sort_order and their text reaches Claude', async () => {
    const StorytellerLine = schemaChecked('StorytellerLine', {
      count: async () => 5,
      findAll: async () => [{ text: 'line three' }, { text: 'line two' }, { text: 'line one' }],
    });
    const models = {
      StorytellerLine,
      CharacterRegistry: {
        findAll: async () => [{ characters: [{ selected_name: 'David', type: 'pressure', role: 'husband' }] }],
      },
      RegistryCharacter: { update: jest.fn() },
    };
    const create = jest.fn(async () => ({ content: [{ text: '{"moments":[]}' }] }));
    mockAnthropic(create);
    const registrySync = require('../../../src/services/registrySync');
    await registrySync.onLineApproved({ content: 'bulk approval', chapter_id: 'ch1' }, { show_id: 's1' }, models);

    expect(StorytellerLine.findAll.mock.calls[0][0].order).toEqual([['sort_order', 'DESC']]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].messages[0].content).toContain('line one\nline two\nline three');
  });
});

// ── 17. worldTemperatureService.computeWorldTemperature ─────────────────────
describe('computeWorldTemperature (src/services/worldTemperatureService.js)', () => {
  test('runs no universe_id query on Character and says relationships were not scoped', async () => {
    const Character = schemaChecked('Character');
    const models = {
      StoryThread: { findAll: async () => [] },
      CharacterRelationship: { findAll: jest.fn(async () => []) },
      WorldStateSnapshot: { findOne: async () => null },
      Character,
    };
    const { computeWorldTemperature } = require('../../../src/services/worldTemperatureService');
    const result = await computeWorldTemperature('u1', models);

    expect(Character.findAll).not.toHaveBeenCalled();
    expect(models.CharacterRelationship.findAll).not.toHaveBeenCalled();
    expect(result.dataPoints.relationshipsScoped).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/no characterIds for universe u1/));
  });
});
