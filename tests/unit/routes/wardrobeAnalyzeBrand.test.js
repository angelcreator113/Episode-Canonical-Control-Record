/**
 * A new wardrobe piece's brand is one of the LalaVerse brands (Evoni,
 * 2026-10-18: "when i upload a wardrobe item and ai fills in the form one of
 * these brands should be choosen"): POST /wardrobe-library/analyze-image
 * lists the brands to the model and returns one of them.
 */
const express = require('express');
const request = require('supertest');

const MODELS = '../../../src/models';
const AUTH = '../../../src/middleware/auth';
const RATE = '../../../src/middleware/aiRateLimiter';

const BRANDS = [
  { id: 'b-velour', name: 'Velour Atelier', category: 'fashion', aesthetic: 'Architectural minimalism.', niche: 'Event dressing.' },
  { id: 'b-column', name: 'The Column', category: 'fashion', aesthetic: 'Quiet. Precise.', niche: null },
  { id: 'b-ori', name: 'Ori Beauty', category: 'beauty', aesthetic: 'Clean, warm.', niche: null },
];

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function analyze({ answer, brands }) {
  const query = jest.fn(async () => [brands]);
  jest.doMock(MODELS, () => ({ sequelize: { query } }));
  jest.doMock('../../../src/controllers/wardrobeLibraryController', () => new Proxy({}, {
    get: () => (_req, res) => res.status(204).end(),
  }));
  jest.doMock('../../../src/services/notifications', () => ({}));
  const chain = { rotate: () => chain, resize: () => chain, jpeg: () => chain, toBuffer: async () => Buffer.from('jpg') };
  jest.doMock('sharp', () => () => chain);
  const create = jest.fn(async () => ({ content: [{ text: JSON.stringify(answer) }] }));
  const Anthropic = jest.fn().mockImplementation(() => ({ messages: { create } }));
  Anthropic.default = Anthropic;
  jest.doMock('@anthropic-ai/sdk', () => Anthropic);
  jest.doMock(AUTH, () => ({ ...jest.requireActual(AUTH), requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } }));
  jest.doMock(RATE, () => ({ aiRateLimiter: (_q, _s, next) => next() }));
  const prevKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  try {
    const app = express();
    app.use(express.json());
    app.use('/', require('../../../src/routes/wardrobeLibrary'));
    const res = await request(app)
      .post('/analyze-image')
      .attach('image', Buffer.from('fake-image'), { filename: 'g.jpg', contentType: 'image/jpeg' });
    return { res, prompt: create.mock.calls[0][0].messages[0].content[1].text };
  } finally {
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevKey;
  }
}

describe('POST /analyze-image chooses a LalaVerse brand', () => {
  test('the prompt lists the brands and the answer is one of them', async () => {
    const { res, prompt } = await analyze({ answer: { name: 'Ivory Column Gown', item_type: 'dress', brand_guess: 'velour atelier' }, brands: BRANDS });
    expect(res.status).toBe(200);
    expect(prompt).toContain('THE LALAVERSE BRANDS');
    expect(prompt).toContain('- Velour Atelier (fashion): Architectural minimalism. For: Event dressing.');
    expect(prompt).toContain('- Ori Beauty (beauty)');
    expect(prompt).toContain('exactly one name from THE LALAVERSE BRANDS below');
    expect(prompt).not.toContain('invent one');
    expect(res.body.data.brand_guess).toBe('Velour Atelier');
    expect(res.body.data.brand_id).toBe('b-velour');
    expect(res.body.data.brand_is_fictional).toBe(true);
  });

  test('an answer naming another brand takes the first fashion brand', async () => {
    const { res } = await analyze({ answer: { name: 'Tee', item_type: 'top', brand_guess: 'Maison Rêve' }, brands: BRANDS });
    expect(res.body.data.brand_guess).toBe('Velour Atelier');
    expect(res.body.data.brand_id).toBe('b-velour');
  });

  test('with no brands in the world, a fictional name as before', async () => {
    const { res, prompt } = await analyze({ answer: { name: 'Tee', item_type: 'top', brand_guess: 'Gucci' }, brands: [] });
    expect(prompt).not.toContain('THE LALAVERSE BRANDS');
    expect(prompt).toContain('invent one');
    expect(res.body.data.brand_guess).not.toBe('Gucci');
    expect(res.body.data.brand_id).toBeUndefined();
  });
});

describe('services/wardrobeBrandChoice', () => {
  const { pickBrand, brandChoiceBlock, loadBrandChoices } = require('../../../src/services/wardrobeBrandChoice');

  test('pickBrand: the exact name in any case, or a name inside the answer, else null', () => {
    expect(pickBrand('THE COLUMN', BRANDS).id).toBe('b-column');
    expect(pickBrand('Probably The Column.', BRANDS).id).toBe('b-column');
    expect(pickBrand('Maison Rêve', BRANDS)).toBeNull();
    expect(pickBrand('', BRANDS)).toBeNull();
    expect(pickBrand('The Column', [])).toBeNull();
  });

  test('brandChoiceBlock is empty for no brands', () => {
    expect(brandChoiceBlock([])).toBe('');
  });

  test('loadBrandChoices reads fashion first and logs a failed read as []', async () => {
    const query = jest.fn(async () => [[{ id: 1, name: ' Velour  Atelier ', category: 'fashion', aesthetic: '', niche: null }]]);
    expect(await loadBrandChoices({ sequelize: { query } })).toEqual([{ id: 1, name: 'Velour Atelier', category: 'fashion', aesthetic: null, niche: null }]);
    expect(query.mock.calls[0][0]).toMatch(/ORDER BY \(category = 'fashion'\) DESC, name/);
    const failing = { sequelize: { query: jest.fn(async () => { throw new Error('no table'); }) } };
    expect(await loadBrandChoices(failing)).toEqual([]);
    expect(console.error).toHaveBeenCalled();
    expect(await loadBrandChoices({})).toEqual([]);
  });
});
