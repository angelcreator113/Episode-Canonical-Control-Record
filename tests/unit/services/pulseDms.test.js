// The DM drafter's prompt and pair order (Task #2984; The Pulse spec §3).
const { buildPrompt, pairOf } = require('../../../src/services/pulseDms');

const sender = {
  profile: { id: 1, handle: 'lala', display_name: 'Lala' },
  voice: { habits_json: { case: 'lowercase' }, examples_json: [{ text: 'ok but who approved beige' }] },
  character: { living_state: { worry: 'the brand deal falling through' } },
};
const other = { id: 7, handle: 'marcus.k', display_name: 'Marcus' };

test('the pair is lower id first', () => {
  expect(pairOf(7, 1)).toEqual([1, 7]);
});

test('the conversation so far, as You and Them, with the topic and the moment', () => {
  const prompt = buildPrompt({
    sender, other, topic: 'the afterparty', label: 'Ep 1 · After',
    history: [{ sender_profile_id: 1, text: 'u up?' }, { sender_profile_id: 7, text: 'always' }],
  });
  expect(prompt).toContain('as Lala (@lala), to Marcus (@marcus.k)');
  expect(prompt).toContain('You: u up?\nThem: always');
  expect(prompt).toContain('What the conversation is about: the afterparty.');
  expect(prompt).toContain('When: Ep 1 · After.');
  expect(prompt).toContain('ok but who approved beige');
});

test('Living State appears only as private context, after the conversation', () => {
  const prompt = buildPrompt({ sender, other, history: [], topic: null, label: null });
  expect(prompt).toContain('(nothing yet: you write first)');
  // The private block's rule is shared with the drafter; since Task #3088 it also covers what they privately know.
  const { PRIVATE_RULE } = require('../../../src/services/pulseDrafter');
  expect(PRIVATE_RULE).toMatch(/^PRIVATE \(shapes the mood only; never state, quote or hint at it directly\. What they privately know is not public/);
  const privateAt = prompt.indexOf(PRIVATE_RULE);
  expect(privateAt).toBeGreaterThan(-1);
  expect(privateAt).toBeGreaterThan(prompt.indexOf('The conversation so far:'));
  expect(prompt.indexOf('the brand deal falling through')).toBeGreaterThan(privateAt);
  expect(prompt.split('the brand deal falling through')).toHaveLength(2);
});
