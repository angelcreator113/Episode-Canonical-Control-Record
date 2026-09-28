'use strict';

/**
 * The framing sentence for the event suggest-names prompt
 * (POST /world/:showId/events/:eventId/suggest-names, src/routes/worldEvents.js).
 *
 * docs/EVENT_EPISODE_FLOW.md §8(u) R9: the prompt names the organizer's niche
 * and the event's concept, never "a fashion/lifestyle content-creator show",
 * and never the show name (doctrine rule 11). The concept is the event's
 * saved format plus its drafted concept (canon_consequences.automation.
 * concept, Task #2135) when it has one, else its description; the concept
 * replaces the description rather than adding to it, and is capped the same
 * way. Category is left to the prompt's own fact lines (Evoni, Task #2120
 * review). Each missing piece is omitted; with none, the sentence is "Name
 * this fictional event." Task #2120.
 *
 * Pure; no I/O beyond a warning when canon_consequences does not parse.
 */

const DESCRIPTION_MAX = 200;

const words = (v) => (typeof v === 'string' ? v.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() : '');

// First sentence of the description, capped at DESCRIPTION_MAX characters and
// cut at a word boundary. '' when there is nothing to use.
function descriptionLead(description) {
  const text = typeof description === 'string' ? description.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  let lead = match ? match[0] : text;
  if (lead.length > DESCRIPTION_MAX) {
    const cut = lead.slice(0, DESCRIPTION_MAX + 1);
    const lastSpace = cut.lastIndexOf(' ');
    lead = (lastSpace > 0 ? cut.slice(0, lastSpace) : lead.slice(0, DESCRIPTION_MAX)).replace(/[\s,;:]+$/, '');
  }
  return lead;
}

// The drafted concept from canon_consequences.automation, or ''. A raw
// query may return the JSONB column as a string.
function conceptOf(event) {
  let cc = event && event.canon_consequences;
  if (typeof cc === 'string') {
    try {
      cc = JSON.parse(cc);
    } catch (err) {
      console.warn('[suggestNamesFraming] canon_consequences is not JSON; framing without a concept:', err.message);
      return '';
    }
  }
  const concept = cc && cc.automation && cc.automation.concept;
  return typeof concept === 'string' ? concept : '';
}

function buildSuggestNamesFraming(event, organizer) {
  const ev = event || {};
  const noun = words(ev.format) || 'event';
  const niche = words(organizer && organizer.content_category);

  let sentence = `Name this fictional ${noun}`;
  if (niche) sentence += `, hosted by a ${niche} creator`;
  sentence += '.';

  const lead = descriptionLead(conceptOf(ev)) || descriptionLead(ev.description);
  if (lead) sentence += ` About it: ${/[.!?]$/.test(lead) ? lead : `${lead}.`}`;

  return sentence;
}

module.exports = { buildSuggestNamesFraming, descriptionLead, conceptOf, DESCRIPTION_MAX };
