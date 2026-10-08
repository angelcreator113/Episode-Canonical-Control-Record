/** The character page's rows and sentences (lib/characterPage). */
import { describe, test, expect } from 'vitest';
import { depthOf, cityLabel, archetypeOf, showUpRows, withLala, voiceOf } from './characterPage';

const APPEARANCES = {
  linked: true,
  events: [{
    id: 'ev1', show_id: 'show1', name: 'Wearable Experiments Studio Session', role: 'host', event_date: 'Nov 12', venue_name: 'Echo Park',
    is_paid: true, payment_amount: 439, goals: [{ slot: 'relationship_host', label: 'Follow up with STUDIO BY SABLE after the event' }],
    episode: { id: 'ep1', episode_number: 1, title: 'I Designed My Outfit' },
  }],
  episodes: [{ id: 'ep1', episode_number: 1, title: 'I Designed My Outfit' }],
  place: { id: 'loc1', name: "STUDIO BY SABLE's Studio", residents: 1, scene_sets: 3 },
  feed: { posts: 4, lala_relationship: 'direct' },
};

describe('the character page', () => {
  test('depth: where they are and what comes next', () => {
    expect(depthOf('breathing')).toMatchObject({ index: 1, step: { label: 'Breathing' }, next: { label: 'Active' } });
    expect(depthOf('alive').next).toBeNull();
    expect(depthOf(undefined).index).toBe(0);
  });

  test('labels', () => {
    expect(cityLabel('echo_park')).toBe('Echo Park');
    expect(cityLabel(null)).toBeNull();
    expect(archetypeOf({ society_archetype: 'the_peer', archetype: 'soft_life' })).toBe('The peer');
  });

  test('where they show up: the event, place, episode, goal and feed, each with where it opens', () => {
    const rows = showUpRows(APPEARANCES, { id: 7, feed_layer: 'lalaverse' });
    expect(rows.map((r) => [r.label, r.title, r.sub, r.to])).toEqual([
      ['Event', 'Organizes Wearable Experiments Studio Session', 'Nov 12 · Echo Park', '/shows/show1/events/ev1'],
      ['Place', "Lives at STUDIO BY SABLE's Studio", '1 resident · 3 scene sets', '/universe?tab=world&sub=locations'],
      ['Episode', 'In Episode 1', 'I Designed My Outfit', '/episodes/ep1'],
      ["Lala's goal", 'Follow up with STUDIO BY SABLE after the event', 'From the event deal', '/episodes/ep1'],
      ['Feed', 'Friends with Lala', '4 posts', '/feed?profile=7&layer=lalaverse'],
    ]);
    expect(showUpRows({ linked: false })).toEqual([]);
  });

  test('with Lala: the event they share, the pay and the goal; else the feed tie', () => {
    expect(withLala(APPEARANCES)).toBe('Invited Lala to Wearable Experiments Studio Session and is paying her 439 coins. Lala wants to follow up with STUDIO BY SABLE after the event.');
    expect(withLala({ events: [{ name: 'Gala', role: 'guest', goals: [] }] })).toBe('At Gala with Lala.');
    expect(withLala({ events: [], feed: { lala_relationship: 'competitive' } })).toBe("Lala's rival.");
    expect(withLala({ events: [] })).toBeNull();
  });

  test('their voice: a sample post, the habit, a phrase and what they never say outright', () => {
    const voice = voiceOf(
      { voice_signature: JSON.stringify({ catchphrases: ['make it wearable'], internal_monologue_style: 'that they are scared' }) },
      { sample_captions: [{ text: 'New drop, come play.' }], posting_voice: 'all lowercase' },
    );
    expect(voice).toEqual({ sample: 'New drop, come play.', habit: 'all lowercase', phrase: 'make it wearable', neverSays: 'that they are scared' });
    expect(voiceOf({}, null)).toBeNull();
  });
});
