// ============================================================================
// Phone round step 1 (Evoni, 2026-10-25), the parts that need no database:
//   D4 — a failed read of the phone's screens is an error (500 with the
//        reason), not a success with no screens.
//   D6 — every Phone Hub route that answers with an error logs it.
//   D7 — the AI calls follow the two-attempt loop: once more on 529/503,
//        never again on a budget refusal.
// ============================================================================

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const mockQuery = jest.fn();
jest.mock('../../../src/models', () => ({ sequelize: { query: (...args) => mockQuery(...args) } }));
jest.mock('../../../src/middleware/auth', () => {
  const actual = jest.requireActual('../../../src/middleware/auth');
  return { ...actual, requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); } };
});

const router = require('../../../src/routes/uiOverlayRoutes');
const { getAllOverlayTypes } = require('../../../src/services/uiOverlayService');
const { createMessage } = require('../../../src/routes/phoneAIRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/ui-overlays', router);

let errorSpy;
beforeEach(() => {
  mockQuery.mockReset();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('D4: a failed read of the screens is an error', () => {
  test('getAllOverlayTypes throws with a code instead of returning []', async () => {
    const models = { sequelize: { query: jest.fn().mockRejectedValue(new Error('relation "ui_overlay_types" does not exist')) } };
    await expect(getAllOverlayTypes('show-1', models)).rejects.toMatchObject({
      code: 'PHONE_TYPES_READ',
      message: expect.stringContaining("Could not read the phone's screens"),
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  test('GET /ui-overlays/:showId answers 500 with the reason, not success with no screens', async () => {
    mockQuery.mockRejectedValue(new Error('connection reset'));
    const res = await request(app).get('/api/v1/ui-overlays/show-1');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Could not read the phone's screens: connection reset");
  });
});

describe('D6: every error answer is logged', () => {
  test('a failed save logs before it answers 500', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    const res = await request(app).put('/api/v1/ui-overlays/show-1/style-prefix').send({ style_prefix: 'x' });
    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('[UIOverlay] PUT /style-prefix failed:', expect.any(Error));
  });

  test('no catch in uiOverlayRoutes answers 500 without a console.error first', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../src/routes/uiOverlayRoutes.js'), 'utf8').split('\n');
    const silent = [];
    src.forEach((line, i) => {
      if (!/\}\s*catch\s*\(\s*\w+\s*\)\s*\{\s*$/.test(line)) return;
      // The catch body up to its first return.
      for (let j = i + 1; j < Math.min(src.length, i + 8); j += 1) {
        if (/console\.(error|warn)|sendStatsPanelError|logged where thrown/.test(src[j])) return;
        if (/return res\.status\(5\d\d\)/.test(src[j])) { silent.push(`${i + 1}: ${line.trim()}`); return; }
        if (/^\s*\}/.test(src[j])) return;
      }
    });
    expect(silent).toEqual([]);
  });
});

describe('D7: the AI call retries once on overload, never on a budget refusal', () => {
  const ok = { content: [{ text: '{"zones": []}' }] };
  const err = (status, code) => Object.assign(new Error(`status ${status}`), { status, code });

  test('a 529 is tried once more, with the house model', async () => {
    const create = jest.fn().mockRejectedValueOnce(err(529)).mockResolvedValueOnce(ok);
    const res = await createMessage({ messages: { create } }, { max_tokens: 10, messages: [] }, { delayMs: 0 });
    expect(res).toBe(ok);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
  });

  test('an out-of-budget refusal is thrown at once', async () => {
    const create = jest.fn().mockRejectedValue(err(429, 'AI_BUDGET_EXCEEDED'));
    await expect(createMessage({ messages: { create } }, { messages: [] }, { delayMs: 0 })).rejects.toMatchObject({ status: 429 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('still overloaded after the retry is a 503 that says so', async () => {
    const create = jest.fn().mockRejectedValue(err(503));
    await expect(createMessage({ messages: { create } }, { messages: [] }, { delayMs: 0 })).rejects.toMatchObject({
      status: 503, message: expect.stringContaining('temporarily overloaded'),
    });
    expect(create).toHaveBeenCalledTimes(2);
  });
});
