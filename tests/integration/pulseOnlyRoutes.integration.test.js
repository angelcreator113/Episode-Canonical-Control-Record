/**
 * LalaVerse social is The Pulse (Evoni, 2026-10-17), the AI stubbed:
 * - bulk import on Lala's feed reads everyone as a Pulse creator, whatever
 *   app a line names, and never asks the AI to guess an app; JustAWoman's
 *   feed keeps real apps (Instagram when a line names none);
 * - regenerating a LalaVerse profile asked for "instagram" still writes it
 *   on The Pulse: its prompt and post formats are The Pulse's.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const reply = (body) => ({ content: [{ text: JSON.stringify(body) }], usage: { input_tokens: 1, output_tokens: 1 } });
const promptOf = (call) => call[0].messages[0].content;

(shouldSkip ? describe.skip : describe)('LalaVerse social is The Pulse', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  let token;
  let profileId;
  const post = (path, body) => request(app).post(`/api/v1/social-profiles${path}`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-pulse-only', email: 'evoni@pulse-only.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    const [[row]] = await sequelize.query(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, city, created_at, updated_at)
       VALUES (:h, 'pulse', 'Slow fashion.', 'Maren', 'lalaverse', 'dazzle_district', NOW(), NOW()) RETURNING id`,
      { replacements: { h: `@pulseonly${TAG}` } });
    profileId = row.id;
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await sequelize.query('DELETE FROM social_profiles WHERE id = :id', { replacements: { id: profileId } });
    await sequelize.close();
  });

  it('bulk paste on Lala\'s feed: everyone is on The Pulse; JustAWoman\'s feed keeps real apps', async () => {
    const text = '@mollymeannn | tiktok | does makeup\n@softlife | luxury everything\n@weird | myspace | old school';
    const lala = await post('/bulk/parse-paste', { text, feed_layer: 'lalaverse' });
    expect(lala.status).toBe(200);
    expect(lala.body.creators.map((c) => [c.handle, c.platform])).toEqual([['mollymeannn', 'pulse'], ['softlife', 'pulse'], ['weird', 'pulse']]);
    expect(lala.body.errors).toEqual([]);

    const real = await post('/bulk/parse-paste', { text });
    expect(real.body.creators.map((c) => [c.handle, c.platform])).toEqual([['mollymeannn', 'tiktok'], ['softlife', 'instagram']]);
    expect(real.body.errors.map((e) => e.reason)).toEqual(['Unknown platform: myspace']);
  });

  it('the AI extractor on Lala\'s feed asks for no app, and what it guesses becomes The Pulse', async () => {
    mockCreate.mockResolvedValue(reply([{ handle: 'overnight.era', platform: 'instagram', vibe_sentence: '400k in six months' }]));
    const res = await post('/bulk/parse-paste', { text: 'There is this girl overnight.era who blew up in six months.', feed_layer: 'lalaverse' });
    expect(res.status).toBe(200);
    expect(res.body.creators).toEqual([expect.objectContaining({ handle: 'overnight.era', platform: 'pulse' })]);
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain('no platform: in the LalaVerse everyone is on The Pulse');
    expect(prompt).not.toContain('default to "instagram"');
  });

  it('bulk CSV on Lala\'s feed: a platform column is read as The Pulse', async () => {
    const res = await post('/bulk/parse-csv', { text: 'handle,platform,vibe\nmolly,tiktok,does makeup', feed_layer: 'lalaverse' });
    expect(res.status).toBe(200);
    expect(res.body.creators).toEqual([expect.objectContaining({ handle: 'molly', platform: 'pulse' })]);
  });

  it('regenerating a LalaVerse profile asked for instagram writes it on The Pulse', async () => {
    mockCreate.mockResolvedValue(reply({ display_name: 'Maren', follower_count_approx: '20k', content_persona: 'calm' }));
    await post(`/${profileId}/regenerate`, { platform: 'instagram' });
    expect(mockCreate).toHaveBeenCalled();
    const prompt = promptOf(mockCreate.mock.calls[0]);
    expect(prompt).toContain('Platform: The Pulse');
    expect(prompt).toContain('pulse post|pulse story|pulse video|pulse live');
    expect(prompt).not.toContain('tiktok live|instagram reel');
    expect(prompt).not.toContain('Platform: instagram');
  });
});
