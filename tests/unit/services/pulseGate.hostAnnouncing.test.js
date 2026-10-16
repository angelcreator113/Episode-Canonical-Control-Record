/**
 * Hosts announce their own events (Evoni, 2026-10-15): a post by an event's
 * host, once the event is announced (its episode's 'announced' moment) and
 * before it happens, is not flagged future_event. Anyone else's mention of a
 * coming event still is.
 */
jest.mock('@anthropic-ai/sdk', () => function Anthropic() { return { messages: { create: jest.fn() } }; });
const { hostAnnouncing } = require('../../../src/services/pulseGate');
const { orderOf } = require('../../../src/services/storyClock');
const { eventCreatorOrganizer } = require('../../../src/utils/eventOrganizer');

const GALA = { id: 'ev1', name: 'Velvet Hour', episode_number: 3, host_profile_id: 7 };

test('the host, at or after the announcement: allowed', () => {
  expect(hostAnnouncing(GALA, { social_profile_id: 7 }, orderOf(3, 'announced'), orderOf)).toBe(true);
  expect(hostAnnouncing(GALA, { social_profile_id: '7' }, orderOf(3, 'invitation_sent'), orderOf)).toBe(true);
});

test('the host before the announcement, someone else, or a brand event: still flagged', () => {
  expect(hostAnnouncing(GALA, { social_profile_id: 7 }, orderOf(3, 'before_episode'), orderOf)).toBe(false);
  expect(hostAnnouncing(GALA, { social_profile_id: 7 }, orderOf(2, 'after_episode'), orderOf)).toBe(false);
  expect(hostAnnouncing(GALA, { social_profile_id: 8 }, orderOf(3, 'announced'), orderOf)).toBe(false);
  expect(hostAnnouncing({ ...GALA, host_profile_id: null }, { social_profile_id: 7 }, orderOf(3, 'announced'), orderOf)).toBe(false);
});

test('the event host is the organizer field, else the automation copy', () => {
  expect(eventCreatorOrganizer({ source_profile_id: 7 }).profileId).toBe(7);
  expect(eventCreatorOrganizer({ canon_consequences: { automation: { host_profile_id: 9 } } }).profileId).toBe(9);
});

test('the gate waives future_event only through hostAnnouncing', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', '..', 'src', 'services', 'pulseGate.js'), 'utf8');
  expect(src).toMatch(/> at && !hostAnnouncing\(ev, post, at, orderOf\)\) \{ flags\.push\(\{ code: 'future_event'/);
  const knowledge = require('fs').readFileSync(require('path').join(__dirname, '..', '..', '..', 'src', 'services', 'pulseKnowledge.js'), 'utf8');
  expect(knowledge).toMatch(/host_profile_id: hostProfileId\(r\)/);
});
