'use strict';

/** Migration: 20260311200000-create-story-calendar-system
 *
 * Creates: story_calendar_events, calendar_event_attendees, calendar_event_ripples, story_clock_markers
 *
 * The story calendar tracks every event in LalaVerse time (year 8385+).
 * Events have a public face (what_world_knows) and a private truth (what_only_we_know).
 * Attendees record each character's specific experience of an event.
 * Ripples track how events propagate through the world — who heard, who was affected,
 * who still doesn't know. Amber can propose narrative threads from ripples.
 *
 * story_clock_markers gives named story positions ("Before Lala", "The Live She Watched Alone")
 * an actual calendar date in story time so the two systems talk to each other.
 */

module.exports = {
  async up(queryInterface, Sequelize) {

    // ═══════════════════════════════════════════════════════════════════════
    // 1. story_calendar_events
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('story_calendar_events', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

      title:      { type: Sequelize.STRING(300), allowNull: false },
      event_type: {
        type: Sequelize.ENUM('world_event', 'story_event', 'character_event', 'lalaverse_cultural'),
        allowNull: false,
      },

      // ── Story-time timestamps (year 8385, real month/day/time) ────────
      start_datetime: { type: Sequelize.DATE, allowNull: false },
      end_datetime:   { type: Sequelize.DATE, allowNull: true },

      // ── Recurrence ────────────────────────────────────────────────────
      is_recurring:       { type: Sequelize.BOOLEAN, defaultValue: false },
      recurrence_pattern: { type: Sequelize.STRING(200), allowNull: true },

      // ── Location ──────────────────────────────────────────────────────
      location_name:     { type: Sequelize.STRING(300), allowNull: true },
      location_address:  { type: Sequelize.STRING(400), allowNull: true },
      lalaverse_district: { type: Sequelize.STRING(200), allowNull: true },

      // ── Visibility & narrative layers ─────────────────────────────────
      visibility: {
        type: Sequelize.ENUM('public', 'private', 'underground'),
        defaultValue: 'public',
      },
      what_world_knows:  { type: Sequelize.TEXT, allowNull: true },
      what_only_we_know: { type: Sequelize.TEXT, allowNull: true },

      // ── Provenance ────────────────────────────────────────────────────
      logged_by: {
        type: Sequelize.ENUM('evoni', 'amber', 'system'),
        defaultValue: 'system',
      },
      source_line_id:  { type: Sequelize.UUID, allowNull: true },   // FK → storyteller_lines
      story_position:  { type: Sequelize.INTEGER, allowNull: true }, // FK → story_clock_markers
      series_id:       { type: Sequelize.INTEGER, allowNull: true },

      // ── Timestamps ────────────────────────────────────────────────────
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('story_calendar_events', ['event_type']);
    await queryInterface.addIndex('story_calendar_events', ['start_datetime']);
    await queryInterface.addIndex('story_calendar_events', ['visibility']);
    await queryInterface.addIndex('story_calendar_events', ['lalaverse_district']);
    await queryInterface.addIndex('story_calendar_events', ['series_id']);
    await queryInterface.addIndex('story_calendar_events', ['story_position']);

    // ═══════════════════════════════════════════════════════════════════════
    // 2. calendar_event_attendees
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('calendar_event_attendees', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

      event_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'story_calendar_events', key: 'id' },
        onDelete: 'CASCADE',
      },

      // One of these two will be set depending on attendee origin
      character_id:    { type: Sequelize.UUID, allowNull: true },    // FK → registry_characters
      feed_profile_id: { type: Sequelize.INTEGER, allowNull: true }, // FK → social_profiles

      attendee_type: {
        type: Sequelize.ENUM('confirmed', 'no_show', 'uninvited_arrival', 'watched_live', 'heard_about_it'),
        allowNull: false,
        defaultValue: 'confirmed',
      },
      knew_about_event_before: { type: Sequelize.BOOLEAN, defaultValue: true },
      left_early:              { type: Sequelize.BOOLEAN, defaultValue: false },

      // ── Their specific experience (differs from public record) ────────
      what_they_experienced: { type: Sequelize.TEXT, allowNull: true },
      author_note:           { type: Sequelize.TEXT, allowNull: true },

      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('calendar_event_attendees', ['event_id']);
    await queryInterface.addIndex('calendar_event_attendees', ['character_id']);
    await queryInterface.addIndex('calendar_event_attendees', ['feed_profile_id']);
    await queryInterface.addIndex('calendar_event_attendees', ['attendee_type']);

    // ═══════════════════════════════════════════════════════════════════════
    // 3. calendar_event_ripples
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('calendar_event_ripples', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

      event_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'story_calendar_events', key: 'id' },
        onDelete: 'CASCADE',
      },

      // Who the ripple reaches — character or feed profile
      affected_character_id:    { type: Sequelize.UUID, allowNull: true },
      affected_feed_profile_id: { type: Sequelize.INTEGER, allowNull: true },

      ripple_type: {
        type: Sequelize.ENUM('witnessed', 'heard_secondhand', 'affected_by_outcome', 'doesnt_know_yet'),
        allowNull: false,
      },
      deep_profile_dimension: { type: Sequelize.STRING(200), allowNull: true },
      intensity:              { type: Sequelize.INTEGER, allowNull: true }, // 1–10

      // ── Amber's proposed narrative thread ─────────────────────────────
      proposed_thread:  { type: Sequelize.TEXT, allowNull: true },
      thread_confirmed: { type: Sequelize.BOOLEAN, defaultValue: false },

      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('calendar_event_ripples', ['event_id']);
    await queryInterface.addIndex('calendar_event_ripples', ['affected_character_id']);
    await queryInterface.addIndex('calendar_event_ripples', ['affected_feed_profile_id']);
    await queryInterface.addIndex('calendar_event_ripples', ['ripple_type']);
    await queryInterface.addIndex('calendar_event_ripples', ['thread_confirmed']);

    // ═══════════════════════════════════════════════════════════════════════
    // 4. story_clock_markers (new table with calendar_date)
    // ═══════════════════════════════════════════════════════════════════════

    await queryInterface.createTable('story_clock_markers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

      marker_name: { type: Sequelize.STRING(300), allowNull: false, unique: true },
      // e.g. "Before Lala", "The Live She Watched Alone", "After the Showroom"

      description: { type: Sequelize.TEXT, allowNull: true },

      // ── The calendar date in story time ───────────────────────────────
      // Maps named markers to actual dates: "August 4th, 8385"
      calendar_date: { type: Sequelize.DATE, allowNull: true },

      // ── Story position (ordering) ─────────────────────────────────────
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },

      // ── Scope ─────────────────────────────────────────────────────────
      series_id: { type: Sequelize.INTEGER, allowNull: true },

      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('story_clock_markers', ['sort_order']);
    await queryInterface.addIndex('story_clock_markers', ['series_id']);
    await queryInterface.addIndex('story_clock_markers', ['calendar_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('calendar_event_ripples');
    await queryInterface.dropTable('calendar_event_attendees');
    await queryInterface.dropTable('story_calendar_events');
    await queryInterface.dropTable('story_clock_markers');
  },
};
