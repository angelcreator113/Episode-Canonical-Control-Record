// A phone and a script for the needs tests (lib and EpisodePhoneNeeds): Mail
// reached from home, an Invitation nothing reaches with an empty content
// zone, a Closet with no picture, and a Bank the phone lacks.
export const PHONE = [
  { id: 'home', name: 'Homepage', category: 'phone', is_home: true, generated: true, url: 'https://x/home.png', asset_id: 'a-home',
    screen_links: [{ id: 'z-mail', label: 'Mail', target: 'mail', x: 5, y: 5, w: 20, h: 20 }] },
  { id: 'mail', name: 'Mail', category: 'phone', generated: true, url: 'https://x/mail.png', asset_id: 'a-mail', screen_links: [] },
  { id: 'invitation', name: 'Invitation', category: 'phone', generated: true, url: 'https://x/inv.png', asset_id: 'a-inv',
    content_zones: [{ id: 'cz1', content_type: 'event_invite', x: 0, y: 0, w: 100, h: 50 }] },
  { id: 'closet', name: 'Closet', category: 'phone', generated: false, url: null, asset_id: null },
  { id: 'hud', name: 'HUD Bar', category: 'production', generated: true, url: 'https://x/hud.png' },
];

export const SCRIPT = [
  '## BEAT: 4 · Interruption Pulse 1',
  '[UI:CLICK Mail]',
  '[UI:NOTIFY Bestie: are you coming?]',
  '## BEAT: 5 · Reveal',
  '[UI:OPEN InvitationScreen]',
  '[UI:CLICK Mail]',
  '## BEAT: 8 · Transformation Loop',
  '[UI:OPEN Closet]',
  '[UI:OPEN Bank Page]',
  '[UI:DISPLAY HUD Bar]',
  '## BEAT: 12 · Fashion Challenge',
  '[UI:OPEN Camera]',
].join('\n');
