'use strict';

/** Seeder: LalaVerse Cultural Calendar
 *
 * Recurring events that define the cultural rhythm of LalaVerse.
 * Run after story_calendar_events table exists.
 */

const { v4: uuidv4 } = require('uuid');

// Year 8385 dates using real month/day structure
function storyDate(month, day, hour = 0) {
  // Use year 8385 conceptually; stored as 8385-MM-DD in timestamp
  return new Date(`8385-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`);
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const events = [
      {
        id: uuidv4(),
        title: 'LalaVerse Fashion Week',
        event_type: 'lalaverse_cultural',
        start_datetime: storyDate(3, 15),
        end_datetime: storyDate(3, 22),
        is_recurring: true,
        recurrence_pattern: 'annual:03-15',
        location_name: 'The Velvet District Showroom',
        location_address: 'Central Lux Row, LalaVerse',
        lalaverse_district: 'The Velvet District',
        visibility: 'public',
        what_world_knows: 'The annual showcase where emerging and established LalaVerse designers unveil their collections. Invitations are currency. Attendance is proof of relevance.',
        what_only_we_know: 'The real negotiations happen backstage. Alliances form and break over seating assignments.',
        logged_by: 'system',
        series_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        title: 'Algorithm Reset Season',
        event_type: 'lalaverse_cultural',
        start_datetime: storyDate(1, 1),
        end_datetime: storyDate(1, 7),
        is_recurring: true,
        recurrence_pattern: 'annual:01-01',
        location_name: null,
        location_address: null,
        lalaverse_district: null,
        visibility: 'public',
        what_world_knows: 'The first week of each year — feeds reset, visibility shuffles. A fresh start or a death sentence depending on your position.',
        what_only_we_know: 'The algorithm doesn\'t actually reset. But the belief that it does causes real behavioral shifts.',
        logged_by: 'system',
        series_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        title: 'Brand Deal Season',
        event_type: 'lalaverse_cultural',
        start_datetime: storyDate(9, 1),
        end_datetime: storyDate(10, 31),
        is_recurring: true,
        recurrence_pattern: 'annual:09-01',
        location_name: null,
        location_address: null,
        lalaverse_district: null,
        visibility: 'public',
        what_world_knows: 'September through October — when brands lock in partnerships for the following year. Two months of pitches, negotiations, and quiet panics.',
        what_only_we_know: 'The profiles who don\'t get deals during this window start performing desperation by November.',
        logged_by: 'system',
        series_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        title: 'The Crossing Ceremony',
        event_type: 'lalaverse_cultural',
        start_datetime: storyDate(6, 21),
        end_datetime: null,
        is_recurring: true,
        recurrence_pattern: 'annual:06-21',
        location_name: 'The Threshold',
        location_address: 'The boundary where internal and public meet',
        lalaverse_district: 'The Threshold District',
        visibility: 'public',
        what_world_knows: 'The annual ceremony marking the moment a private character becomes a public figure. Crossing Day. June 21st.',
        what_only_we_know: 'Not everyone who crosses was ready. The ceremony marks the moment — it doesn\'t guarantee the outcome.',
        logged_by: 'system',
        series_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        title: 'The Unfollow Wave',
        event_type: 'world_event',
        start_datetime: storyDate(1, 1), // placeholder — triggered by controversy
        end_datetime: null,
        is_recurring: false,
        recurrence_pattern: null,
        location_name: null,
        location_address: null,
        lalaverse_district: null,
        visibility: 'public',
        what_world_knows: 'A mass unfollowing event triggered by controversy. Not date-based — happens when it happens.',
        what_only_we_know: 'Template event. Instantiate when a specific controversy triggers a wave.',
        logged_by: 'system',
        series_id: null,
        created_at: now,
        updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('story_calendar_events', events);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('story_calendar_events', {
      logged_by: 'system',
      event_type: ['lalaverse_cultural', 'world_event'],
    });
  },
};
