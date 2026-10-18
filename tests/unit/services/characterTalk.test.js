/**
 * Talk (services/characterTalk): who can be talked to, what the character is
 * told, and that the sessions stay confidential: no code but the Talk
 * service (and its migration) reads character_conversations.
 */
const fs = require('fs');
const path = require('path');
const talk = require('../../../src/services/characterTalk');

describe('characterTalk', () => {
  test('a character in Lala\'s world can be talked to; JustAWoman\'s people and Dr. Sinclair cannot', () => {
    expect(talk.canTalk({ world: 'lalaverse', character_key: 'lala' })).toBe(true);
    expect(talk.canTalk({ world: null }, { feed_layer: 'lalaverse' })).toBe(true);
    expect(talk.canTalk({ world: 'book-1' })).toBe(false);
    expect(talk.canTalk({ world: null }, { feed_layer: 'real_world' })).toBe(false);
    expect(talk.canTalk({ world: null })).toBe(false);
    expect(talk.canTalk({ world: 'lalaverse', character_key: 'amara_sinclair' })).toBe(false);
    expect(talk.canTalk({ world: 'lalaverse', extra_fields: { classification: 'confidential_professional' } })).toBe(false);
  });

  test('the character is told who Dr. Sinclair is, that the room is confidential, and to stay inside their file', () => {
    const prompt = talk.buildTalkPrompt({ name: 'Lala', fileBlock: 'THE CHARACTER FILE for Lala', worldLine: 'World: the LalaVerse.', brand: '', notes: ['She wants approval.'] });
    expect(prompt).toContain('your therapist, Dr. Amara Sinclair, at The Quiet Room');
    expect(prompt).toContain('This room is confidential');
    expect(prompt).toContain('Never name a real-world app, and never name JustAWoman');
    expect(prompt).toContain('Do not invent new events, people, deals or facts');
    expect(prompt).toContain('- She wants approval.');
  });

  test('only the inner-life fields she can apply are suggested, and each kind has its actions', () => {
    expect(talk.INNER_FIELDS).toEqual(['core_desire', 'core_fear', 'core_wound', 'hidden_want', 'blind_spot', 'self_narrative']);
    expect(talk.ACTIONS).toEqual({ inner: ['apply', 'dismiss'], secret: ['send', 'dismiss'], insight: ['keep', 'dismiss'] });
  });

  test('the sessions are confidential: only the Talk service and its migration read character_conversations', () => {
    const root = path.join(__dirname, '../../../src');
    const hits = [];
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith('.js') && fs.readFileSync(p, 'utf8').includes('character_conversations')) hits.push(path.relative(root, p));
      }
    };
    walk(root);
    expect(hits.sort()).toEqual(['migrations/20261018150000-character-conversations.js', 'services/characterTalk.js']);
  });
});
