// Teleprompter batch 3 wears tokens only (Evoni, 2026-10-20): the phone
// remote's page and stylesheet, the remote panel and the voice recorder carry
// no colour literal.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stripTaskRefs } from '../styles/contrast';

const files = [
  'TeleprompterRemote.css', 'TeleprompterRemote.jsx',
  '../components/Teleprompter/TeleprompterRemotePanel.jsx', '../components/Teleprompter/VoiceRecord.jsx',
].map((f) => [f, readFileSync(resolve(__dirname, f), 'utf8')]);
const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

describe('Teleprompter batch 3 theme', () => {
  test.each(files)('%s has no colour literal', (_name, text) => {
    expect(stripTaskRefs(text)).not.toMatch(COLOUR);
  });
});
