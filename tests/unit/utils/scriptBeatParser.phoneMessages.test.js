/**
 * Script phone moments (Task #2885): [UI:NOTIFY Sender: text],
 * [UI:DM Partner: text] and [UI:POST text] parse as UI actions with who
 * and the words, alongside the verbs the parser already knew.
 */
const { parseScript, normalizeUiAction, UI_ACTION_TYPES } = require('../../../src/utils/scriptBeatParser');

describe('script parser: notifications, DMs and posts', () => {
  test('the verbs normalise', () => {
    expect(normalizeUiAction('NOTIFY')).toBe('notification');
    expect(normalizeUiAction('DM')).toBe('dm');
    expect(normalizeUiAction('POST')).toBe('post');
    expect(UI_ACTION_TYPES).toEqual(expect.arrayContaining(['notification', 'dm', 'post']));
  });

  test('each parses with who and the words', () => {
    const script = [
      '## BEAT: 4 · Interruption Pulse 1',
      '[UI:NOTIFY STUDIO BY SABLE: You are invited]',
      '[UI:DM Maya: Are you going tonight?]',
      '## BEAT: 12 · Deliverable Creation',
      '[UI:POST Studio night, statement look.]',
      '[UI:OPEN Closet]',
    ].join('\n');
    const out = parseScript(script);
    const ui = out.ui_actions.map((a) => [a.type, a.metadata]);
    expect(ui).toEqual([
      ['notification', { from: 'STUDIO BY SABLE', text: 'You are invited' }],
      ['dm', { with: 'Maya', text: 'Are you going tonight?' }],
      ['post', { text: 'Studio night, statement look.' }],
      ['open', {}],
    ]);
  });

  test('a notification with no sender keeps its words', () => {
    const out = parseScript('## BEAT: 4 · Interruption Pulse 1\n[UI:NOTIFY Payday]');
    expect(out.ui_actions[0]).toMatchObject({ type: 'notification', metadata: { text: 'Payday' } });
  });
});
