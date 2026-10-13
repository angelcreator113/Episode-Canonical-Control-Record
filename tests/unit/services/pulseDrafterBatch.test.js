/**
 * services/pulseDrafter batches (Task #3032; Evoni, 2026-10-12: "Each
 * request can draft a small batch of posts or replies"): the prompt gives
 * each item its own voice, knowledge line and private context; the answer
 * is read whole, or entry by entry when it is cut off or garbled.
 */
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: jest.fn() } }; });

const { buildPostBatchPrompt, buildCommentBatchPrompt, parseBatch, draftPostBatch, BATCH_MAX } = require('../../../src/services/pulseDrafter');

const entry = (name, handle, extra = {}) => ({
  character: { display_name: name, living_state: { worry: `${name}'s secret` } },
  profile: { handle, display_name: name },
  voice: { habits_json: { case: 'lowercase', temperament: 'regular' }, examples_json: [{ text: `${name} really said this` }] },
  known: null,
  ...extra,
});

describe('batch prompts', () => {
  test('posts: one numbered block per poster with their own voice, examples, knowledge and private context; the moment once', () => {
    const prompt = buildPostBatchPrompt([
      entry('Marcus', 'marcus.k', { known: 'the Starlight Ball' }),
      entry('Nia', 'nia'),
    ], { label: 'the night of Episode 2', about: 'the gala, which just happened' });
    expect(prompt).toMatch(/^You write 2 separate posts/);
    expect(prompt).toContain('When: the night of Episode 2.');
    expect(prompt).toContain('What happened: the gala, which just happened');
    expect(prompt).toContain('### 1. Marcus (@marcus.k)');
    expect(prompt).toContain('### 2. Nia (@nia)');
    expect(prompt).toContain('Marcus really said this');
    expect(prompt).toContain('Events they know about by now: the Starlight Ball. Name no other event.');
    expect(prompt).toContain('They know of no events yet: name none.');
    expect(prompt).toContain("Nia's secret");
    expect(prompt).toContain('{"items": [{"n": 1, "text": "the post"');
    expect(prompt.indexOf('### 1. Marcus')).toBeLessThan(prompt.indexOf('### 2. Nia'));
  });

  test('comments: the post once, then one numbered block per commenter', () => {
    const prompt = buildCommentBatchPrompt({ poster_handle: 'lala', content_text: 'Gala tonight.' }, [entry('Kim', 'kim'), entry('Nia', 'nia')]);
    expect(prompt).toMatch(/^You write 2 separate comments on one post/);
    expect(prompt).toContain('The post, by @lala:\nGala tonight.');
    expect(prompt).toContain('### 1. Kim (@kim)');
    expect(prompt).toContain('### 2. Nia (@nia)');
    expect(prompt).toContain('{"items": [{"n": 1, "text": "the comment"}]}');
  });
});

describe('parseBatch', () => {
  test('a whole answer: every entry by number, trimmed; out-of-range, empty and repeated numbers are dropped', () => {
    const raw = 'Here you go:\n' + JSON.stringify({ items: [
      { n: 2, text: '  second  ', hashtag: '#Two' }, { n: 1, text: 'first', reveals_story: true },
      { n: 3, text: 'no third item asked for' }, { n: 1, text: 'a repeat' }, { n: 2, text: '' },
    ] });
    const got = parseBatch(raw, 2);
    expect([...got.keys()].sort()).toEqual([1, 2]);
    expect(got.get(1)).toMatchObject({ text: 'first', reveals_story: true });
    expect(got.get(2)).toMatchObject({ text: 'second', hashtag: '#Two' });
  });

  test('a bare array is read in order when entries carry no number', () => {
    expect([...parseBatch('[{"text":"a"},{"text":"b"}]', 2).values()].map((e) => e.text)).toEqual(['a', 'b']);
  });

  test('a cut-off answer still yields the entries it holds', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = '{"items": [{"n": 1, "text": "made it"}, {"n": 2, "text": "made it too", "hashtag": null}, {"n": 3, "text": "cut of';
    const got = parseBatch(raw, 3);
    expect([...got.keys()]).toEqual([1, 2]);
    expect(got.get(2).text).toBe('made it too');
  });

  test('a batch of one answered as one draft; nothing readable is an empty map', () => {
    expect(parseBatch('{"text": "just one"}', 1).get(1).text).toBe('just one');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseBatch('sorry, I cannot', 2).size).toBe(0);
    expect(parseBatch('{"text": "one"}', 2).size).toBe(0);
  });
});

describe('batch size', () => {
  test(`at most ${BATCH_MAX} items, at least one; nothing is asked before that`, async () => {
    const db = {};
    await expect(draftPostBatch(db, { showId: 's', items: [] })).rejects.toThrow('A batch needs at least one item.');
    await expect(draftPostBatch(db, { showId: 's', items: Array.from({ length: BATCH_MAX + 1 }, (_, i) => ({ characterId: `c${i}` })) }))
      .rejects.toThrow(`A batch drafts at most ${BATCH_MAX} items.`);
    expect(BATCH_MAX).toBe(5);
  });
});
