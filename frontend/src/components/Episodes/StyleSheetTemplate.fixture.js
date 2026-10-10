/** Episode 1's style sheet as the spec's reference values give it (Task #2814). */
export const EPISODE_ONE = {
  episode: { number: 1, label: 'EPISODE 01', title: 'Wearable Experiments' },
  event: {
    name: 'Wearable Experiments Studio Session', host: 'STUDIO BY SABLE', type: 'Studio session',
    dress_code: 'elevated contemporary, smart-casual', when: 'Thu, Nov 12, 6:30 PM',
    vibe: 'statement, modern, elevated, sophisticated, creative',
    keywords: ['statement', 'modern', 'elevated', 'sophisticated', 'creative'],
  },
  venue: { name: "STUDIO BY SABLE's Studio", chip: 'Echo Park', image: null, options: [] },
  look: { front: null, side: null, back: null, hero: null },
  wardrobe: { state: 'chosen', columns: [
    { key: 'body', label: 'BODY', name: null, image: null, needed: true },
    { key: 'shoes', label: 'SHOES', name: 'Crimson Satin Ballerina Pump', image: 'data:image/png;base64,AA', needed: false },
    { key: 'bag', label: 'BAG', name: null, image: null, needed: false },
    { key: 'jewelry', label: 'JEWELRY', name: 'Crimson Bloom Enamel Stud Earrings', image: null, needed: false },
    { key: 'hair', label: 'HAIR', name: null, image: null, needed: false },
    { key: 'perfume', label: 'PERFUME', name: null, image: null, needed: false },
    { key: 'nails', label: 'NAILS', name: null, image: null, needed: false },
  ] },
  beauty: { eyes: null, lips: null, skin: null, nails: null, notes: {} },
  palette: null,
  mood_words: ['statement', 'modern', 'elevated', 'sophisticated', 'creative'],
  tagline: null,
  inspo: { photos: [], textures: [] },
};
