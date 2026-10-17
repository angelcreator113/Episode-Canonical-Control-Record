/**
 * Content types, ideas 1 and 5 (Evoni, 2026-10-17: "start ideas 1 and 5"),
 * the Anthropic call mocked. Dana is an ICU nurse known on The Pulse as The
 * Entertainer.
 * Idea 1, the gap as a story hook:
 * - the job-vs-content line is kept on her character (PUT gap; GET returns
 *   it; a PUT without a name keeps her content type);
 * - her character file carries it author-side only (not publicOnly);
 * - the story writers' block (contentHookFor) names her content, her job and
 *   the gap; the Story Engine and Write Mode load it by her key; the scene
 *   writer's prompt carries it;
 * - the Society tab's apply saves the line on her character.
 * Idea 5, posts off their lane:
 * - the gate's one voice call also reads the post against her content type,
 *   and "off" is an off_lane flag (the post goes to Review); a DM is never
 *   held to her lane, nor a poster with no content type;
 * - the pressure test asks whether her posts fit what she is known for.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });
const allText = (call) => JSON.stringify(call);
const GAP = 'She jokes about the job that is wearing her down, so nobody asks how she really is.';

(shouldSkip ? describe.skip : describe)('content hooks: the job-vs-content gap and posts off their lane', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  const key = `hook-${tag}`;
  let pid;
  let plainPid;
  let admin;
  const auth = (r) => r.set('Authorization', `Bearer ${admin}`);
  const base = `/api/v1/cast/characters/${ids.char}/content-type`;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-hooks', email: 'evoni@hooks.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Hooks ${tag}`, slug: `hooks-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Hooks', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, society_archetype, content_persona, created_at, updated_at)
      VALUES (:h, 'pulse', 'Night shift jokes.', 'Dana', 'lalaverse', 'The Entertainer', 'Comedy skits about the night shift', NOW(), NOW()) RETURNING id`, { h: `@hook${tag}` });
    pid = p.id;
    const [[p2]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'Plain.', 'Plain', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `@plain${tag}` });
    plainPid = p2.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, core_wound, canon_facts, extra_fields, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Dana', :pid, 'Nobody asked how she was after her father died.', CAST(:facts AS jsonb), CAST(:extra AS jsonb), NOW(), NOW())`,
    { ...ids, key, pid, facts: JSON.stringify({ occupation: 'ICU nurse' }), extra: JSON.stringify({ keep: 'me' }) });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:pids)', { pids: [pid, plainPid] });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  describe('idea 1: the gap as a story hook', () => {
    it('keeps the job-vs-content line on her character, beside her other extra fields; a PUT without a name keeps her type', async () => {
      const res = await auth(request(app).put(base)).send({ gap: GAP });
      expect(res.status).toBe(200);
      expect(res.body.gap).toBe(GAP);
      expect(res.body.current).toMatchObject({ name: 'The Entertainer' });
      const [[row]] = await run('SELECT extra_fields FROM registry_characters WHERE id = :char', ids);
      expect(row.extra_fields.keep).toBe('me');
      expect(row.extra_fields.content_gap.text).toBe(GAP);
      expect((await auth(request(app).get(base))).body.gap).toBe(GAP);
      expect((await auth(request(app).put(base)).send({ gap: 42 })).status).toBe(400);
    });

    it('her character file carries the gap author-side only', async () => {
      const { characterFilePrompt } = require('../../src/services/characterFile');
      const character = await db.RegistryCharacter.findByPk(ids.char);
      expect((await characterFilePrompt(db, { character })).block).toContain(GAP.replace(/\.$/, ''));
      const publicBlock = (await characterFilePrompt(db, { character, publicOnly: true })).block;
      expect(publicBlock).toContain('KNOWN FOR ON THE PULSE');
      expect(publicBlock).not.toContain('wearing her down');
    });

    it('gives the story writers her content, her job and the gap; the Story Engine and Write Mode load it by her key', async () => {
      const { contentHookFor } = require('../../src/services/characterContentType');
      const hook = await contentHookFor(db, await db.RegistryCharacter.findByPk(ids.char));
      for (const part of ['Dana ON THE PULSE: known as The Entertainer', 'By day: ICU nurse.', 'wearing her down', 'A story hook']) expect(hook).toContain(part);

      const engine = require('../../src/routes/memories/engine');
      expect(await engine.loadContentHook(key)).toBe(hook);
      const ctx = await engine.loadWriteModeContext(ids.char);
      expect(ctx.contentHook).toBe(hook);
      expect(engine.buildWriteModeContextBlock(ctx)).toContain('known as The Entertainer');
      expect(await engine.loadContentHook(`nobody-${tag}`)).toBeNull();
    });

    it('the scene writer writes with it', async () => {
      mockCreate.mockResolvedValue(reply('The scene.'));
      const res = await auth(request(app).post('/api/v1/character-ai/write-scene')).send({ character_id: ids.char, situation: 'after a double shift' });
      expect(res.status).toBe(200);
      expect(allText(mockCreate.mock.calls[0])).toContain('known as The Entertainer');
      expect(allText(mockCreate.mock.calls[0])).toContain('wearing her down');
    });

    it('the Society tab\'s apply saves the line on her character', async () => {
      await run("UPDATE registry_characters SET extra_fields = '{\"keep\":\"me\"}'::jsonb WHERE id = :char", ids);
      const res = await auth(request(app).post('/api/v1/cast/content-types/apply')).send({ items: [{ profile_id: pid, name: 'The Entertainer', character_id: ids.char, gap: 'Jokes so nobody asks.' }] });
      expect(res.status).toBe(200);
      expect(res.body.saved).toEqual([{ profile_id: pid, name: 'The Entertainer', gap_saved: true }]);
      const [[row]] = await run('SELECT extra_fields FROM registry_characters WHERE id = :char', ids);
      expect(row.extra_fields).toMatchObject({ keep: 'me', content_gap: { text: 'Jokes so nobody asks.' } });
    });
  });

  describe('idea 5: posts off their lane', () => {
    const gate = require('../../src/services/pulseGate');
    const voice = { habits_json: { tone: 'dry' }, examples_json: [{ text: 'night shift: 1, me: 0' }] };

    it('flags a post off what she is known for, from the same one voice call', async () => {
      mockCreate.mockResolvedValue(reply({ score: 0.9, why: 'Her voice.', lane: 'off', lane_why: 'A serious skincare tutorial, nothing comic.' }));
      const result = await gate.check(db, { social_profile_id: pid, content_text: 'Step 1: double cleanse.' }, { voice });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(allText(mockCreate.mock.calls[0])).toContain('known on The Pulse as The Entertainer');
      expect(result.pass).toBe(false);
      expect(result.lane).toBe('off');
      expect(result.flags).toEqual([{ code: 'off_lane', detail: 'Off what they are known for (The Entertainer): A serious skincare tutorial, nothing comic.' }]);
      expect(gate.reviewReasons({ social_profile_id: pid, content_text: 'x' }, result, { lalaProfileId: -1 })).toEqual(['gate']);
    });

    it('passes a post in her lane', async () => {
      mockCreate.mockResolvedValue(reply({ score: 0.9, why: 'Her voice.', lane: 'in', lane_why: 'A night shift joke.' }));
      const result = await gate.check(db, { social_profile_id: pid, content_text: 'night shift: 2, me: 0' }, { voice });
      expect(result).toMatchObject({ pass: true, lane: 'in', flags: [] });
    });

    it('never holds a DM, or a poster with no content type, to a lane', async () => {
      mockCreate.mockResolvedValue(reply({ score: 0.9, why: 'Her voice.', lane: 'off' }));
      const dm = await gate.check(db, { social_profile_id: pid, content_text: 'u up?' }, { voice, checkLane: false });
      expect(allText(mockCreate.mock.calls[0])).not.toContain('known on The Pulse');
      expect(dm.pass).toBe(true);
      const plain = await gate.check(db, { social_profile_id: plainPid, content_text: 'hi' }, { voice });
      expect(allText(mockCreate.mock.calls[1])).not.toContain('known on The Pulse');
      expect(plain.pass).toBe(true);
    });

    it('the pressure test asks whether her posts fit what she is known for', async () => {
      mockCreate.mockResolvedValue(reply({ questions: [
        { question: 'Why does a comedy account post a skincare tutorial?', about: 'content', verdict: 'contradiction', answer: 'Nothing explains it.', cites: ['KNOWN FOR ON THE PULSE'], fix: 'Give the post a reason or move it.' },
      ] }));
      const res = await auth(request(app).post(`/api/v1/cast/characters/${ids.char}/pressure-test`));
      expect(res.status).toBe(200);
      expect(res.body.questions[0].about).toBe('content');
      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('content: do their latest posts fit what they are KNOWN FOR ON THE PULSE?');
      expect(prompt).toContain('KNOWN FOR ON THE PULSE (their content type');
    });
  });
});
