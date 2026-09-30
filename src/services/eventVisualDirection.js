'use strict';

/**
 * An event's visual direction: the look its invitation is designed in
 * (theme preset, prestige richness, colour palette), in one place so every
 * image made for the event's episode can carry the same look (Task #2386,
 * ruling P11: "the invitation and title look like one production").
 *
 * Moved unchanged from invitationGeneratorService.buildBackgroundPrompt,
 * which now reads it from here:
 *   - theme:     detectTheme(event) (event.theme, else the dress code /
 *                dress_code_keywords / mood keyword vote), mapped to
 *                THEME_PRESETS; no match uses DEFAULT_THEME;
 *   - richness:  from event.prestige (default 5);
 *   - palette:   event.color_palette.
 *
 * Pure: no database, no network.
 */

const { detectTheme } = require('./invitationCompositingService');

const THEME_PRESETS = {
  'honey luxe': {
    background: 'warm honey cream with golden silk texture, subtle amber glow emanating from center',
    border: 'delicate ornamental gold foil border with honey-toned curved corners and fine filigree',
    florals: 'soft honey-toned peonies and cream roses scattered in corners, light and delicate',
    atmosphere: 'warm candlelight glow, golden hour warmth',
  },
  'avant-garde': {
    background: 'ivory with subtle black marble veining, cool and precise',
    border: 'thin asymmetric black border with single gold corner accent',
    florals: 'single sculptural black orchid silhouette, minimal',
    atmosphere: 'crisp studio lighting, high contrast',
  },
  'soft glam': {
    background: 'blush pink with delicate silk sheen, rose gold undertones and gentle shimmer',
    border: 'rose gold foil border with soft curved ornamental edges and small floral details',
    florals: 'soft pink roses and white peonies, ethereal and romantic, corners and sides',
    atmosphere: 'soft warm pink glow, dreamy and aspirational',
  },
  'romantic garden': {
    background: 'soft sage green with ivory overlay, garden party elegance',
    border: 'delicate floral wreath border in blush, ivory, and sage green',
    florals: 'lush garden roses, ranunculus, eucalyptus, full bloom abundance',
    atmosphere: 'dappled golden sunlight, outdoor warmth',
  },
  'luxury intimate': {
    background: 'deep champagne with velvet texture suggestion, warm and enveloping',
    border: 'thin double-line gold border, understated luxury',
    florals: 'single camellia or gardenia, centered and minimal',
    atmosphere: 'intimate candlelight glow, evening warmth, soft shadows',
  },
  'formal glamour': {
    background: 'cream white with subtle pearl sheen, pristine and elevated',
    border: 'ornate classical gold filigree border with corner medallions',
    florals: 'white orchids and gold-tipped leaves, architectural placement',
    atmosphere: 'crisp bright light with gold accents, formal and polished',
  },
  'chic minimal': {
    background: 'pure cream, hairline texture, clean and breathable',
    border: 'single thin black line border, architectural precision',
    florals: 'single thin botanical line drawing, one corner only',
    atmosphere: 'clean studio light, maximum negative space',
  },
  'power fashion': {
    background: 'ivory with subtle black marble veining, statement material',
    border: 'bold black border with gold corner accents, commanding',
    florals: 'architectural black florals or none',
    atmosphere: 'high-contrast editorial lighting, bold and confident',
  },
};

const DEFAULT_THEME = {
  background: 'soft cream ivory with subtle silk texture and marble undertone',
  border: 'elegant gold foil border with ornamental curved edges and fine filigree details',
  florals: 'soft blush roses and ivory peonies, delicately placed in corners',
  atmosphere: 'warm golden light from center, luxurious and aspirational',
};

function richnessFor(prestige) {
  if (prestige >= 8) return 'Maximum luxury — gold accents are rich and opulent';
  if (prestige >= 5) return 'Refined elegance — gold accents are tasteful and considered';
  return 'Understated — minimal decoration, clean and simple';
}

/**
 * The event's visual direction, as its invitation uses it.
 * @returns {{ theme: string, background, border, florals, atmosphere,
 *             richness: string, palette: string[] }}
 */
function deriveEventVisualDirection(event) {
  const ev = event || {};
  const themeName = detectTheme(ev);
  const preset = (themeName && THEME_PRESETS[themeName]) || DEFAULT_THEME;
  const palette = Array.isArray(ev.color_palette) ? ev.color_palette : [];
  return {
    theme: (themeName && THEME_PRESETS[themeName]) ? themeName : 'default',
    background: preset.background,
    border: preset.border,
    florals: preset.florals,
    atmosphere: preset.atmosphere,
    richness: richnessFor(ev.prestige || 5),
    palette,
  };
}

module.exports = { deriveEventVisualDirection, THEME_PRESETS, DEFAULT_THEME };
