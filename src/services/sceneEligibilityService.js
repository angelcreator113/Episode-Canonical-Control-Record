'use strict';

const SCENE_TYPE_MAP = {
  love_interest: {
    volatile:  'hook_up',
    simmering: 'charged_moment',
    fractured: 'recurring',
    healing:   'first_encounter',
    calm:      'charged_moment',
  },
  one_night_stand: {
    volatile:  'hook_up',
    simmering: 'first_encounter',
    fractured: 'hook_up',
    healing:   'first_encounter',
    calm:      'first_encounter',
  },
  collaborator: {
    volatile:  'charged_moment',
    simmering: 'charged_moment',
    fractured: 'recurring',
    healing:   'charged_moment',
    calm:      null,
  },
  partner: {
    volatile:  'recurring',
    simmering: 'recurring',
    fractured: 'recurring',
    healing:   'first_encounter',
    calm:      null,
  },
  spouse: {
    volatile:  'recurring',
    simmering: 'recurring',
    fractured: 'recurring',
    healing:   'recurring',
    calm:      null,
  },
  temptation: {
    volatile:  'hook_up',
    simmering: 'charged_moment',
    fractured: 'charged_moment',
    healing:   null,
    calm:      null,
  },
  ex: {
    volatile:  'recurring',
    simmering: 'charged_moment',
    fractured: 'recurring',
    healing:   'first_encounter',
    calm:      null,
  },
};

const INTENSITY_MAP = {
  volatile:  'high',
  simmering: 'medium',
  fractured: 'medium',
  healing:   'low',
  calm:      'low',
};

const ELIGIBLE_STORY_TYPES = ['collision', 'wrong_win'];

async function checkSceneEligibility(db, { storyId, characterKey, storyText, storyType, storyNumber, charactersPresent = [] }) {
  // internal stories only eligible if second character is present + direct relationship
  if (storyType === 'internal') {
    const hasDirectPartner = charactersPresent.some(c =>
      ['love_interest', 'partner', 'spouse'].includes(c.role_type)
    );
    if (!hasDirectPartner) return { eligible: false, reason: 'internal story with no direct partner present' };
  }

  if (!ELIGIBLE_STORY_TYPES.includes(storyType) && storyType !== 'internal') {
    return { eligible: false, reason: 'story type not eligible' };
  }

  // Find POV character
  const charA = await db.RegistryCharacter.findOne({
    where: { character_key: characterKey },
  });

  if (!charA || !charA.intimate_eligible) {
    return { eligible: false, reason: 'POV character not intimate eligible' };
  }

  // Find the partner character from characters_present
  const partners = charactersPresent.filter(c =>
    c.character_key !== characterKey &&
    Object.keys(SCENE_TYPE_MAP).includes(c.role_type)
  );

  if (!partners.length) {
    return { eligible: false, reason: 'no eligible partner character present' };
  }

  const partner = partners[0]; // primary partner

  // Resolve partner DB record
  const partnerChar = await db.RegistryCharacter.findOne({
    where: { character_key: partner.character_key },
  });

  if (!partnerChar) {
    return { eligible: false, reason: 'partner character not found in registry' };
  }

  // Get relationship between them
  const { Op } = db.Sequelize;
  const relationship = await db.CharacterRelationship.findOne({
    where: {
      [Op.or]: [
        { character_id_a: charA.id, character_id_b: partnerChar.id },
        { character_id_a: partnerChar.id, character_id_b: charA.id },
      ],
    },
  });

  const tensionState = relationship?.tension_state || 'simmering';
  const roleType = partner.role_type;

  const sceneType = SCENE_TYPE_MAP[roleType]?.[tensionState];

  if (!sceneType) {
    return { eligible: false, reason: `${roleType} + ${tensionState} combination not eligible` };
  }

  // Extract location from story text (last location mentioned)
  const locationMatch = storyText?.match(
    /(?:in the|at the|inside the|back at the|into the)\s+([a-z\s]+?)(?:\.|,|\s+(?:she|he|they|it))/i
  );
  const inferredLocation = locationMatch?.[1]?.trim() || '';

  return {
    eligible: true,
    charA: { id: charA.id, name: charA.display_name || charA.character_key },
    charB: { id: partnerChar.id, name: partnerChar.display_name || partnerChar.character_key, role_type: roleType },
    scene_type: sceneType,
    intensity: INTENSITY_MAP[tensionState] || 'medium',
    tension_state: tensionState,
    location: inferredLocation,
    relationship_id: relationship?.id || null,
    source_story_number: storyNumber,
    auto_populated: true,
  };
}

module.exports = { checkSceneEligibility };
