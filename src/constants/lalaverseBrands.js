'use strict';

/**
 * The six LalaVerse brands as the app established them (moved unchanged from
 * routes/wardrobeBrands.js, 2026-10-18). This is the brands' established
 * canon (Evoni, 2026-10-18, the Brand Canon Protection Rule: "the
 * Personality Engine can expand a brand's voice, relationships,
 * motivations, campaign ideas, and representative personalities, but it
 * cannot independently change the brand's established industry, niche,
 * products, or mission"). Their personalities are constants/brandPersonalities.
 */

const LALAVERSE_BRANDS_SEED = Object.freeze([
  {
    slug:        'velour_atelier',
    name:        'Velour Atelier',
    type:        'lalaverse',
    category:    'fashion',
    description: 'The house of record for LalaVerse events. Clean silhouettes, elevated fabrication, structured luxury. The brand Lala reaches for when the room matters.',
    aesthetic:   'Architectural minimalism. Ivory, bone, deep black. Nothing extraneous.',
    niche:       'Event and occasion dressing for women who arrive having already decided.',
    founder:     'A woman who built it after being told her taste was too specific.',
    press_angle: 'The decision a Velour piece represents -- not the garment, the choice.',
  },
  {
    slug:        'ori_beauty',
    name:        'Ori Beauty',
    type:        'lalaverse',
    category:    'beauty',
    description: 'Skincare and cosmetics built for melanin-rich skin. Deep knowledge of formulation. The brand that existed before the mainstream noticed the market.',
    aesthetic:   'Clean, warm, science-backed. The packaging is honest.',
    niche:       'Luxury skincare for Black women who have been underserved by luxury beauty.',
    founder:     'A cosmetic chemist who started making her own formulations because nothing worked.',
    press_angle: 'What it means to build a beauty brand for the people who were there first.',
  },
  {
    slug:        'the_column',
    name:        'The Column',
    type:        'lalaverse',
    category:    'fashion',
    description: 'Elevated basics. The wardrobe infrastructure. Pieces that go under everything and next to nothing -- both perfectly.',
    aesthetic:   'Quiet. Precise. The kind of piece you don\'t notice because it\'s exactly right.',
    niche:       'The foundation layer of a wardrobe built with intention.',
    founder:     'A stylist who got tired of not finding the piece she was describing to clients.',
    press_angle: 'The philosophy of building a wardrobe versus accumulating one.',
  },
  {
    slug:        'aura_fragrance',
    name:        'Aura Fragrance',
    type:        'lalaverse',
    category:    'beauty',
    description: 'Indie fragrance house. Warm, specific, uncommon. Built on the tradition of fragrance in Black and African diaspora culture -- oud, amber, warm florals done with restraint.',
    aesthetic:   'Warm darkness. Something you can\'t quite place but immediately recognize.',
    niche:       'Fragrance as identity -- specific, personal, not for everyone.',
    founder:     'A perfumer trained in Grasse who came home and made something her grandmother would have worn.',
    press_angle: 'The politics and poetry of scent. What it means to smell like yourself.',
  },
  {
    slug:        'first_light_studio',
    name:        'First Light Studio',
    type:        'lalaverse',
    category:    'lifestyle',
    description: 'Creative tools and accessories for the woman building something. Notebooks, desk objects, the things that surround the work.',
    aesthetic:   'Warm minimal. The things you want next to you when you\'re creating.',
    niche:       'The material culture of building -- what surrounds the creator.',
    founder:     'A graphic designer who wanted her workspace to feel like her work.',
    press_angle: 'What you surround yourself with when you\'re building something from nothing.',
  },
  {
    slug:        'carte_blanche',
    name:        'Carte Blanche',
    type:        'lalaverse',
    category:    'fashion',
    description: 'Statement pieces for specific moments. Not everyday. Not for everyone. The piece you wear when you\'ve decided something.',
    aesthetic:   'Bold structure. Rich color. Intentional drama without noise.',
    niche:       'The piece you put on when you\'re ready to be seen.',
    founder:     'A designer who started making clothes after a decade of dressing other people.',
    press_angle: 'What it means to dress for a decision rather than an occasion.',
  },
]);

module.exports = { LALAVERSE_BRANDS_SEED };
