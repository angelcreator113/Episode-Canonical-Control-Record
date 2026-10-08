// ============================================================================
// UNIT TEST — confirm-feed and bulk generate give a LalaVerse profile its
// Society archetype (fix-list item 26; Evoni's ruling, 2026-10-08: "Feed
// also uses your 15")
// ============================================================================
// A confirmed proposal (POST /character-generation/confirm-feed) gets the
// least used; bulk generate's AI chooses from the list.
// tests/integration/societyArchetypesFeed.integration.test.js has the rest.
// (The registry create's auto Feed profile is gone: "Only by proposal",
// 2026-10-08.)
//
// Mocked, no database, no AI call. The counts make "The Archivist" the
// least used of the default fifteen, so the least-used pick is known.
// ============================================================================

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';

const express = require('express');
const request = require('supertest');
const { Sequelize, DataTypes } = require('sequelize');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});
const mockModels = {};
jest.mock('../../../src/models', () => mockModels);

const { DEFAULT_ARCHETYPES } = require('../../../src/services/societyArchetypes');
const { generateSingleProfile } = require('../../../src/routes/socialProfileBulkRoutes');
const charGenRouter = require('../../../src/routes/characterGenerationRoutes');

const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/unused', { logging: false });
const { rawAttributes } = require('../../../src/models/SocialProfile')(sequelize, DataTypes);

const LEAST = 'The Archivist';
const USED = DEFAULT_ARCHETYPES.filter((a) => a.name !== LEAST).map((a) => ({ society_archetype: a.name, count: '1' }));
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

function models() {
  return {
    sequelize,
    PageContent: { findOne: jest.fn(async () => null) },
    SocialProfile: {
      rawAttributes,
      count: jest.fn(async () => 0),
      findOne: jest.fn(async () => null),
      findAll: jest.fn(async () => USED),
      create: jest.fn(async (r) => ({ id: 41, ...r })),
    },
  };
}

beforeEach(() => mockCreate.mockReset());

describe('POST /character-generation/confirm-feed', () => {
  const confirm = (db, body) => {
    const app = express();
    app.use(express.json());
    app.set('models', { ...db, RegistryCharacter: { findByPk: jest.fn(async () => ({ id: 'rc-1', update: jest.fn() })) } });
    app.use('/cg', charGenRouter);
    return request(app).post('/cg/confirm-feed').send({ character_id: 'rc-1', feed_proposal: { handle: '@proposal', platform: 'tiktok' }, ...body });
  };

  test('a LalaVerse proposal: the least used archetype', async () => {
    const db = models();
    expect((await confirm(db, { feed_layer: 'lalaverse' })).status).toBe(201);
    expect(db.SocialProfile.create.mock.calls[0][0]).toMatchObject({ feed_layer: 'lalaverse', society_archetype: LEAST });
  });

  test('a real-world proposal: none', async () => {
    const db = models();
    expect((await confirm(db, {})).status).toBe(201);
    expect(db.SocialProfile.create.mock.calls[0][0]).toMatchObject({ feed_layer: 'real_world', society_archetype: null });
  });
});

describe('bulk generate', () => {
  const creator = { handle: '@bulkone', platform: 'instagram', vibe_sentence: 'Skincare at dawn.' };

  test('LalaVerse: the AI chooses from the list, and its pick is stored as the list spells it', async () => {
    const db = models();
    mockCreate.mockResolvedValue(reply({ display_name: 'Bulk One', archetype: 'the_peer', society_archetype: 'beauty oracle' }));
    await generateSingleProfile(creator, { db, feedLayer: 'lalaverse' });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('SOCIETY ARCHETYPE: what the LalaVerse knows this creator for');
    for (const a of DEFAULT_ARCHETYPES) expect(prompt).toContain(`- ${a.name}: `);
    expect(db.SocialProfile.create.mock.calls[0][0].society_archetype).toBe('The Beauty Oracle');
  });

  test('LalaVerse, a pick off the list: the least used', async () => {
    const db = models();
    mockCreate.mockResolvedValue(reply({ display_name: 'Bulk One', society_archetype: 'The Night Owl' }));
    await generateSingleProfile(creator, { db, feedLayer: 'lalaverse' });
    expect(db.SocialProfile.create.mock.calls[0][0].society_archetype).toBe(LEAST);
  });

  test('real world: no list in the prompt, and none stored', async () => {
    const db = models();
    mockCreate.mockResolvedValue(reply({ display_name: 'Bulk One', society_archetype: 'The Educator' }));
    await generateSingleProfile(creator, { db, feedLayer: 'real_world' });
    expect(mockCreate.mock.calls[0][0].messages[0].content).not.toContain('SOCIETY ARCHETYPE');
    expect(db.SocialProfile.create.mock.calls[0][0].society_archetype).toBeNull();
  });
});
