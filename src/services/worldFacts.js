'use strict';

/**
 * The shared shape of world_state_snapshots.world_facts (review item 8,
 * 2026-10-04; migration 20261004140000).
 *
 * world_facts is a list of facts: strings, or objects with a `fact`
 * string. Two creators (the State tab, the chapter generator), three
 * readers (the context summary, scene proposals, story evaluation) and
 * three screens have always treated it that way. The temperature service
 * wrote an object ({ worldTemperature, temperatureUpdatedAt }) into its
 * own snapshots instead, so whenever one of those was the latest
 * snapshot every reader saw no facts, and whenever a list snapshot was
 * the latest the trajectory read a number off an array and stayed
 * STABLE. The temperature now lives in metadata.world_temperature.
 */

const factText = (f) => {
  if (typeof f === 'string') return f.trim();
  if (f && typeof f === 'object' && typeof f.fact === 'string') return f.fact.trim();
  return null;
};

/** The snapshot's facts as trimmed strings; never throws, never an object. */
function factsOf(snapshot) {
  const raw = snapshot?.world_facts;
  if (!Array.isArray(raw)) return [];
  return raw.map(factText).filter(Boolean);
}

/**
 * Checks a world_facts value from a request. Returns { facts } (the list
 * as given, with empty entries dropped) or { error } when it is not a
 * list of facts.
 */
function normalizeFacts(input) {
  if (input === undefined || input === null) return { facts: [] };
  if (!Array.isArray(input)) return { error: 'world_facts must be a list of facts (strings, or { fact })' };
  const facts = [];
  for (const f of input) {
    const text = factText(f);
    if (text === null) return { error: 'world_facts must be a list of facts (strings, or { fact })' };
    if (text) facts.push(typeof f === 'string' ? text : { ...f, fact: text });
  }
  return { facts };
}

/** The world temperature a snapshot recorded, or null. */
function temperatureOf(snapshot) {
  const t = snapshot?.metadata?.world_temperature;
  return t && typeof t.value === 'number' ? t : null;
}

module.exports = { factsOf, normalizeFacts, temperatureOf };
