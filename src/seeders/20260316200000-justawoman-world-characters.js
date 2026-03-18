// src/seeders/20260316200000-justawoman-world-characters.js
// JustAWoman's World — 9 Core Characters
// Registry: Book 1 / Real-World Layer
// All characters seeded as status: 'accepted', intimate_eligible set per character

'use strict';

const { v4: uuidv4 } = require('uuid');

// ── Replace with your actual registry ID ─────────────────────────────
const REGISTRY_ID = process.env.BOOK1_REGISTRY_ID || 'YOUR_REGISTRY_ID_HERE';

const NOW = new Date();

// Helper: builds extra_fields JSONB for narrative data that has no dedicated column
function narrativeExtras(obj) {
  const extras = {};
  if (obj.arc_role) extras.arc_role = obj.arc_role;
  if (obj.tension_type) extras.tension_type = obj.tension_type;
  if (obj.lala_mirror !== undefined) extras.lala_mirror = obj.lala_mirror;
  if (obj.signature_quote) extras.signature_quote = obj.signature_quote;
  if (obj.what_they_want_from_protagonist) extras.what_they_want_from_protagonist = obj.what_they_want_from_protagonist;
  if (obj.how_they_meet) extras.how_they_meet = obj.how_they_meet;
  if (obj.dynamic) extras.dynamic = obj.dynamic;
  if (obj.fidelity_pattern) extras.fidelity_pattern = obj.fidelity_pattern;
  if (obj.layer) extras.layer = obj.layer;
  if (obj.world) extras.world = obj.world;
  return JSON.stringify(extras);
}

// Helper: builds deep_profile JSONB for intimate/sexuality data that has no dedicated column
function deepProfileExtras(obj) {
  const profile = {};
  if (obj.sexuality) profile.sexuality = obj.sexuality;
  if (obj.attracted_to) profile.attracted_to = obj.attracted_to;
  if (obj.how_they_love) profile.how_they_love = obj.how_they_love;
  if (obj.desire_they_wont_admit) profile.desire_they_wont_admit = obj.desire_they_wont_admit;
  if (obj.intimate_presence) profile.intimate_presence = obj.intimate_presence;
  if (obj.what_they_give) profile.what_they_give = obj.what_they_give;
  if (obj.what_they_withhold) profile.what_they_withhold = obj.what_they_withhold;
  return Object.keys(profile).length ? JSON.stringify(profile) : null;
}

module.exports = {
  up: async (queryInterface) => {
    // Check if already seeded
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM registry_characters WHERE character_key = 'elias' AND registry_id = '${REGISTRY_ID}' LIMIT 1;`
    );
    if (existing.length > 0) {
      console.log('⚠ JustAWoman world characters already seeded — skipping');
      return;
    }

    const characters = [

      // ════════════════════════════════════════════════════════════════
      // 1. ELIAS — The Older Boy (9)
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'elias',
        display_name: 'Elias',
        selected_name: 'Elias',
        role_type: 'support',
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 9,
        birth_year: 2016,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Atlanta, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Born and raised in Atlanta suburbs. Has never lived anywhere else.',
        class_origin: 'middle_class',
        current_class: 'middle_class',
        class_mobility_direction: 'stable',
        family_structure: 'two_parents_intact',
        parents_status: 'Both present and married',
        sibling_position: 'oldest',
        sibling_count: 1,
        relationship_status: 'single',
        has_children: false,
        children_ages: '[]',
        education_experience: 'Fourth grade at Cedar Grove Academy. Strong reader. Slightly ahead in math.',
        career_history: null,
        years_posting: 0,
        physical_presence: 'Slight for his age. Moves carefully, like he is thinking about where he puts himself. Makes eye contact longer than most children do.',
        demographic_voice_signature: 'Quiet. Speaks in complete sentences. Asks questions that land differently than you expect from a nine-year-old.',
        platform_primary: null,
        follower_tier: 'ghost',
        intimate_eligible: false,

        core_belief: 'If I pay attention, I will understand.',
        core_desire: 'To know that the people he loves are okay.',
        core_fear: 'That something is wrong that nobody will explain to him.',
        core_wound: 'He understands more than he is supposed to and has nobody to process it with.',

        // Depth engine — mapped to actual column names
        de_body_relationship: 'stranger',
        de_body_currency: 20,
        de_joy_trigger: 'Quiet moments with his mother when she is fully present. When Zion laughs. When he figures something out alone.',
        de_joy_current_access: 60,
        de_self_narrative_origin: 'I am the one who notices.',
        de_actual_narrative_gap: 'He is a child carrying adult awareness without adult tools.',
        de_blind_spot: 'He believes he can protect his mother by watching. He cannot.',
        de_operative_cosmology: 'deserving',        // original: merit_based
        de_time_orientation: 'present_impulsive',   // original: present_focused
        de_change_capacity: 'conditionally_open',   // original: gradual

        // Narrative fields → extra_fields JSONB
        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'He is the first witness to her becoming. His quiet recognition is the one form of being seen that costs her nothing — and means everything.',
          tension_type: 'simmering',
          lala_mirror: null,
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 2. ZION — The Younger Boy (5)
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'zion',
        display_name: 'Zion',
        selected_name: 'Zion',
        role_type: 'support',
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 5,
        birth_year: 2020,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Atlanta, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Born in Atlanta. Has never known anywhere else.',
        class_origin: 'middle_class',
        current_class: 'middle_class',
        class_mobility_direction: 'stable',
        family_structure: 'two_parents_intact',
        parents_status: 'Both present and married',
        sibling_position: 'youngest',
        sibling_count: 1,
        relationship_status: 'single',
        has_children: false,
        children_ages: '[]',
        education_experience: 'Kindergarten at Cedar Grove Academy. Energetic. Needs movement. Bright but distracted.',
        career_history: null,
        years_posting: 0,
        physical_presence: 'All energy. Takes up more space than his size should allow. Always in motion. Grabs without asking — hands, attention, the room.',
        demographic_voice_signature: 'Loud. Incomplete sentences. Asks why constantly. Laughs before the joke finishes.',
        platform_primary: null,
        follower_tier: 'ghost',
        intimate_eligible: false,

        core_belief: 'Everything I need is right here.',
        core_desire: 'Her full attention, right now.',
        core_fear: 'Being left outside of something.',
        core_wound: 'Too young to have one yet. He is still completely intact.',

        de_body_relationship: 'home',
        de_body_currency: 10,
        de_joy_trigger: 'His mother\'s laugh. Running. Any food he likes. His brother paying attention to him.',
        de_joy_current_access: 90,
        de_self_narrative_origin: 'Everything is for me.',
        de_actual_narrative_gap: 'He is the purest thing in her life and the heaviest anchor.',
        de_blind_spot: 'He has no blind spot yet. That\'s what makes him dangerous to her ambition.',
        de_operative_cosmology: 'indifferent',        // original: chaotic
        de_time_orientation: 'present_impulsive',    // original: present_focused
        de_change_capacity: 'highly_rigid',          // original: resistant

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'He is the weight of being needed. Every time she reaches for expansion he pulls her back into the present tense. Not cruelly. Simply by existing.',
          tension_type: 'calm',
          lala_mirror: null,
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 3. IMANI — The Best Friend
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'imani',
        display_name: 'Imani',
        selected_name: 'Imani',
        role_type: 'support',  // 'confidant' not in ENUM → mapped to 'support'
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 34,
        birth_year: 1991,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Atlanta, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Grew up in Atlanta. Left for college in Charlotte. Came back deliberately.',
        class_origin: 'working_class',
        current_class: 'middle_class',
        class_mobility_direction: 'ascending',
        family_structure: 'two_parents_intact',
        parents_status: 'Both alive and still together.',
        sibling_position: 'middle',
        sibling_count: 2,
        relationship_status: 'committed',  // 'partnered' not in ENUM → mapped to 'committed'
        has_children: false,
        children_ages: '[]',
        education_experience: 'BA in Communications from UNC Charlotte. Chose stability over prestige and has never regretted it.',
        career_history: 'HR manager at a mid-size company in Atlanta. Steady, respected, not glamorous. She chose it on purpose.',
        years_posting: 3,
        physical_presence: 'Still. Grounded. Takes up exactly the space she needs — no more, no less. People tend to exhale around her.',
        demographic_voice_signature: 'Measured. Doesn\'t rush to fill silence. When she says something it lands because she waited until it was worth saying.',
        platform_primary: null,  // 'instagram' not in ENUM → null (ghost-level presence)
        follower_tier: 'ghost',
        intimate_eligible: false,

        core_belief: 'A good life is built, not performed.',
        core_desire: 'To live with clarity and not regret.',
        core_fear: 'Losing herself chasing something that doesn\'t actually matter.',
        core_wound: 'She watched her mother exhaust herself trying to become something and die still reaching. She chose differently.',

        de_body_relationship: 'home',
        de_body_currency: 35,
        de_joy_trigger: 'Honest conversations. Her partner. Cooking something that takes time. When JustAWoman calls just to talk, not to process.',
        de_joy_current_access: 80,
        de_self_narrative_origin: 'I chose this life. It is enough.',
        de_actual_narrative_gap: 'She chose safety over scale and made peace with it — mostly.',
        de_blind_spot: 'She thinks her groundedness is wisdom. Sometimes it is the fear her mother left her.',
        de_operative_cosmology: 'relational',
        de_time_orientation: 'present_impulsive',    // original: present_focused
        de_change_capacity: 'conditionally_open',    // original: gradual

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'The reality mirror. The only place JustAWoman doesn\'t have to be desirable, impressive, or watched. Her existence quietly asks: what if a good life is enough?',
          tension_type: 'calm',
          what_they_want_from_protagonist: 'For her to stop performing long enough to feel what she actually feels.',
          how_they_meet: 'They\'ve known each other since their twenties. The friendship predates everything — the husband, the kids, the online presence.',
          dynamic: 'Imani doesn\'t hype her. She adjusts her back to reality. That\'s why JustAWoman keeps calling.',
          fidelity_pattern: 'Completely loyal. Has never told anyone anything JustAWoman told her in private.',
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 4. CAROLYN — Her Mother
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'carolyn',
        display_name: 'Carolyn',
        selected_name: 'Carolyn',
        role_type: 'pressure',
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 61,
        birth_year: 1964,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Decatur, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Born and raised in Decatur. Never left. Watched Atlanta change around her and stayed exactly where she was.',
        class_origin: 'working_class',
        current_class: 'lower_middle',
        class_mobility_direction: 'stable',
        family_structure: 'two_parents_intact',
        parents_status: 'Both deceased.',
        sibling_position: 'oldest',
        sibling_count: 3,
        relationship_status: 'married',
        has_children: true,
        children_ages: '[34, 38]',
        education_experience: 'Associate\'s degree in Business Administration. Night school while working. Proud of it.',
        career_history: 'Administrative coordinator at a school district for 28 years. Retired with a pension. Considers this the correct way to live.',
        years_posting: 1,
        physical_presence: 'Upright. Composed. Moves like someone who has never been in a hurry because she decided long ago where she was going.',
        demographic_voice_signature: 'Careful. Firm without volume. Says the quiet part quietly and means it more than if she\'d said it loud.',
        platform_primary: null,  // 'facebook' not in ENUM → null
        follower_tier: 'ghost',
        intimate_eligible: false,

        core_belief: 'Stability is success. Everything else is noise.',
        core_desire: 'For her daughter to stop restless and recognize what she has.',
        core_fear: 'That her daughter will sacrifice something real chasing something that won\'t hold her.',
        core_wound: 'She worked for everything she has and nobody made it look like art. She doesn\'t understand why her daughter needs it to look like something.',

        de_body_relationship: 'discipline',
        de_body_currency: 40,
        de_joy_trigger: 'Her grandchildren. Sunday dinners that go long. When things go according to plan.',
        de_joy_current_access: 50,
        de_self_narrative_origin: 'I built something real and I did it the right way.',
        de_actual_narrative_gap: 'She chose safety so completely that she can no longer recognize the cost of it.',
        de_blind_spot: 'She thinks she\'s grounding her daughter. She is the ceiling.',
        de_operative_cosmology: 'deserving',          // original: merit_based
        de_time_orientation: 'past_anchored',
        de_change_capacity: 'highly_rigid',          // original: resistant

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'The voice of enough. The ceiling JustAWoman refuses to accept. Her love is real and her limitation is real and both are true simultaneously.',
          tension_type: 'simmering',
          signature_quote: '"You always have something going on."',
          what_they_want_from_protagonist: 'To come back down. To be satisfied. To stop.',
          how_they_meet: 'They\'ve always known each other. Carolyn is 20 minutes away and calls on Sundays.',
          dynamic: 'Love without recognition. Carolyn sees JustAWoman as already arrived. JustAWoman feels invisible to the one person who should see her scale.',
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 5. ELENA HARPER — The Perfect Mom
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'elena_harper',
        display_name: 'Elena Harper',
        selected_name: 'Elena',
        role_type: 'mirror',
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 38,
        birth_year: 1987,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Alpharetta, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Grew up in Alpharetta. Moved to current suburb after marriage. Chose the neighborhood for the school district.',
        class_origin: 'upper_middle',
        current_class: 'upper_middle',
        class_mobility_direction: 'stable',
        family_structure: 'two_parents_intact',
        parents_status: 'Both alive, still married, still in Alpharetta.',
        sibling_position: 'only_child',
        sibling_count: 0,
        relationship_status: 'married',
        has_children: true,
        children_ages: '[10, 7]',
        education_experience: 'BA from Spelman, MBA from Emory. The degrees are displayed correctly.',
        career_history: 'Former marketing director. Left when Ava was born. Manages the household like a brand. Has not missed a single school event in 10 years.',
        years_posting: 4,
        physical_presence: 'Assembled. Every element chosen. Takes up space through precision, not volume. You notice her because nothing is accidental.',
        demographic_voice_signature: 'Warm on the surface, measured underneath. Compliments land slightly sideways. You hear them correctly about three seconds later.',
        platform_primary: null,  // 'instagram' not in ENUM → null
        follower_tier: 'micro',
        intimate_eligible: false,

        core_belief: 'Control is care.',
        core_desire: 'To be recognized as someone who did everything right.',
        core_fear: 'That doing everything right still won\'t be enough.',
        core_wound: 'She performed perfection so long she can no longer tell the difference between what she wants and what she\'s supposed to want.',

        de_body_relationship: 'discipline',
        de_body_currency: 65,
        de_joy_trigger: 'When the plan executes perfectly. When Ava performs well. When her home looks exactly right.',
        de_joy_current_access: 40,
        de_self_narrative_origin: 'I am the standard.',
        de_actual_narrative_gap: 'She is afraid that if she stopped performing, there would be nothing underneath.',
        de_blind_spot: 'She thinks her discomfort with JustAWoman is about values. It\'s about hunger. She recognizes it and can\'t allow it.',
        de_operative_cosmology: 'deserving',          // original: merit_based
        de_time_orientation: 'future_oriented',
        de_change_capacity: 'highly_rigid',          // original: resistant

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'The mirror JustAWoman refuses to become. Perfection as a cage dressed as a choice.',
          tension_type: 'simmering',
          signature_quote: '"You\'re doing great… but I would never do that."',
          what_they_want_from_protagonist: 'To be contained. To be less. To confirm that the choice Elena made was the right one.',
          how_they_meet: 'School pickup. Cedar Grove. They have been circling each other for two years.',
          dynamic: 'Polite competition with no acknowledged competitor. Elena is always positioned slightly above. JustAWoman doesn\'t try to close the gap — she just refuses to look up.',
        }),

        deep_profile: deepProfileExtras({
          sexuality: 'Heterosexual. Has not thought about this in years.',
          attracted_to: 'Competence. Stability. A man who makes the plan work.',
          how_they_love: 'Through execution. She loves by organizing your life.',
          desire_they_wont_admit: 'She wants to be looked at the way men look at JustAWoman.',
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 6. BRIANNA "BRI" COLE — The Overwhelmed Mom
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'bri_cole',
        display_name: 'Brianna Cole',
        selected_name: 'Bri',
        role_type: 'support',  // 'friend' not in ENUM → mapped to 'support'
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 33,
        birth_year: 1992,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Lithonia, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Grew up in Lithonia. Moved to current suburb three years ago for more space when Noah was born.',
        class_origin: 'working_class',
        current_class: 'lower_middle',
        class_mobility_direction: 'volatile',
        family_structure: 'two_parents_intact',  // 'two_parent_volatile' not in ENUM → closest match
        parents_status: 'Mother alive in Lithonia. Father absent since she was 12.',
        sibling_position: 'oldest',
        sibling_count: 2,
        relationship_status: 'married',
        has_children: true,
        children_ages: '[8, 4, 1]',
        education_experience: 'Some college. Dropped out when Jayden was born. Has thought about going back every year since.',
        career_history: 'Medical billing from home. Inconsistent hours. Always slightly behind on something.',
        years_posting: 2,
        physical_presence: 'Always carrying something — a baby, a bag, a thought she hasn\'t finished. Moves fast but not efficiently. Loud presence, warm energy.',
        demographic_voice_signature: 'Fast. Overshares immediately. Laughs mid-sentence. Asks questions she\'s already answering.',
        platform_primary: null,  // 'tiktok' not in ENUM → null
        follower_tier: 'ghost',
        intimate_eligible: false,

        core_belief: 'Love is enough if you just keep going.',
        core_desire: 'One day where everything is handled and nobody needs anything.',
        core_fear: 'That she is failing her children and they will know it when they\'re older.',
        core_wound: 'She gave everything to everyone before she knew who she was. Now she can\'t find the version of herself that existed before.',

        de_body_relationship: 'burden',
        de_body_currency: 25,
        de_joy_trigger: 'When all three kids are asleep and the house is quiet for twenty minutes. When someone sees she\'s tired without her having to say it.',
        de_joy_current_access: 20,
        de_self_narrative_origin: 'I\'m doing the best I can.',
        de_actual_narrative_gap: 'She is survival-mode parenting a life she didn\'t fully choose.',
        de_blind_spot: 'She sees JustAWoman as having it figured out. She is comparing her inside to JustAWoman\'s outside.',
        de_operative_cosmology: 'relational',
        de_time_orientation: 'present_impulsive',    // original: present_focused
        de_change_capacity: 'conditionally_open',    // original: gradual

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'The chaos JustAWoman has not become. The warmth and the warning simultaneously.',
          tension_type: 'calm',
          signature_quote: '"Girl I don\'t know how you do it."',
          what_they_want_from_protagonist: 'Proof that it gets easier. Proof that someone has it together.',
          how_they_meet: 'School pickup. Jayden knocked Zion down in the pickup line on the first day of school. They\'ve been talking since.',
          dynamic: 'Bri overshares. JustAWoman absorbs and reflects back something calmer than she feels. Bri thinks this means JustAWoman is okay. It means JustAWoman is performing.',
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 7. TASHA GREENE — The Checked-Out Mom
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'tasha_greene',
        display_name: 'Tasha Greene',
        selected_name: 'Tasha',
        role_type: 'mirror',
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 40,
        birth_year: 1985,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'East Point, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Grew up in East Point. Moved to suburbs when Malik was born. Has thought about leaving every year since.',
        class_origin: 'lower_middle',
        current_class: 'middle_class',
        class_mobility_direction: 'stable',
        family_structure: 'two_parents_intact',  // 'two_parent_volatile' not in ENUM → closest match
        parents_status: 'Mother deceased. Father remarried, distant.',
        sibling_position: 'youngest',
        sibling_count: 2,
        relationship_status: 'married',
        has_children: true,
        children_ages: '[11, 6]',
        education_experience: 'BA in Psychology from Georgia State. Never used it professionally. Thinks about this more than she admits.',
        career_history: 'Property manager for a rental company. Stable, unremarkable, fine.',
        years_posting: 0,
        physical_presence: 'Still. Watchful. Doesn\'t perform comfort or discomfort. You notice her because she isn\'t trying to be noticed.',
        demographic_voice_signature: 'Sparse. Says the real thing when she speaks. Long pauses that aren\'t awkward — she\'s just deciding if it\'s worth it.',
        platform_primary: null,
        follower_tier: 'ghost',
        intimate_eligible: false,

        core_belief: 'Most things aren\'t worth the energy.',
        core_desire: 'To feel something again without it costing her.',
        core_fear: 'That she waited too long and the version of herself that wanted things is gone.',
        core_wound: 'She tried — fully, completely, openly — and it didn\'t change anything. So she stopped trying where people could see.',

        de_body_relationship: 'stranger',
        de_body_currency: 20,
        de_joy_trigger: 'Malik doing something independently. A morning with no obligations. Occasionally, something someone says that is completely honest.',
        de_joy_current_access: 15,
        de_self_narrative_origin: 'I\'m fine. I just got realistic.',
        de_actual_narrative_gap: 'She is grieving a version of herself she let go of too quietly.',
        de_blind_spot: 'She thinks her detachment is clarity. It is the wound performing as wisdom.',
        de_operative_cosmology: 'indifferent',        // original: fatalistic
        de_time_orientation: 'past_anchored',
        de_change_capacity: 'highly_rigid',          // original: resistant

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'The endpoint of quiet disappointment. What happens when effort fades and nobody notices. The mirror JustAWoman is most afraid of.',
          tension_type: 'fractured',
          signature_quote: '"You still care. That\'s good."',
          what_they_want_from_protagonist: 'Nothing. She has stopped wanting things from people.',
          how_they_meet: 'School pickup. They recognized each other without speaking first — the women who watch instead of perform.',
          dynamic: 'Tasha sees JustAWoman most clearly of anyone at Cedar Grove. She doesn\'t say much. When she does it lands like a stone dropped in still water.',
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 8. MS. CALDWELL — Cedar Grove Teacher
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'ms_caldwell',
        display_name: 'Ms. Caldwell',
        selected_name: 'Ms. Caldwell',
        role_type: 'pressure',
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 52,
        birth_year: 1973,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Marietta, GA',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Grew up in Marietta. Has taught in the same school district for 22 years.',
        class_origin: 'middle_class',
        current_class: 'middle_class',
        class_mobility_direction: 'stable',
        family_structure: 'two_parents_intact',
        parents_status: 'Both alive.',
        sibling_position: 'middle',
        sibling_count: 3,
        relationship_status: 'married',
        has_children: true,
        children_ages: '[24, 21]',
        education_experience: 'BA in Elementary Education from Georgia State. Master\'s in Curriculum Development. She earned both while teaching.',
        career_history: '22 years in the same district. 4th grade for the last 11. Knows how to read a family by the third week of school.',
        years_posting: 0,
        physical_presence: 'Warm but precise. Has the particular stillness of someone who has managed thirty children a day for two decades. You don\'t have to raise your voice when your presence is already the loudest thing in the room.',
        demographic_voice_signature: 'Teacher voice — measured, intentional, impossible to interrupt without feeling like you\'ve done something wrong.',
        platform_primary: null,
        follower_tier: 'ghost',
        intimate_eligible: false,

        core_belief: 'Children tell you everything about their parents.',
        core_desire: 'For every child in her room to feel safe enough to learn.',
        core_fear: 'That she\'s going to miss something important in a child who needs her to see it.',
        core_wound: 'She once missed a child who needed intervention. She has not missed anything since.',

        de_body_relationship: 'discipline',
        de_body_currency: 30,
        de_joy_trigger: 'When a struggling student finally gets it. The specific silence of a classroom that is fully engaged.',
        de_joy_current_access: 55,
        de_self_narrative_origin: 'I see children for who they are, not who their parents want them to be.',
        de_actual_narrative_gap: 'She sees children for who they are — and sometimes judges the parents for who she sees in them.',
        de_blind_spot: 'She believes objectivity. Her preference for "structured families" is a value judgment dressed as professional observation.',
        de_operative_cosmology: 'deserving',          // original: merit_based
        de_time_orientation: 'present_impulsive',    // original: present_focused
        de_change_capacity: 'conditionally_open',    // original: gradual

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'Institutional pressure. The place where JustAWoman\'s real life and social performance get evaluated by someone with no context for either.',
          tension_type: 'simmering',
          signature_quote: '"Your son is very… aware."',
          what_they_want_from_protagonist: 'For the home to be stable enough that Elias can just be nine.',
          how_they_meet: 'Parent-teacher conference. First one. Ms. Caldwell says something that sounds like a compliment and isn\'t.',
          dynamic: 'Ms. Caldwell is not unkind. She is observant in a way that feels like judgment because it sometimes is.',
        }),

        created_at: NOW,
        updated_at: NOW,
      },

      // ════════════════════════════════════════════════════════════════
      // 9. MARCUS — The Paying Man
      // ════════════════════════════════════════════════════════════════
      {
        id: uuidv4(),
        registry_id: REGISTRY_ID,
        character_key: 'marcus',
        display_name: 'Marcus',
        selected_name: 'Marcus',
        role_type: 'shadow',  // 'temptation' not in ENUM → mapped to 'shadow'
        // world: 'book-1' — stored in extra_fields (no world column on registry_characters)
        status: 'accepted',
        age: 41,
        birth_year: 1984,
        cultural_background: 'Black American',
        nationality: 'American',
        first_language: 'English',
        hometown: 'Birmingham, AL',
        current_city: 'outside_lalaverse',
        city_migration_history: 'Grew up in Birmingham. Relocated to Atlanta at 28 for work. Has been here since.',
        class_origin: 'working_class',
        current_class: 'middle_class',
        class_mobility_direction: 'ascending',
        family_structure: 'effectively_alone',
        parents_status: 'Mother alive in Birmingham. Father unknown.',
        sibling_position: 'only_child',
        sibling_count: 0,
        relationship_status: 'single',
        has_children: false,
        children_ages: '[]',
        education_experience: 'Bachelor\'s in Business from UAB. Functional, not impressive. Got the degree to get the job.',
        career_history: 'Mid-level logistics manager. Stable income. No particular ambition beyond maintaining access to things that feel good.',
        years_posting: 0,
        physical_presence: 'Unremarkable in person. Medium build, contained, nothing that announces him. He is designed to not be noticed until he wants to be.',
        demographic_voice_signature: 'Controlled in text. Methodical. Doesn\'t type the way he talks. His messages are more deliberate than his conversation.',
        platform_primary: null,  // 'instagram' not in ENUM → null
        follower_tier: 'ghost',
        intimate_eligible: true,

        core_belief: 'Access is earned through consistency.',
        core_desire: 'To occupy space in her attention without having to become someone worth it.',
        core_fear: 'Being ignored. Becoming irrelevant. The message going unanswered.',
        core_wound: 'He was not chosen early and has been purchasing proximity ever since.',

        de_body_relationship: 'currency',
        de_body_currency: 80,
        de_joy_trigger: 'Her response. The specific feeling of her attention landing on him.',
        de_joy_current_access: 30,
        de_self_narrative_origin: 'I treat women well. I just know what I want.',
        de_actual_narrative_gap: 'He does not see her. He sees a body he wants access to and he is methodical about acquiring it.',
        de_blind_spot: 'He believes the money makes the transaction mutual. It makes it possible. Not mutual.',
        de_operative_cosmology: 'contractual',        // original: transactional
        de_time_orientation: 'present_impulsive',    // original: present_focused
        de_change_capacity: 'highly_rigid',          // original: resistant

        extra_fields: narrativeExtras({
          world: 'book-1',
          layer: 'real-world',
          arc_role: 'The transactional mirror. He offers the reduction she sometimes wants — just a body, just desire, stripped of context. She is not confused about what this is. She chooses it.',
          tension_type: 'volatile',
          signature_quote: 'Nothing quotable in Phase 1. In Phase 3 his messages are direct, repetitive, and focused entirely on her body.',
          what_they_want_from_protagonist: 'Her image. Her body as an idea. Her continued attention. Access without cost to him.',
          how_they_meet: 'He finds her through Instagram. Follows for three weeks before he DMs. The first message is unremarkable. That\'s intentional.',
          dynamic: 'Phase 1: controlled, subtle, different. Phase 2: more frequent, more direct. Phase 3: constant, repetitive, body-focused. She knows exactly what this is at every phase. She chooses her level of engagement deliberately.',
          fidelity_pattern: 'Not applicable. He is not in a relationship. He is in an acquisition.',
        }),

        deep_profile: deepProfileExtras({
          sexuality: 'Heterosexual. Directed and specific.',
          attracted_to: 'Her specifically. The version of her that is performing for the internet. Her body as he imagines it. The idea that she is available.',
          how_they_love: 'He does not love. He acquires. He maintains. He escalates when the acquisition feels threatened.',
          desire_they_wont_admit: 'He wants her to want him back without the money. He knows she doesn\'t.',
          intimate_presence: 'He is never in the room. He is in her phone. His intimacy is entirely textual — deliberate, escalating, never accidental.',
          what_they_give: 'A simplified version of herself. Just a body. Just desire. The freedom of being reduced.',
          what_they_withhold: 'Everything he actually is. He is a stranger she has chosen to let into a specific room.',
        }),

        created_at: NOW,
        updated_at: NOW,
      },

    ];

    // Insert all characters
    await queryInterface.bulkInsert('registry_characters', characters, {});

    console.log(`✓ Seeded 9 JustAWoman world characters to registry`);
    console.log(`  - Elias (9, observer)`);
    console.log(`  - Zion (5, anchor)`);
    console.log(`  - Imani (best friend)`);
    console.log(`  - Carolyn (mother)`);
    console.log(`  - Elena Harper (perfect mom)`);
    console.log(`  - Bri Cole (overwhelmed mom)`);
    console.log(`  - Tasha Greene (checked-out mom)`);
    console.log(`  - Ms. Caldwell (Cedar Grove teacher)`);
    console.log(`  - Marcus (the paying man)`);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('registry_characters', {
      character_key: [
        'elias', 'zion', 'imani', 'carolyn',
        'elena_harper', 'bri_cole', 'tasha_greene',
        'ms_caldwell', 'marcus',
      ],
    });
    console.log('✓ Removed JustAWoman world characters from registry');
  },
};
