'use strict';

/**
 * Seasonal Event Generator Service
 *
 * Auto-generates seasonal events for a given month based on the
 * Cultural Calendar framework. Uses Claude to create culturally
 * relevant events that feed profiles can host.
 */

const Anthropic = require('@anthropic-ai/sdk');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Feed event templates with seasonal affinities
const FEED_EVENT_TEMPLATES = [
  { name: 'Creator Roast Night', category: 'creator_economy', affinities: ['fashion_week', 'award_season', 'summer'] },
  { name: 'Fashion Mystery Box', category: 'fashion', affinities: ['fashion_week', 'holiday'] },
  { name: 'Creator Speed Dating', category: 'creator_economy', affinities: ['fashion_week', 'art_basel', 'spring'] },
  { name: 'Street Style Marathon', category: 'fashion', affinities: ['fashion_week', 'summer', 'spring'] },
  { name: 'Beauty Battles', category: 'beauty', affinities: ['award_season', 'art_basel', 'summer'] },
  { name: 'Design Lab Week', category: 'creative', affinities: ['art_basel', 'spring'] },
  { name: 'Artist Residency Month', category: 'creative', affinities: ['art_basel', 'winter', 'fall'] },
  { name: 'Virtual Travel Festival', category: 'lifestyle', affinities: ['summer', 'holiday', 'spring'] },
  { name: 'Community Build Week', category: 'creator_economy', affinities: ['award_season', 'spring', 'new_year'] },
  { name: 'Creator Charity Week', category: 'creator_economy', affinities: ['holiday', 'fall'] },
  { name: 'Midnight Music Festival', category: 'music', affinities: ['summer', 'spring'] },
  { name: 'The Great Glow-Up Challenge', category: 'beauty', affinities: ['new_year', 'spring', 'summer'] },
  { name: 'Creator Talent Show', category: 'creator_economy', affinities: ['summer', 'fall'] },
];

// Season tags per month
const MONTH_SEASONS = {
  0: ['new_year', 'winter'], 1: ['winter', 'valentine'], 2: ['spring', 'fashion_week'],
  3: ['spring'], 4: ['spring', 'summer'], 5: ['summer'],
  6: ['summer'], 7: ['summer'], 8: ['fall', 'fashion_week'],
  9: ['fall', 'halloween'], 10: ['fall', 'award_season'], 11: ['holiday', 'art_basel', 'winter'],
};

/**
 * Get feed event templates relevant to a given month.
 */
function getRelevantTemplates(month) {
  const seasons = MONTH_SEASONS[month] || [];
  return FEED_EVENT_TEMPLATES.filter(t =>
    t.affinities.some(a => seasons.includes(a))
  );
}

/**
 * Auto-generate seasonal events for a month using Claude.
 *
 * @param {number} month — 0-11
 * @param {string} showId
 * @param {object} models — Sequelize models
 * @param {object} options — { count: 3-5, year: 2026 }
 * @returns {Array} created StoryCalendarEvent records
 */
async function generateSeasonalEvents(month, showId, models, options = {}) {
  const { count = 4, year = 2026 } = options;
  const { StoryCalendarEvent } = models;

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  if (!StoryCalendarEvent) throw new Error('StoryCalendarEvent model not loaded');

  const monthName = MONTH_NAMES[month];
  const seasons = MONTH_SEASONS[month] || [];
  const relevantTemplates = getRelevantTemplates(month);

  // Check existing events for this month to avoid duplicates
  const { Op } = require('sequelize');
  const existing = await StoryCalendarEvent.findAll({
    where: {
      event_type: 'lalaverse_cultural',
      start_datetime: {
        [Op.gte]: new Date(year, month, 1),
        [Op.lt]: new Date(year, month + 1, 1),
      },
    },
    attributes: ['title'],
  });
  const existingTitles = existing.map(e => e.title?.toLowerCase());

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Generate ${count} cultural events for the LalaVerse in ${monthName} ${year}.

The LalaVerse is a constructed digital reality for content creators, influencers, and fashion/beauty industry.

SEASONAL CONTEXT: ${seasons.join(', ')}
RELEVANT FEED EVENT TYPES: ${relevantTemplates.map(t => t.name).join(', ')}
ALREADY EXISTS: ${existingTitles.join(', ') || 'none'}

Generate events that are BIG cultural moments — fashion weeks, award shows, brand launches, creator summits. NOT micro events.

Return JSON array:
[
  {
    "title": "Event name",
    "cultural_category": "fashion|beauty|music|art|creator_economy|lifestyle|nightlife|charity",
    "severity_level": 1-10,
    "what_world_knows": "Public description — what everyone sees",
    "what_only_we_know": "Secret narrative layer — what's really happening",
    "location_name": "Venue or area name",
    "activities": ["activity1", "activity2"],
    "phrases": ["catchphrase or hashtag"],
    "start_day": 1-28,
    "duration_days": 1-7,
    "inspires_feed_events": ["feed event template names this could spawn"]
  }
]

Return ONLY the JSON array.`,
    }],
  });

  const text = response.content?.[0]?.text || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude returned no JSON array');

  let events;
  try {
    events = JSON.parse(match[0].replace(/,\s*([\]}])/g, '$1'));
  } catch {
    throw new Error('Failed to parse seasonal events JSON');
  }

  // Create calendar events
  const created = [];
  for (const ev of events) {
    if (existingTitles.includes(ev.title?.toLowerCase())) continue;

    const startDate = new Date(year, month, ev.start_day || 15);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (ev.duration_days || 1));

    const record = await StoryCalendarEvent.create({
      title: ev.title,
      event_type: 'lalaverse_cultural',
      cultural_category: ev.cultural_category || 'fashion',
      severity_level: ev.severity_level || 5,
      what_world_knows: ev.what_world_knows || ev.title,
      what_only_we_know: ev.what_only_we_know || null,
      location_name: ev.location_name || null,
      activities: ev.activities || [],
      phrases: ev.phrases || [],
      start_datetime: startDate,
      end_datetime: endDate,
      visibility: 'public',
      is_micro_event: false,
    });

    created.push(record);
  }

  return { created, month: monthName, count: created.length };
}

module.exports = {
  generateSeasonalEvents,
  getRelevantTemplates,
  FEED_EVENT_TEMPLATES,
  MONTH_SEASONS,
};
