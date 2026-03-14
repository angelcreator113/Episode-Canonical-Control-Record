'use strict';

/**
 * feedProfileUtils.js — Inference functions for auto-generating
 * Feed profiles from registry characters.
 */

const ROLE_TO_ARCHETYPE = {
  love_interest:  'polished_curator',
  one_night_stand:'messy_transparent',
  industry_peer:  'the_peer',
  mentor:         'polished_curator',
  antagonist:     'chaos_creator',
  rival:          'the_peer',
  collaborator:   'community_builder',
  spouse:         'soft_life',
  partner:        'soft_life',
  temptation:     'overnight_rise',
  ex:             'messy_transparent',
  confidant:      'the_watcher',
  friend:         'community_builder',
  coworker:       'cautionary',
};

const ROLE_TO_LALA_RELATIONSHIP = {
  love_interest:  'direct',
  one_night_stand:'direct',
  industry_peer:  'competitive',
  mentor:         'aware',
  antagonist:     'aware',
  rival:          'competitive',
  collaborator:   'direct',
  spouse:         'direct',
  partner:        'direct',
  temptation:     'aware',
  ex:             'direct',
  confidant:      'aware',
  friend:         'aware',
  coworker:       'aware',
};

const ROLE_TO_CAREER_PRESSURE = {
  mentor:         'ahead',
  antagonist:     'ahead',
  rival:          'level',
  industry_peer:  'level',
  collaborator:   'level',
  love_interest:  'level',
  temptation:     'level',
  one_night_stand:'level',
  ex:             'level',
  confidant:      'behind',
  friend:         'behind',
  coworker:       'behind',
  spouse:         'different_lane',
  partner:        'different_lane',
};

const ROLE_TO_FOLLOWER_TIER = {
  mentor:         'macro',
  antagonist:     'macro',
  rival:          'mid',
  industry_peer:  'mid',
  collaborator:   'mid',
  love_interest:  'micro',
  temptation:     'micro',
  one_night_stand:'micro',
  ex:             'micro',
  confidant:      'micro',
  friend:         'micro',
  coworker:       'micro',
  spouse:         'micro',
  partner:        'micro',
};

function generateHandleFromCharacter(character) {
  const name = character.selected_name || character.display_name || 'creator';
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const suffix = Math.floor(Math.random() * 900) + 100;
  return `${base}_${suffix}`;
}

function inferArchetypeFromRole(roleType) {
  return ROLE_TO_ARCHETYPE[roleType] || 'the_watcher';
}

function inferLalaRelationship(roleType) {
  return ROLE_TO_LALA_RELATIONSHIP[roleType] || 'mutual_unaware';
}

function inferCareerPressure(roleType) {
  return ROLE_TO_CAREER_PRESSURE[roleType] || 'different_lane';
}

function inferFollowerTier(roleType) {
  return ROLE_TO_FOLLOWER_TIER[roleType] || 'micro';
}

module.exports = {
  generateHandleFromCharacter,
  inferArchetypeFromRole,
  inferLalaRelationship,
  inferCareerPressure,
  inferFollowerTier,
};
