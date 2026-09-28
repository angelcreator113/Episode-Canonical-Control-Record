'use strict';

/**
 * The framing sentence for the event suggest-names prompt
 * (POST /world/:showId/events/:eventId/suggest-names, src/routes/worldEvents.js).
 *
 * docs/EVENT_EPISODE_FLOW.md §8(u) R9: the prompt names the organizer's niche
 * and the event's concept, never "a fashion/lifestyle content-creator show",
 * and never the show name (doctrine rule 11). "Concept" is not a field yet
 * (task 4 adds it); until then it is the event's saved format, category and
 * description. Each missing piece is omitted; with none, the sentence is
 * "Name this fictional event." Task #2120.
 *
 * Pure; no I/O.
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

function buildSuggestNamesFraming(event, organizer) {
  const ev = event || {};
  const noun = words(ev.format) || 'event';
  const category = words(ev.category);
  const niche = words(organizer && organizer.content_category);

  let sentence = `Name this fictional ${noun}`;
  if (category) sentence += ` in the ${category} world`;
  if (niche) sentence += `, hosted by a ${niche} creator`;
  sentence += '.';

  const lead = descriptionLead(ev.description);
  if (lead) sentence += ` About it: ${/[.!?]$/.test(lead) ? lead : `${lead}.`}`;

  return sentence;
}

module.exports = { buildSuggestNamesFraming, descriptionLead, DESCRIPTION_MAX };
