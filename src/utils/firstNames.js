'use strict';

/**
 * A person's first name, when it can stand for them alone (Evoni,
 * 2026-10-24: her Season Plan listed "Lala ↔ The Column" thirteen times,
 * because "The" from "The Column" matched every "the" in her slot purposes).
 *
 *   NOT_FIRST_NAMES        articles, titles and name connectors: never a first name
 *   usableFirstName(name)  the name's first word when it is three letters or
 *                          more and not one of those; else null
 *
 * Callers that find people in prose by a first name (services/seasonNeeds
 * nameMatcher, services/storyRipples, utils/scriptRuleChecks goalPerson) read
 * it here, and nameMatcher matches it only as written, capitalised: "Marcus"
 * names Marcus, "marcus" alone does not.
 */

const NOT_FIRST_NAMES = new Set([
  'the', 'a', 'an', 'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'sir', 'dame', 'lady', 'lord', 'madam', 'madame',
  'mademoiselle', 'monsieur', 'señor', 'senor', 'señora', 'senora', 'mister', 'aunt', 'auntie', 'uncle',
  'de', 'del', 'della', 'di', 'da', 'du', 'des', 'la', 'le', 'les', 'lo', 'los', 'las', 'van', 'von', 'der', 'den',
  'ten', 'ter', 'el', 'al', 'st', 'ste', 'saint', 'san', 'santa', 'mac', 'mc', 'o', 'of', 'and', 'by', 'for',
]);

/** The first word of a name, when it can name them alone; else null. */
function usableFirstName(name) {
  const full = String(name || '').trim();
  const first = full.split(/\s+/)[0] || '';
  if (!first || first === full) return null;
  const bare = first.toLowerCase().replace(/[.,'’]+$/g, '');
  if (bare.replace(/[^\p{L}\p{N}]/gu, '').length < 3) return null;
  if (NOT_FIRST_NAMES.has(bare)) return null;
  return first;
}

module.exports = { NOT_FIRST_NAMES, usableFirstName };
