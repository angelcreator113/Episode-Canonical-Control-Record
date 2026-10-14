/**
 * The Voice icon, found by key or name (Task #3163).
 */
import { test, expect } from 'vitest';
import { isVoiceIcon, isVoiceZone, VOICE_TOAST } from './phoneVoice';

const I = (id, name, extra = {}) => ({ id, name, category: 'phone_icon', url: `https://x/${id}.png`, ...extra });

test('the Voice icon by key or name; never a screen, never a near miss', () => {
  for (const icon of [I('talking_icon', 'Talking icon'), I('voice', 'Voice'), I('icon_7', 'Speak'), I('lala-talk', 'Lala')]) {
    expect([icon.id, isVoiceIcon(icon)]).toEqual([icon.id, true]);
  }
  for (const icon of [I('the_pulse', 'The Pulse'), I('phone', 'Phone'), I('invoice_icon', 'Invoices'), I('talkative', 'Chatty'),
    { id: 'voice_page', name: 'Voice page', category: 'phone' }, null]) {
    expect([icon?.id, isVoiceIcon(icon)]).toEqual([icon?.id, false]);
  }
  expect(VOICE_TOAST).toBe('Lala speaks');
});

test('a zone is a Voice zone when placed from the Voice icon, by key or by image', () => {
  const icons = [I('talking_icon', 'Talking icon'), I('messages_icon', 'Messages icon')];
  expect(isVoiceZone({ icon_overlay_id: 'talking_icon' }, icons)).toBe(true);
  expect(isVoiceZone({ icon_url: 'https://x/talking_icon.png' }, icons)).toBe(true);
  expect(isVoiceZone({ icon_overlay_id: 'messages_icon' }, icons)).toBe(false);
  expect(isVoiceZone({ target: 'voice' }, icons)).toBe(false);
  expect(isVoiceZone(null, icons)).toBe(false);
});
