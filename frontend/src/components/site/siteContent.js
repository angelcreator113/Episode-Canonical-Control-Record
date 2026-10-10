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
  world: 'our-world',
  featured: 'featured-production',
  collaborate: 'collaborate',
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
