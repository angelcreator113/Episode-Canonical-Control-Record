// ============================================================================
// textureLayerService.generateTextureLayer — AI result whitelist (#1727)
// ============================================================================
// Five generators return JSON.parse of the model's text, whatever keys it
// produced. Each result is filtered to TEXTURE_AI_WRITABLE_FIELDS before it is
// merged, and TEXTURE_AI_NEVER_WRITABLE (identity, timestamps, approval) and
// every *_confirmed flag are never taken from a model reply. Mocked, no
// database, no network.

let mockReplies;

jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: {
    create: jest.fn(async ({ messages }) => {
      const prompt = messages[0].content;
      const hit = Object.keys(mockReplies).find((marker) => prompt.includes(marker));
      const text = hit ? mockReplies[hit] : 'plain generated prose';
      return { content: [{ text }] };
    }),
  },
})));
jest.mock('../../../src/services/arcTrackingService', () => ({
  buildArcContext: jest.fn(async () => ({ bleed_generated: false })),
}));

const {
  generateTextureLayer,
  TEXTURE_AI_WRITABLE_FIELDS,
  TEXTURE_AI_NEVER_WRITABLE,
  pickTextureAiFields,
} = require('../../../src/services/textureLayerService');

// Keys a hostile or confused model reply might add to any JSON layer.
const INJECTED = {
  id: 'injected-id',
  character_key: 'hijacked',
  registry_id: 'hijacked-registry',
  story_number: 999,
  inner_thought_confirmed: true,
  conflict_confirmed: true,
  fully_confirmed: true,
  confirmed_at: '2026-01-01T00:00:00Z',
  deletedAt: '2026-01-01T00:00:00Z',
  conflict_eligible: false,
  not_a_column: 'x',
};

const json = (obj) => JSON.stringify({ ...obj, ...INJECTED });

beforeEach(() => {
  mockReplies = {
    'Generate a conflict scene with FOUR PARTS': json({
      conflict_trigger: 'trigger', conflict_surface_text: 'surface', conflict_subtext: 'subtext',
      conflict_silence_beat: 'silence', conflict_resolution_type: 'deferred',
    }),
    'Generate a PRIVATE MOMENT': json({
      private_moment_setting: 'kitchen', private_moment_held_thing: 'held',
      private_moment_sensory_anchor: 'dishwasher', private_moment_text: 'moment',
    }),
    'Generate the post and three audience responses': json({
      post_text: 'post', post_platform: 'instagram', post_audience_bestie: 'bestie',
      post_audience_paying_man: 'paying', post_audience_competitive_woman: 'competitive',
    }),
    'Generate a MOM TONE INSERT': json({ mom_tone_trigger: 't', mom_tone_text: 'mom', mom_tone_child: 'elias' }),
    'Generate a MEMORY PROPOSAL': json({
      memory_proposal_type: 'keeps', memory_proposal_detail: 'detail', memory_proposal_text: 'memory',
    }),
    'Return JSON array only': '[]',
  };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// Story 10, a collision, with a love interest and a child present, runs every
// JSON generator: conflict, mom tone, memory proposal, private moment, post.
const STORY = { story_number: 10, story_type: 'collision', phase: 'establishment', text: 'She checked her phone.' };
const run = () => generateTextureLayer({}, STORY, {
  characterKey: 'lala',
  characterData: { display_name: 'Lala' },
  charactersPresent: [{ role_type: 'love_interest', character_key: 'david' }, { role_type: 'child', character_key: 'elias' }],
  registryId: 'reg-1',
});

describe('whitelisted fields from the model are written', () => {
  test('every layer the generators are meant to produce reaches the row', async () => {
    const texture = await run();
    expect(texture).toMatchObject({
      conflict_trigger: 'trigger', conflict_resolution_type: 'deferred',
      private_moment_text: 'moment', post_text: 'post', post_audience_bestie: 'bestie',
      mom_tone_text: 'mom', mom_tone_child: 'elias',
      memory_proposal_type: 'keeps', memory_proposal_text: 'memory',
      inner_thought_text: 'plain generated prose', body_narrator_text: 'plain generated prose',
      aftermath_line_text: 'plain generated prose',
    });
  });
});

describe('identity, approval and other columns named by the model are not', () => {
  test('identity comes from the request, never from a model reply', async () => {
    const texture = await run();
    expect(texture.character_key).toBe('lala');
    expect(texture.registry_id).toBe('reg-1');
    expect(texture.story_number).toBe(10);
    expect(texture).not.toHaveProperty('id');
  });

  test('no approval flag, timestamp or unknown key is taken from a model reply', async () => {
    const texture = await run();
    for (const key of ['inner_thought_confirmed', 'conflict_confirmed', 'fully_confirmed', 'confirmed_at', 'deletedAt', 'not_a_column']) {
      expect(texture).not.toHaveProperty(key);
    }
  });

  test('service-set eligibility flags are not overwritten by a model reply', async () => {
    const texture = await run();
    expect(texture.conflict_eligible).toBe(true);
    expect(texture.mom_tone_eligible).toBe(true);
    expect(texture.aftermath_eligible).toBe(true);
    expect(texture.private_moment_eligible).toBe(true);
  });

  test('each dropped key is logged, naming the generator', async () => {
    await run();
    const warnings = console.warn.mock.calls.map((c) => c[0]);
    for (const gen of ['generateConflictScene', 'generatePrivateMoment', 'generateOnlineSelfPost', 'generateMomToneInsert', 'generateMemoryProposal']) {
      const line = warnings.find((w) => w.includes(gen));
      expect(line).toBeDefined();
      for (const key of Object.keys(INJECTED)) expect(line).toContain(key);
    }
  });
});

describe('the constants', () => {
  test('nothing on the never-writable list, and no *_confirmed flag, is on the writable list', () => {
    for (const key of TEXTURE_AI_WRITABLE_FIELDS) {
      expect(TEXTURE_AI_NEVER_WRITABLE).not.toContain(key);
      expect(key.endsWith('_confirmed')).toBe(false);
    }
  });

  test('a *_confirmed key is dropped even if it were whitelisted by mistake', () => {
    TEXTURE_AI_WRITABLE_FIELDS.push('post_confirmed');
    try {
      expect(pickTextureAiFields({ post_confirmed: true, post_text: 'p' }, 'test')).toEqual({ post_text: 'p' });
    } finally {
      TEXTURE_AI_WRITABLE_FIELDS.pop();
    }
  });

  test('a non-object model reply merges nothing and is logged', () => {
    expect(pickTextureAiFields(['a'], 'test')).toEqual({});
    expect(pickTextureAiFields(null, 'test')).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('non-object'));
  });
});
