/**
 * Two show rules (Evoni, 2026-10-17): Lala talks only after her voice icon
 * is clicked, unless she answers a notification or message or is being
 * dressed; beat 5 shows the invitation letter, never the login screen. The
 * server's copy (src/utils/scriptShowRules.js) is the same code.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as rules from './scriptShowRules';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/scriptShowRules.js');
const ON = {
  screens: [{ id: 'homepage', name: 'Homepage', is_home: true }, { id: 'InviteLetterOverlay', name: 'Invitation', category: 'phone' }],
  icons: [{ key: 'voice', name: 'Lala Voice Icon' }],
};

describe("Lala's voice", () => {
  test('each line she says needs its own click', () => {
    // Per line, not per beat (Evoni, 2026-10-17).
    expect(rules.voiceOffLines(['Me: hi', 'Lala: hello', 'Lala: again'])).toEqual([1, 2]);
    expect(rules.voiceOffLines(['[UI:CLICK Lala Voice Icon]', 'Lala: hello', 'Me: ok', 'Lala: again'])).toEqual([3]);
    expect(rules.voiceOffLines(['[UI:CLICK Lala Voice Icon]', 'Lala: hello', '[UI:CLICK Lala Voice Icon]', 'Lala: again'])).toEqual([]);
    expect(rules.beatWithVoiceClicks(['Lala: hello', 'Lala: again'], 'Voice Icon').lines)
      .toEqual(['[UI:CLICK Voice Icon]', 'Lala: hello', '[UI:CLICK Voice Icon]', 'Lala: again']);
  });
  test('a notification or message, and being dressed, need no click', () => {
    expect(rules.voiceOffLines(['[UI:NOTIFY Mira: you up?]', 'Lala: who is this'])).toEqual([]);
    // The notification covers the line answering it, not the next one.
    expect(rules.voiceOffLines(['[UI:NOTIFY Mira: you up?]', 'Lala: who is this', 'Lala: anyway'])).toEqual([2]);
    expect(rules.voiceOffLines(['[UI:DM Mira: hey]', 'Lala: hey'])).toEqual([]);
    expect(rules.voiceOffLines(['[MAIL: invite]', 'Lala: mail!'])).toEqual([]);
    expect(rules.voiceOffLines(['[UI:OPEN Closet]', 'Lala: the gold one'])).toEqual([]);
    expect(rules.voiceOffLines(['Lala: this one', '[WEAR: piece-1]'])).toEqual([]);
  });
  test('her thoughts are not talking', () => {
    expect(rules.voiceOffLines(['Lala (V.O.): I hope this works'])).toEqual([]);
    expect(rules.voiceOffLines(['Lala (softly): I hope this works'])).toEqual([0]);
  });
  test('the click goes in before she starts talking, named as the show names the icon', () => {
    expect(rules.beatWithVoiceClicks(['Me: hi', 'Lala: hello'], rules.voiceIconName(ON.icons)))
      .toEqual({ lines: ['Me: hi', '[UI:CLICK Lala Voice Icon]', 'Lala: hello'], added: 1 });
    expect(rules.voiceIconName([])).toBe('Voice Icon');
  });
});

describe('beat 5 shows the invitation', () => {
  test('the login screen and the Start button are flagged, and the invitation goes in their place', () => {
    expect(rules.revealCheck(['[UI:DISPLAY Start button]', 'Me: read it'])).toEqual({ login: [0], invitation: false });
    expect(rules.revealWithInvitation(['[UI:DISPLAY Start button]', 'Me: read it'], ON).lines).toEqual(['[UI:OPEN Invitation]', 'Me: read it']);
    expect(rules.revealWithInvitation(['[UI:OPEN Login Screen]', '[UI:OPEN Invitation]'], ON).lines).toEqual(['[UI:OPEN Invitation]']);
    expect(rules.revealWithInvitation(['[UI:OPEN Invitation]', 'Me: read it'], ON)).toEqual({ lines: ['[UI:OPEN Invitation]', 'Me: read it'], changed: false });
  });
  test('a production overlay is displayed, not opened', () => {
    expect(rules.invitationLine({ production: [{ key: 'InviteLetterOverlay', label: 'Invite Letter' }] })).toBe('[UI:DISPLAY Invite Letter]');
  });
});

const SCRIPT = [
  '## BEAT: 4 · Interruption Pulse 1', 'Me: ooh', 'Lala: hi', '',
  '## BEAT: 5 · Reveal', '[UI:DISPLAY Start button]', 'Lala: wow', '',
  '## BEAT: 8 · Transformation Loop', '[UI:OPEN Closet]', 'Lala: yes',
].join('\n');

describe('the whole script', () => {
  test('fixes every beat but the approved ones', () => {
    const out = rules.scriptWithShowRules(SCRIPT, ON);
    expect(out.voice_clicks).toBe(2);
    expect(out.reveal).toBe(true);
    expect(out.script).toContain('## BEAT: 5 · Reveal\n[UI:OPEN Invitation]\n[UI:CLICK Lala Voice Icon]\nLala: wow');
    expect(out.script).toContain('## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\nLala: yes');
    const kept = rules.scriptWithShowRules(SCRIPT, ON, { skip: [1] });
    expect(kept.script).toContain('## BEAT: 5 · Reveal\n[UI:DISPLAY Start button]\nLala: wow');
    expect(kept.reveal).toBe(false);
    expect(rules.scriptWithShowRules('## BEAT: 1 · Opening Ritual\nMe: hi', ON)).toEqual({ script: '## BEAT: 1 · Opening Ritual\nMe: hi', voice_clicks: 0, reveal: false });
  });

  test("the server's copy is the same code and gives the same script", () => {
    const shared = (text) => text.slice(text.search(/^\/\/ BEGIN SHARED$/m), text.search(/^\/\/ END SHARED$/m));
    const here = readFileSync(require.resolve('./scriptShowRules.js'), 'utf8');
    const there = readFileSync(require.resolve('../../../src/utils/scriptShowRules.js'), 'utf8');
    expect(shared(there)).toBe(shared(here));
    expect(server.scriptWithShowRules(SCRIPT, ON)).toEqual(rules.scriptWithShowRules(SCRIPT, ON));
  });
});
