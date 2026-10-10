/**
 * The public site's static copy and settings
 * (docs/design/2026-10-landing-and-stylesheet.md Part 1). Static: the
 * landing page makes no calls to the app's API.
 *
 * HERO_MAP is the exported LalaVerse map, bundled from src/assets/landing/
 * once Evoni supplies it; until then it is null and the hero shows its plum
 * gradient alone [placeholder].
 */

// In-page anchors, never routes: /shows/* is the private producer app and
// no public /lalaverse route exists (spec "Open naming question").
export const SECTION_IDS = Object.freeze({
  flagship: 'flagship',
  world: 'our-world',
  featured: 'featured-production',
  studio: 'inside-prime-studios',
  collaborate: 'collaborate',
  contact: 'contact',
});

export const NAV_LINKS = Object.freeze([
  { label: 'Our World', href: `#${SECTION_IDS.world}` },
  { label: 'Productions', href: `#${SECTION_IDS.featured}` },
  { label: 'Collaborate', href: `#${SECTION_IDS.collaborate}` },
]);

export const LOGIN_PATH = '/login';

export const HERO = Object.freeze({
  eyebrow: 'AN ORIGINAL ENTERTAINMENT UNIVERSE',
  heading: 'Where Fashion Becomes a World.',
  body: 'At Prime Studios, we create character-driven entertainment where fashion, storytelling, and immersive worlds come together. From unforgettable characters to glamorous events and evolving storylines, every detail is designed to become part of something bigger.',
  primary: 'Explore Our Universe',
  secondary: 'Watch Our Vision',
});

// [placeholder] The exported map, e.g. `import map from '../../assets/landing/lalaverse-map.webp'`.
export const HERO_MAP = null;
export const HERO_MAP_ALT = 'The LalaVerse map: five cities along the water';

// ── Sections 3–8 (Task #2809). All copy is the blueprint's final copy;
// brand card titles are working titles. Images marked null are
// [placeholder] slots until Evoni supplies approved art.

// [placeholder] Evoni supplies the address; until then the contact
// buttons point at this obviously-invalid one.
export const CONTACT_EMAIL = 'contact@prime-studios.invalid';
export const mailto = (subject) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const FLAGSHIP = Object.freeze({
  eyebrow: 'Our flagship production',
  heading: 'Styling Adventures with Lala',
  tagline: "She's got the style. She's got the ambition. And every invitation comes with a story.",
  body: 'Follow Lala as she navigates fashion, friendships, opportunities, and unexpected twists in a world where appearances matter—but choices matter more. Every outfit tells a story. Every event creates a new possibility. And every adventure leaves its mark on the world around her.',
  button: 'Discover the Show',
  image: null,
  imageLabel: 'Approved Lala art',
});

export const WORLD = Object.freeze({
  eyebrow: 'A world built for stories',
  heading: 'Fashion is just the beginning.',
  pillars: [
    { key: 'fashion', title: 'Fashion With Meaning', body: 'In LaLaVerse, clothing is more than decoration. Every look reflects personality, ambition, occasion, and the moments that define a character.', image: null, imageLabel: "Lala's closet" },
    { key: 'characters', title: 'Characters With Lives', body: 'Our characters have relationships, goals, reputations, and stories that evolve. What happens today can shape tomorrow.', image: null, imageLabel: 'Approved character art' },
    { key: 'places', title: 'Places Worth Exploring', body: 'From fashionable districts to exclusive events and intimate gathering places, LaLaVerse is a growing world with its own personality.', image: null, imageLabel: "Lala's home" },
  ],
});

export const STUDIO = Object.freeze({
  eyebrow: 'Inside Prime Studios',
  heading: 'One World. Many Ways In.',
  line: "We aren't simply producing individual episodes. We're building a world where stories can continue, characters can grow, and audiences can discover something new.",
  button: 'Discover the Studio',
  cards: [
    { key: 'world', title: 'A World of Its Own', body: 'LaLaVerse has five cities, a social network its characters really post on, and people who remember what happened last time. Every episode adds to it.', image: null, imageLabel: 'LalaVerse map art' },
    { key: 'books', title: 'The Book Series', body: 'Before Lala tells the story in novels, so you can go deeper than the screen allows.', image: null, imageLabel: 'Cover art' },
    { key: 'studio', title: 'Made in Our Own Studio', body: 'Written, styled and edited in-house, from the first invitation to the final cut.', image: null, imageLabel: 'Behind the scenes' },
    { key: 'fashion', title: 'Fashion as Storytelling', body: 'Every look is a choice that changes the story. Each episode gets its own style sheet.', image: null, imageLabel: "Lala's closet" },
  ],
});

export const COLLABORATE = Object.freeze({
  eyebrow: 'Collaborate with Prime Studios',
  heading: "There's Room for Your Magic.",
  body: "Great entertainment is built through creative collaboration. We're interested in connecting with people and organizations who share our passion for storytelling, fashion, and innovative experiences.",
  button: 'Explore Collaboration Opportunities',
  cards: [
    { key: 'talent', tone: 'blush', title: 'Creative Talent', body: 'Stylists, designers, artists, musicians, writers, and creative professionals who bring fresh ideas and distinctive perspectives.' },
    { key: 'brands', tone: 'champagne', title: 'Brands & Partnerships', body: 'Fashion, beauty, lifestyle, and entertainment brands interested in exploring story-driven creative collaborations.' },
    { key: 'production', tone: 'ice', title: 'Production & Technology', body: 'Animators, developers, production specialists, and creative technology partners who want to help build ambitious entertainment experiences.' },
  ],
});

export const CLOSING = Object.freeze({
  heading: "Let's Create Something Unforgettable.",
  body: "The next chapter starts with a conversation. Whether you're a creative professional, potential brand partner, or simply curious about what we're building, we'd love to hear from you.",
  button: 'Start a Conversation',
  footer: 'Prime Studios — The Creative Home of LaLaVerse.',
});
