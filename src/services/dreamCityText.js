'use strict';

/**
 * One DREAM city list (Evoni, 2026-10-18: "start the one DREAM city list";
 * the world-level audit found every writer read the fixed texts in
 * utils/feedCities DREAM_CITY_CULTURE, so a city edited in World Foundation
 * changed the pages and none of the writing).
 *
 * The list is the saved one, page_content world_infrastructure ›
 * DREAM_CITIES, the list World Foundation and The Pulse edit; each city's
 * text for a prompt is made from its saved words (culture, energy, what it
 * is known for, who lives there, its big events). A city with no saved
 * words, or no saved list, keeps its built-in text.
 *
 *   cityText(city)  a saved city's prompt text, or '' when it has no words
 *   cityCultures(db)  { key: text } for the five cities, read at most once
 *     a minute (a save clears it: forgetCityCultures); the built-in texts on
 *     a failed read (logged)
 */

const { DREAM_CITY_CULTURE, DREAM_CITY_KEYS } = require('../utils/feedCities');

const TTL_MS = 60 * 1000;
let cached = null;

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const sentence = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

function cityText(city) {
  if (!city || typeof city !== 'object') return '';
  const famous = clean(city.famousFor);
  const who = clean(city.whoLivesHere);
  const events = (Array.isArray(city.majorEvents) ? city.majorEvents : []).map(clean).filter(Boolean);
  const parts = [
    clean(city.culture),
    clean(city.energy),
    famous && `Known for ${lowerFirst(famous)}`,
    who && `Home to ${lowerFirst(who)}`,
    events.length && `Its big events: ${events.join(', ')}`,
  ].filter(Boolean).map(sentence);
  // The same sentence said twice (the culture and the energy often share one) is said once.
  const seen = new Set();
  const out = [];
  for (const s of parts.join(' ').match(/[^.!?]+[.!?]+/g) || []) {
    const t = s.trim();
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.join(' ');
}

async function cityCultures(db) {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cultures;
  const cultures = { ...DREAM_CITY_CULTURE };
  try {
    const [row] = await db.sequelize.query(
      "SELECT data FROM page_content WHERE page_name = 'world_infrastructure' AND constant_key = 'DREAM_CITIES'",
      { type: db.sequelize.QueryTypes.SELECT });
    for (const city of Array.isArray(row?.data) ? row.data : []) {
      if (!DREAM_CITY_KEYS.includes(city?.key)) continue;
      const text = cityText(city);
      if (text) cultures[city.key] = text;
    }
  } catch (err) {
    console.error('[dreamCityText] the saved DREAM cities could not be read; using the built-in texts:', err.message);
    return Object.freeze(cultures);
  }
  cached = { at: Date.now(), cultures: Object.freeze(cultures) };
  return cached.cultures;
}

function forgetCityCultures() { cached = null; }

module.exports = { cityText, cityCultures, forgetCityCultures };
