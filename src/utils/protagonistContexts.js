'use strict';

/**
 * The protagonist a feed profile is generated around, by layer (docs/CANON.md).
 *   real_world  JustAWoman's feed: real apps, our world.
 *   lalaverse   Lala's: The Pulse. Lala does not know she was made, so this
 *               never names JustAWoman or says Lala was built.
 * The same Lala as the Feed page's PROTAGONISTS.lala (frontend
 * pages/feed/feedConstants.js).
 */
const JUSTAWOMAN = Object.freeze({
  name: 'JustAWoman',
  description: 'A Black woman, mother, wife, content creator in fashion/beauty/lifestyle.',
  wound: 'She does everything right and the right room has not found her yet.',
  goal: 'To be legendary.',
  audience: 'Besties',
  detail: 'She posts for women. Men show up with their wallets and something in her responds.\nShe watches certain creators alone, at night, and does not tell her husband.',
});

const LALA = Object.freeze({
  name: 'Lala',
  description: 'A sentient fashion game character living in the LalaVerse, styling her way up. Young, sharp, digitally native. Her world feels complete and real to her.',
  wound: 'Her taste feels like instinct, and she has never asked where it came from.',
  goal: 'To become something that can\'t be copied.',
  audience: 'The generation that learned to perform before they learned to feel',
  detail: 'The line between consuming and creating dissolved before she noticed.',
});

/** The protagonist for a layer; a context without a name (e.g. only { feed_layer }) is not one. */
function protagonistFor(layer, characterContext = null) {
  if (characterContext?.name) return characterContext;
  return layer === 'lalaverse' ? LALA : JUSTAWOMAN;
}

module.exports = { JUSTAWOMAN, LALA, protagonistFor };
