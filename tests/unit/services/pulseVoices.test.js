/**
 * Voice Profiles (Task #2967): the banned AI-sounding phrases, the public
 * face a voice is built from (never wounds or Living State), its stable
 * fingerprint, and the habits' shape.
 */
const {
  BANNED_PHRASES, findBanned, voiceSource, sourceHash, normalizeHabits, needsRebuild,
  addExample, MAX_EXAMPLES, MAX_EDIT_EXAMPLES,
} = require('../../../src/services/pulseVoices');

describe('findBanned', () => {
  test('finds banned phrases, case-insensitive, curly quotes too', () => {
    expect(findBanned('Let\u2019s DIVE IN to this vibrant tapestry')).toEqual(['tapestry', 'let\'s dive in', 'vibrant tapestry']);
    expect(findBanned('A testament to hard work')).toEqual(expect.arrayContaining(['a testament to', 'testament to']));
    expect(findBanned('Delving into it')).toContain('delving');
  });

  test('whole words only, and nothing in ordinary posts', () => {
    expect(findBanned('the realmofthings')).toEqual([]);
    expect(findBanned('delved')).toEqual([]);
    expect(findBanned('omg the gala was SO good tonight')).toEqual([]);
    expect(findBanned('')).toEqual([]);
    expect(findBanned(null)).toEqual([]);
  });

  test('the list is one place, lowercase, no duplicates', () => {
    expect(BANNED_PHRASES.every((p) => p === p.toLowerCase())).toBe(true);
    expect(new Set(BANNED_PHRASES).size).toBe(BANNED_PHRASES.length);
  });
});

describe('voiceSource and sourceHash', () => {
  const character = {
    display_name: 'Marcus', the_mask: 'effortless', voice_signature: { register: 'dry' },
    wound: 'his father left', living_state: { mood: 'lonely' }, de_money_wound: 'private', hidden_want: 'to be seen', writer_notes: 'x', empty: '',
  };
  const profile = { handle: 'marcus.k', posting_voice: 'all lowercase, no punctuation', vibe_sentence: '', id: 3 };

  test('the public face only: wounds, Living State and author notes never go in', () => {
    const source = voiceSource(character, profile);
    expect(source).toEqual({
      character: { display_name: 'Marcus', the_mask: 'effortless', voice_signature: { register: 'dry' } },
      profile: { handle: 'marcus.k', posting_voice: 'all lowercase, no punctuation' },
    });
    expect(JSON.stringify(source)).not.toMatch(/father|lonely|private|to be seen/);
  });

  test('a stable fingerprint: key order does not matter, a change does', () => {
    const a = voiceSource(character, profile);
    const b = { profile: { posting_voice: 'all lowercase, no punctuation', handle: 'marcus.k' }, character: { voice_signature: { register: 'dry' }, the_mask: 'effortless', display_name: 'Marcus' } };
    expect(sourceHash(a)).toBe(sourceHash(b));
    expect(sourceHash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(sourceHash(voiceSource({ ...character, the_mask: 'guarded' }, profile))).not.toBe(sourceHash(a));
    // A Living State change alone is not a voice change.
    expect(sourceHash(voiceSource({ ...character, living_state: { mood: 'elated' } }, profile))).toBe(sourceHash(a));
  });

  test('needsRebuild: no voice, or a changed face', () => {
    const source = voiceSource(character, profile);
    expect(needsRebuild(null, source)).toBe(true);
    expect(needsRebuild({ source_hash: sourceHash(source) }, source)).toBe(false);
    expect(needsRebuild({ source_hash: 'old' }, source)).toBe(true);
  });
});

describe('normalizeHabits', () => {
  test('known shape, unknown keys dropped, values cleaned and capped', () => {
    const habits = normalizeHabits({
      case: 'LOWERCASE', punctuation: '  no full stops  ', emoji: { use: 'often', favorites: ['✨', '💅', '', 5] },
      sentence_length: 'short', topics: Array.from({ length: 15 }, (_, i) => `t${i}`), never_says: ['synergy'],
      signature_phrases: ['ate and left no crumbs', 'a testament to style'], extra: 'dropped',
    });
    expect(habits).toEqual({
      case: 'lowercase', punctuation: 'no full stops', emoji: { use: 'often', favorites: ['✨', '💅'] },
      sentence_length: 'short', temperament: 'regular', topics: Array.from({ length: 10 }, (_, i) => `t${i}`), never_says: ['synergy'],
      signature_phrases: ['ate and left no crumbs'],
    });
  });

  test('temperament: oversharer, regular or lurker (Task #2970)', () => {
    expect(normalizeHabits({ temperament: 'Lurker' }).temperament).toBe('lurker');
    expect(normalizeHabits({ temperament: 'chatty' }).temperament).toBe('regular');
  });

  test('defaults for anything missing or unknown', () => {
    expect(normalizeHabits({ case: 'shouting', emoji: 'often' })).toEqual({
      case: 'sentence', punctuation: '', emoji: { use: 'often', favorites: [] }, sentence_length: 'short', temperament: 'regular', topics: [], never_says: [], signature_phrases: [],
    });
  });
});

describe('addExample caps (Task #3070)', () => {
  const fakeVoice = (examples) => ({
    examples_json: examples,
    async update(fields) { Object.assign(this, fields); },
  });
  const pinned = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, text: `pinned ${i}`, kind: 'pinned' }));

  test('keeps only the newest MAX_EDIT_EXAMPLES edits, pinned untouched', async () => {
    const voice = fakeVoice(pinned(3));
    for (let i = 0; i < MAX_EDIT_EXAMPLES + 3; i += 1) await addExample(voice, { text: `edit ${i}`, kind: 'edit', postId: `post-${i}` });
    const edits = voice.examples_json.filter((e) => e.kind === 'edit');
    expect(edits).toHaveLength(MAX_EDIT_EXAMPLES);
    expect(edits[0].text).toBe(`edit ${MAX_EDIT_EXAMPLES + 2}`);
    expect(edits.map((e) => e.text)).not.toContain('edit 0');
    expect(voice.examples_json.filter((e) => e.kind === 'pinned')).toHaveLength(3);
  });

  test('an edit never pushes out a pinned example when the list is full', async () => {
    const voice = fakeVoice([...pinned(MAX_EXAMPLES - 1), { id: 'e-old', text: 'old edit', kind: 'edit' }]);
    await addExample(voice, { text: 'new edit', kind: 'edit', commentId: 'c-1' });
    expect(voice.examples_json).toHaveLength(MAX_EXAMPLES);
    expect(voice.examples_json.filter((e) => e.kind === 'pinned')).toHaveLength(MAX_EXAMPLES - 1);
    expect(voice.examples_json[0]).toMatchObject({ text: 'new edit', kind: 'edit', comment_id: 'c-1' });
    expect(voice.examples_json.map((e) => e.id)).not.toContain('e-old');
  });

  test('the same comment is refused twice', async () => {
    const voice = fakeVoice([]);
    await addExample(voice, { text: 'x', kind: 'edit', commentId: 'c-2' });
    await expect(addExample(voice, { text: 'y', kind: 'edit', commentId: 'c-2' })).rejects.toMatchObject({ status: 409 });
  });
});
