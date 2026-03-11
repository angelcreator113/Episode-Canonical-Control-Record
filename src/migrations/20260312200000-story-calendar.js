'use strict';

/** Migration: 20260312200000-story-calendar
 *
 * Creates: story_clock_markers, story_calendar_events,
 *          calendar_event_attendees, calendar_event_ripples
 *
 * The temporal spine of the Feed Nervous System. Everything else
 * anchors to story_position via story_clock_markers.
 */

module.exports = {
  async up(queryInterface, Sequelize) {

    // Drop any partially-created tables from previous failed runs
    // (reverse order for FK constraints; safe since these are brand new tables)
    await queryInterface.dropTable('calendar_event_ripples').catch(() => {});
    await queryInterface.dropTable('calendar_event_attendees').catch(() => {});
    await queryInterface.dropTable('story_calendar_events').catch(() => {});
    await queryInterface.dropTable('story_clock_markers').catch(() => {});

    // Drop ENUM types that may have been partially created
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_story_calendar_events_event_type" CASCADE').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_story_calendar_events_visibility" CASCADE').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_story_calendar_events_logged_by" CASCADE').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_calendar_event_attendees_attendee_type" CASCADE').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_calendar_event_ripples_ripple_type" CASCADE').catch(() => {});
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_calendar_event_ripples_deep_profile_dimension" CASCADE').catch(() => {});

    // ═══════════════════════════════════════════════════════════════════════
    // 1. story_clock_markers — named story positions with real calendar dates
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('story_clock_markers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      calendar_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Actual story-time date (year 8385 calendar)',
      },
      sequence_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Lower = earlier in the story',
      },
      is_present: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Only one true at a time per series_id; enforce in API',
      },
      series_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Scoped to novel or show; never cross',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('story_clock_markers', ['sequence_order']);
    await queryInterface.addIndex('story_clock_markers', ['series_id']);
    await queryInterface.addIndex('story_clock_markers', ['calendar_date']);
    await queryInterface.addIndex('story_clock_markers', ['is_present']);

    // ═══════════════════════════════════════════════════════════════════════
    // 2. story_calendar_events — the events that happen in story time
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('story_calendar_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      event_type: {
        type: Sequelize.ENUM('world_event', 'story_event', 'character_event', 'lalaverse_cultural'),
        allowNull: false,
      },
      start_datetime: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Full story-time timestamp in year 8385',
      },
      end_datetime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_recurring: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      recurrence_pattern: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "Format: 'annual:03-15'",
      },
      location_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      location_address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      lalaverse_district: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "e.g. 'The Velvet District'",
      },
      visibility: {
        type: Sequelize.ENUM('public', 'private', 'underground'),
        defaultValue: 'public',
      },
      what_world_knows: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Public version of this event',
      },
      what_only_we_know: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Author layer — the actual truth',
      },
      logged_by: {
        type: Sequelize.ENUM('evoni', 'amber', 'system'),
        allowNull: true,
      },
      source_line_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'storyteller_lines', key: 'id' },
        onDelete: 'SET NULL',
      },
      story_position: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'story_clock_markers', key: 'id' },
        onDelete: 'SET NULL',
      },
      series_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('story_calendar_events', ['event_type']);
    await queryInterface.addIndex('story_calendar_events', ['start_datetime']);
    await queryInterface.addIndex('story_calendar_events', ['visibility']);
    await queryInterface.addIndex('story_calendar_events', ['lalaverse_district']);
    await queryInterface.addIndex('story_calendar_events', ['series_id']);
    await queryInterface.addIndex('story_calendar_events', ['story_position']);
    await queryInterface.addIndex('story_calendar_events', ['logged_by']);

    // ═══════════════════════════════════════════════════════════════════════
    // 3. calendar_event_attendees — who was there and what they experienced
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('calendar_event_attendees', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'story_calendar_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      character_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'SET NULL',
      },
      feed_profile_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'FK to social_profiles; UUID reference for polymorphic lookup',
      },
      attendee_type: {
        type: Sequelize.ENUM('confirmed', 'no_show', 'uninvited_arrival', 'watched_live', 'heard_about_it'),
        allowNull: false,
      },
      knew_about_event_before: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      left_early: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      what_they_experienced: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      author_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('calendar_event_attendees', ['event_id']);
    await queryInterface.addIndex('calendar_event_attendees', ['character_id']);
    await queryInterface.addIndex('calendar_event_attendees', ['feed_profile_id']);
    await queryInterface.addIndex('calendar_event_attendees', ['attendee_type']);

    // ═══════════════════════════════════════════════════════════════════════
    // 4. calendar_event_ripples — how events propagate through the world
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('calendar_event_ripples', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'story_calendar_events', key: 'id' },
        onDelete: 'CASCADE',
      },
      affected_character_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'registry_characters', key: 'id' },
        onDelete: 'SET NULL',
      },
      affected_feed_profile_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      ripple_type: {
        type: Sequelize.ENUM('witnessed', 'heard_secondhand', 'affected_by_outcome', 'doesnt_know_yet'),
        allowNull: false,
      },
      deep_profile_dimension: {
        type: Sequelize.ENUM(
          'ambition', 'desire', 'visibility', 'grief',
          'class', 'body', 'habits', 'belonging'
        ),
        allowNull: true,
      },
      intensity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '1–10 scale',
      },
      proposed_thread: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Amber generates via Claude. 2–3 sentence story thread.',
      },
      thread_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Evoni must confirm before canon',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('calendar_event_ripples', ['event_id']);
    await queryInterface.addIndex('calendar_event_ripples', ['affected_character_id']);
    await queryInterface.addIndex('calendar_event_ripples', ['affected_feed_profile_id']);
    await queryInterface.addIndex('calendar_event_ripples', ['ripple_type']);
    await queryInterface.addIndex('calendar_event_ripples', ['thread_confirmed']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('calendar_event_ripples');
    await queryInterface.dropTable('calendar_event_attendees');
    await queryInterface.dropTable('story_calendar_events');
    await queryInterface.dropTable('story_clock_markers');
  },
};
