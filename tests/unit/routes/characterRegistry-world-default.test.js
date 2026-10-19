// ============================================================================
// UNIT TEST — a new character takes its registry's world
// ============================================================================
// Every new character used to be saved as 'book-1' unless the caller named a
// world, so characters of the show's registries read as JustAWoman's world.
// Canon (Evoni, 2026-10-15; docs/CANON.md): JustAWoman lives in her world
// and writes Lala's. Only the Book 1 registry is hers.

const express = require('express');
const request = require('supertest');

let mockRegistry;
const mockCreate = jest.fn(async (v) => ({ id: 'rc-1', ...v, update: jest.fn() }));
jest.mock('../../../src/models', () => ({
  CharacterRegistry: { findByPk: jest.fn(async () => mockRegistry) },
  RegistryCharacter: { count: jest.fn(async () => 0), create: (...a) => mockCreate(...a) },
  SocialProfile: {},
}));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1', groups: ['ADMIN'] }; /* the writes are ADMIN only (Evoni, 2026-10-19) */ next(); } };
});

const router = require('../../../src/routes/characterRegistry');

const app = express();
app.use(express.json());
app.use('/api/v1/character-registry', router);
const create = (body) => request(app).post('/api/v1/character-registry/registries/reg-1/characters').send({ display_name: 'Nia', ...body });

beforeEach(() => mockCreate.mockClear());

test("a character in the show's registry is Lala's world", async () => {
  mockRegistry = { id: 'reg-1', book_tag: null };
  expect((await create({})).status).toBe(201);
  expect(mockCreate.mock.calls[0][0].world).toBe('lalaverse');
});

test("a character in the Book 1 registry is JustAWoman's world", async () => {
  mockRegistry = { id: 'reg-1', book_tag: 'Book 1 · Before Lala' };
  await create({});
  expect(mockCreate.mock.calls[0][0].world).toBe('book-1');
});

test('a world asked for wins; an unknown one does not', async () => {
  mockRegistry = { id: 'reg-1', book_tag: null };
  await create({ world: 'book-1' });
  expect(mockCreate.mock.calls[0][0].world).toBe('book-1');
  await create({ world: 'narnia' });
  expect(mockCreate.mock.calls[1][0].world).toBe('lalaverse');
});
