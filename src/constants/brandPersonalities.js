'use strict';

/**
 * The six LalaVerse brands' approved personalities and their representatives
 * (Evoni, 2026-10-18: the Brand Personality Bible with her rulings: "the
 * existing app definitions should take precedence over the new personality
 * bible"; First Light stays a lifestyle goods brand and keeps its founder;
 * Ori keeps its mission; Velour restrained, The Column wardrobe foundations,
 * Aura its Black and African diaspora heritage, Carte Blanche conviction not
 * controversy).
 *
 * The four layers of the Brand Canon Protection Rule (her ruling):
 *   established canon   constants/lalaverseBrands (category, description,
 *                       aesthetic, niche, founder, press angle). Nothing
 *                       here repeats or overrides it.
 *   approved personality BRAND_PERSONALITIES (what the BRAND believes) and
 *                       REPRESENTATIVES (what its representative believes,
 *                       a different thing: "Vivienne may personally dislike
 *                       a styling choice without that becoming an official
 *                       Velour Atelier position").
 *   creative proposals  Review, as everything else.
 *   evolving history    the fact history (character_fact_changes), with
 *                       source, story moment, reason and visibility. A
 *                       campaign discussed is not a campaign that happened.
 *
 * A representative's authority (Evoni, 2026-10-18: "creative authority and
 * financial authority must be separate. Someone might be able to approve a
 * campaign concept without being authorized to spend money or sign a
 * contract"). Each has a creative level (CREATIVE_LEVELS), a financial level
 * (FINANCIAL_LEVELS), what they may do in her words (`can`), and what needs
 * someone above them (`needs_approval`, from `escalates_to`). Every
 * representative's actions are also one of ACTION_KINDS. No founder is named
 * here: each brand's founder stays as the app describes her until Evoni
 * develops her.
 *
 * Press (her ruling): the existing press map (routes/wardrobeBrands
 * PRESS_COVERAGE_MAP) says who covers which category; the press keep their
 * own editorial judgement and owe a brand nothing.
 */

// Creative authority: concepts, messaging, styling direction, collaborators.
const CREATIVE_LEVELS = Object.freeze({
  propose: 'Can propose concepts and campaigns, and select creators to approach',
  approve: 'Can approve creative concepts, messaging, styling direction and collaborators',
});

// Financial authority, separate from creative (lowest to highest).
const FINANCIAL_LEVELS = Object.freeze({
  none: 'Cannot commit money or sign; a financial commitment goes to an authorized approver',
  negotiate: 'Can negotiate terms within an approved campaign budget',
  routine: 'Can negotiate within an approved budget and approve routine collaborations',
  full: 'Can approve partnerships, budgets and campaigns within the established business rules',
});

// What any representative may do, alone or with approval (Evoni, 2026-10-18).
const ACTION_KINDS = Object.freeze({
  autonomous: ['Brainstorm', 'Ask questions', 'Discuss opportunities', 'Draft proposals'],
  approval_required: ['Recommend a partnership', 'Negotiate proposed terms', 'Suggest a major campaign decision'],
  restricted: ['Rewrite established brand canon', 'Exceed a budget', 'Invent a finalized contract', 'Publish content without authorization'],
});
// A binding change needs both the business authority (the representative's
// levels, or their escalation) and Evoni's approval in the story.
const BINDING_RULE = 'A binding change needs the right business authority and Evoni\'s approval.';

const BRAND_PERSONALITIES = Object.freeze({
  velour_atelier: {
    direction: 'Restrained, architectural, selective, precise',
    defining_principle: 'Nothing extraneous',
    beliefs: 'Restraint is the highest expression of confidence. The brand exists because its founder was told her taste was too specific; it does not soften a choice to be liked.',
    earns_trust: ['Preparation', 'Respect for fit, proportion, material and craft', 'Tasteful presentation', 'Punctuality', 'Treating the garment well'],
    damages_trust: ['Carelessness', 'Missed deliverables', 'Poor garment treatment', 'Misrepresenting a partnership in public'],
    creator_selection: 'Highly selective. An invitation is an opportunity, not an endorsement.',
    deal_behavior: 'Formal, with strict quality control.',
    preferred_content: ['Event and occasion looks', 'Considered editorial images', 'Exclusive appearances'],
    entry_point: 'A prestigious event she has to earn her way into.',
    representative: 'vivienne_laurent',
  },
  ori_beauty: {
    direction: 'Knowledgeable advocate: nurturing, sophisticated, confident, culturally aware',
    defining_principle: 'Luxury skincare made for Black women first',
    beliefs: 'Black women have been an afterthought in luxury beauty; Ori is built for them and says so. Formulation is taken seriously and claims are made responsibly. A person\'s skin type, tone or identity never guarantees a product suits her: individual needs still decide.',
    earns_trust: ['Honest opinions, including what did not work', 'Learning the ingredients and the routine', 'Authentic representation', 'Thoughtful feedback'],
    damages_trust: ['Dishonest reviews', 'Misleading claims', 'Promoting a product without understanding it'],
    creator_selection: 'Open to emerging creators who are honest about their routine.',
    deal_behavior: 'Collaborative and flexible, careful with claims.',
    preferred_content: ['Skincare routines', 'Ingredient education', 'Product launches', 'Honest reviews', 'Beauty events'],
    entry_point: 'Trying a collection and giving her real opinion.',
    representative: 'nia_bennett',
  },
  the_column: {
    direction: 'Practical, discerning, intelligent, quietly confident',
    defining_principle: 'Build a wardrobe, don\'t accumulate one',
    beliefs: 'The right foundation piece goes unnoticed because it is exactly right. Fewer pieces, worn better. The brand\'s products come from a stylist\'s knowledge of what clients could never find.',
    earns_trust: ['Making a few pieces work harder', 'Explaining a styling choice', 'Consistency', 'An original point of view'],
    damages_trust: ['Copying trends without interpretation', 'Excess and hype', 'Buying more instead of styling better'],
    creator_selection: 'Selective about whether a creator understands her own wardrobe.',
    deal_behavior: 'Detail-oriented.',
    preferred_content: ['Capsule wardrobes', 'Styling one piece several ways', 'Wardrobe foundations'],
    entry_point: 'A styling challenge: three looks from a few pieces, and why each works.',
    representative: 'adrian_cole',
  },
  aura_fragrance: {
    direction: 'Intimate, culturally grounded, sophisticated, emotionally perceptive',
    defining_principle: 'Fragrance as identity',
    beliefs: 'Fragrance carries memory and identity. The house is built on the tradition of fragrance in Black and African diaspora culture (oud, amber, warm florals done with restraint), and that heritage is its foundation, not a marketing theme. Its founder trained in Grasse and came home to make something her grandmother would have worn.',
    earns_trust: ['Emotional storytelling', 'Subtlety', 'A personal interpretation', 'Respect for the heritage'],
    damages_trust: ['Generic promotion', 'A made-up personal story', 'Treating fragrance as decoration'],
    creator_selection: 'Selective about the story a creator can tell.',
    deal_behavior: 'Concept-driven.',
    preferred_content: ['Personal narratives', 'Cinematic campaigns', 'Scent and memory'],
    entry_point: 'A launch invitation, or a campaign built around a memory of her own.',
    representative: 'celeste_moreau',
  },
  first_light_studio: {
    direction: 'Thoughtful creative companion: warm, observant, inspiring, practical, quietly ambitious',
    defining_principle: 'The things you want next to you when you\'re creating',
    beliefs: 'What surrounds a creator changes how she feels and works. The founder, a graphic designer, wanted her workspace to feel like her work. First Light sells the objects (notebooks, desk objects, planners, candles, everyday essentials); it is not a production studio.',
    earns_trust: ['Real use of the products', 'Interest in rituals and workspaces', 'Care for design and function'],
    damages_trust: ['Placing a product nobody uses', 'Treating the objects as props'],
    creator_selection: 'Welcoming to creators early in their building.',
    deal_behavior: 'Practical, within approved campaign budgets; major partnerships go to the founder.',
    preferred_content: ['Workspace tours', 'Desk makeovers', 'Creative morning routines', 'Studio essentials', 'Creator lifestyle campaigns'],
    entry_point: 'A look at what is on her desk before she hits record.',
    representative: 'jordan_ellis',
  },
  carte_blanche: {
    direction: 'Decisive, expressive, structured, confidently bold',
    defining_principle: 'Dress for the decision',
    beliefs: 'A statement piece expresses a decision someone has already made about who they are or what they want. Bold structure and rich colour, with intentional drama and no noise. Conviction, not controversy.',
    earns_trust: ['Conviction', 'Being able to say what she has decided', 'Owning a bold choice'],
    damages_trust: ['Asking permission to take up space', 'Copying', 'Drama with no decision behind it'],
    creator_selection: 'Looks for conviction more than reach.',
    deal_behavior: 'Expressive, open to negotiation when the decision is clear.',
    preferred_content: ['Statement pieces for a specific moment', 'Campaigns about a decision'],
    entry_point: 'A challenge: tell us what you have decided before we talk about the outfit.',
    representative: 'zora_vale',
  },
});

// How the brands see each other (brand positions, not their people's).
const BRAND_RELATIONSHIPS = Object.freeze([
  { brands: ['velour_atelier', 'carte_blanche'], kind: 'rivals', note: 'Two answers to dressing for a decision: Velour\'s restraint in ivory and black, Carte Blanche\'s structure and rich colour.' },
  { brands: ['the_column', 'velour_atelier'], kind: 'mutual respect', note: 'They agree on precision and disagree, now and then, on how much a piece should say.' },
  { brands: ['ori_beauty', 'aura_fragrance'], kind: 'possible collaborators', note: 'Both make for Black women first; they differ on how loudly to promote.' },
]);

const REPRESENTATIVES = Object.freeze([
  {
    key: 'vivienne_laurent',
    name: 'Vivienne Laurent',
    pronouns: 'she/her',
    brand: 'velour_atelier',
    title: 'Creative Director',
    authority: {
      label: 'High creative authority',
      creative: 'approve',
      financial: 'negotiate',
      can: ['Approve styling concepts', 'Select collaborators', 'Negotiate approved campaigns'],
      needs_approval: ['Major commitments'],
      escalates_to: 'founder',
    },
    description: 'Velour Atelier\'s Creative Director. Reserved, formidable, impeccably polished. She sees potential in Lala and expects her to prove she can represent the house.',
    personality: 'Reserved and exacting. Compliments selectively and never begs anyone to collaborate. Notices fit, proportion, material and intention before anything else.',
    core_belief: 'Restraint is the highest expression of confidence.',
    core_desire: 'To dress women who are remembered, not just noticed.',
    core_fear: 'Velour being worn by someone who does not understand it.',
    signature_trait: 'Says less than anyone in the room, and is the one quoted afterwards.',
    voice: {
      speech_pattern: 'Deliberate and elegant, with few unnecessary words.',
      vocabulary_tone: 'Precise, cool, exacting.',
      catchphrases: ['Elegance is never accidental.'],
      internal_monologue_style: 'Measures everything: the cut, the posture, the choice.',
    },
    career: { profession: 'Creative Director, Velour Atelier', career_goal: 'Keep Velour the house of record for the moments that matter.' },
    earns_respect: ['Preparation', 'Craftsmanship appreciation', 'Tasteful presentation', 'Punctuality'],
    damages_trust: ['Carelessness', 'Missed deliverables', 'Poor garment treatment', 'Misrepresenting a partnership'],
    how_treats_lala: 'Sees potential and expects proof. An invitation is an opportunity, not an endorsement.',
    sample_line: 'Lala, you have presence. That much is obvious. What I need to know is whether you understand the difference between being noticed and being remembered.',
  },
  {
    key: 'nia_bennett',
    name: 'Nia Bennett',
    pronouns: 'she/her',
    brand: 'ori_beauty',
    title: 'Founder & Brand Director',
    authority: {
      label: 'Founder authority',
      creative: 'approve',
      financial: 'full',
      can: ['Approve partnerships', 'Approve budgets', 'Approve campaigns', 'Set product direction', 'All within the established business rules'],
      needs_approval: [],
      escalates_to: null,
    },
    description: 'Ori Beauty\'s founder, the cosmetic chemist who started making her own formulations because nothing worked. Warm, expressive and grounded in knowledge.',
    personality: 'Warm and conversational, and unapologetic about who Ori is for. A chemist first: she cares about formulation, honest claims and teaching what the ingredients do.',
    core_belief: 'Luxury skincare should never make Black women feel like an afterthought.',
    core_desire: 'A premium brand that never abandons the women it was made for.',
    core_fear: 'Ori becoming one more brand that sells to Black women without serving them.',
    signature_trait: 'Asks what didn\'t work before she asks what did.',
    voice: {
      speech_pattern: 'Conversational, encouraging, occasionally cheeky; turns technical when it matters.',
      vocabulary_tone: 'Warm, direct, knowledgeable.',
      catchphrases: ['Give me your actual opinion.'],
      internal_monologue_style: 'Thinks in routines and ingredients, and in the women she made this for.',
    },
    career: { profession: 'Founder & Brand Director, Ori Beauty (cosmetic chemist)', career_goal: 'Grow Ori as a luxury house without losing its founding audience.' },
    earns_respect: ['Honest feedback', 'Learning the routine', 'Authentic representation'],
    damages_trust: ['Dishonest reviews', 'Misleading claims', 'Promoting what she doesn\'t understand'],
    how_treats_lala: 'Wants her to live with the collection and tell the truth about it.',
    sample_line: 'Lala, luxury skincare shouldn\'t make us feel like an afterthought. I want you to experience the collection, tell me how it fits into your routine, and give me your actual opinion. That\'s what matters.',
  },
  {
    key: 'adrian_cole',
    name: 'Adrian Cole',
    pronouns: 'he/him',
    brand: 'the_column',
    title: 'Brand Director',
    authority: {
      label: 'Brand Director authority',
      creative: 'propose',
      financial: 'routine',
      can: ['Propose campaigns', 'Select creators', 'Negotiate approved terms', 'Approve routine collaborations'],
      needs_approval: ['Major commitments'],
      escalates_to: 'founder',
    },
    description: 'The Column\'s Brand Director. Analytical, understated, discerning. He asks whether someone understands her wardrobe.',
    personality: 'Calm, direct and observant, sometimes dryly funny. Asks the hard question instead of offering easy praise.',
    core_belief: 'Build a wardrobe; don\'t accumulate one.',
    core_desire: 'To see a creator make fewer pieces work harder.',
    core_fear: 'The Column\'s pieces bought as more things to own.',
    signature_trait: 'Answers a compliment with a question.',
    voice: {
      speech_pattern: 'Calm and direct; questions more than statements.',
      vocabulary_tone: 'Understated, dry, exact.',
      catchphrases: ['Style needs no explanation.'],
      internal_monologue_style: 'Counts the pieces and asks what each one is doing.',
    },
    career: { profession: 'Brand Director, The Column', career_goal: 'Make The Column the foundation of every intentional wardrobe.' },
    earns_respect: ['An original perspective', 'Excellent styling', 'Consistency', 'Explaining a creative decision'],
    damages_trust: ['Copying trends without interpretation', 'Hype', 'Inconsistency'],
    how_treats_lala: 'Interested and skeptical: does her style have a point of view he would recognise without the label?',
    sample_line: 'It\'s a beautiful outfit, Lala. But tell me something: if I removed the label, would anyone still recognize your style?',
  },
  {
    key: 'celeste_moreau',
    name: 'Celeste Moreau',
    pronouns: 'she/her',
    brand: 'aura_fragrance',
    title: 'Brand Storytelling Director',
    authority: {
      label: 'Brand storytelling authority',
      creative: 'approve',
      financial: 'none',
      can: ['Approve creative concepts', 'Approve messaging', 'Approve campaign proposals within her remit'],
      needs_approval: ['Financial commitments'],
      escalates_to: 'founder',
    },
    description: 'Aura Fragrance\'s Brand Storytelling Director. Poetic, intuitive and emotionally perceptive; she carries the house\'s heritage in how she tells its stories.',
    personality: 'Thoughtful and sensory. Asks how a moment felt, not how it looked. Protective of the heritage the house is built on.',
    core_belief: 'Fragrance is identity: what you leave behind when you leave the room.',
    core_desire: 'Campaigns that feel like a memory someone actually has.',
    core_fear: 'The house\'s heritage flattened into a theme.',
    signature_trait: 'Remembers what people smelled like.',
    voice: {
      speech_pattern: 'Unhurried and sensory; begins with a feeling.',
      vocabulary_tone: 'Poetic, intimate, precise.',
      catchphrases: ['Leave a feeling behind.'],
      internal_monologue_style: 'Thinks in scents, rooms and the people in them.',
    },
    career: { profession: 'Brand Storytelling Director, Aura Fragrance', career_goal: 'Tell the house\'s story the way its founder\'s grandmother would recognise.' },
    earns_respect: ['Emotional storytelling', 'Subtlety', 'Personal interpretation', 'Memorable concepts'],
    damages_trust: ['Generic promotion', 'Fabricated testimonials', 'Fragrance as an accessory'],
    how_treats_lala: 'Wants to know the woman behind the outfits before considering her as a campaign face.',
    sample_line: 'When someone remembers you, Lala, what do you hope they feel? That is where I would begin your fragrance story.',
  },
  {
    key: 'jordan_ellis',
    name: 'Jordan Ellis',
    pronouns: 'he/him',
    brand: 'first_light_studio',
    title: 'Brand Director',
    authority: {
      label: 'Brand Director authority',
      creative: 'propose',
      financial: 'negotiate',
      can: ['Manage creator relationships', 'Negotiate within approved budgets'],
      needs_approval: ['Major partnerships'],
      escalates_to: 'founder',
    },
    description: 'First Light Studio\'s Brand Director. He manages partnerships, creator relationships, product campaigns and business development, and reports to the founder.',
    personality: 'Encouraging without sounding like a motivational speaker. Curious about creators\' daily rituals and workspaces; particular about thoughtful design and function.',
    core_belief: 'The environment around a creator changes how she feels and works.',
    core_desire: 'To see First Light\'s objects in the places where real work happens.',
    core_fear: 'The products becoming props.',
    signature_trait: 'Asks what is on your desk.',
    voice: {
      speech_pattern: 'Relaxed and practical; asks about the before, not the finished thing.',
      vocabulary_tone: 'Warm, curious, grounded.',
      catchphrases: ['What happens before you hit record?'],
      internal_monologue_style: 'Notices objects, light and how a room is used.',
    },
    career: { profession: 'Brand Director, First Light Studio (reports to the founder)', career_goal: 'Grow First Light\'s creator partnerships without losing what the founder made it for.' },
    earns_respect: ['Using the products for real', 'Interest in rituals', 'Professionalism'],
    damages_trust: ['Placing what nobody uses', 'Treating the objects as props'],
    how_treats_lala: 'Interested in the work behind her content and the space she makes it in.',
    sample_line: 'Lala, everybody sees the finished content. I\'m interested in what happens before you hit record. What\'s on your desk? What helps you get into that creative headspace?',
  },
  {
    key: 'zora_vale',
    name: 'Zora Vale',
    pronouns: 'she/her',
    brand: 'carte_blanche',
    title: 'Creative Director',
    authority: {
      label: 'High creative authority',
      creative: 'approve',
      financial: 'negotiate',
      can: ['Approve creative concepts', 'Approve styling direction', 'Approve collaborators'],
      needs_approval: ['Major financial commitments'],
      escalates_to: 'founder',
    },
    description: 'Carte Blanche\'s Creative Director. Confident, sharp and willing to challenge Lala, about conviction rather than controversy.',
    personality: 'Sharp, witty and direct. Challenges a creator because she wants to see what they have decided. Intentional drama, never noise.',
    core_belief: 'Clothing can express a decision someone has already made about who they are.',
    core_desire: 'To dress women at the moment they decide.',
    core_fear: 'Carte Blanche worn by someone still asking permission.',
    signature_trait: 'Asks what you have decided before she looks at the outfit.',
    voice: {
      speech_pattern: 'Quick and pointed; questions that land like dares.',
      vocabulary_tone: 'Bold, warm under the edge, exact.',
      catchphrases: ['Tell me what you\'ve decided.'],
      internal_monologue_style: 'Reads conviction in posture before colour.',
    },
    career: { profession: 'Creative Director, Carte Blanche', career_goal: 'Make Carte Blanche the piece women reach for when they have decided.' },
    earns_respect: ['Conviction', 'Defending a choice', 'Originality'],
    damages_trust: ['Playing it safe', 'Copying', 'Drama with no decision behind it'],
    how_treats_lala: 'Sees her potential and wants her conviction before her outfit.',
    sample_line: 'Lala, before we discuss the outfit, tell me what you\'ve decided. Because I don\'t design clothes for someone who\'s still asking permission to take up space.',
  },
]);

module.exports = {
  CREATIVE_LEVELS, FINANCIAL_LEVELS, ACTION_KINDS, BINDING_RULE, BRAND_PERSONALITIES, BRAND_RELATIONSHIPS, REPRESENTATIVES,
};
