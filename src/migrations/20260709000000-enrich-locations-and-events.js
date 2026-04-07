'use strict';

/**
 * Migration: Enrich WorldLocations + Create WorldEvent Sequelize model
 *
 * 1. Adds address, venue, and hierarchy fields to world_locations
 * 2. Creates a proper world_events Sequelize-managed model (the existing
 *    table was created via raw SQL with no model — this adds the missing
 *    venue/address/guest fields and creates the Sequelize model)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. Enrich world_locations ──────────────────────────────────────

    // Address fields — so any location can be placed on a map
    await queryInterface.addColumn('world_locations', 'street_address', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Street address: "742 Ocean Drive"',
    });

    await queryInterface.addColumn('world_locations', 'city', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'City name: "Miami"',
    });

    await queryInterface.addColumn('world_locations', 'district', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Neighborhood/district: "South Beach"',
    });

    await queryInterface.addColumn('world_locations', 'coordinates', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ lat, lng } for map placement',
    });

    // Venue-specific fields
    await queryInterface.addColumn('world_locations', 'venue_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Business type: restaurant, club, cafe, salon, gallery, shopping, gym, studio',
    });

    await queryInterface.addColumn('world_locations', 'venue_details', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ hours, price_level, capacity, dress_code, vibe_tags, menu_style, website }',
    });

    // Property fields (for HOME_BASE hierarchy)
    await queryInterface.addColumn('world_locations', 'style_guide', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Property style guide — materials, palette, architecture cascading to child rooms',
    });

    await queryInterface.addColumn('world_locations', 'floor_plan', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Floor plan — room connections, spatial layout',
    });

    await queryInterface.addColumn('world_locations', 'property_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Property classification: penthouse, mansion, apartment, townhouse, studio',
    });

    // ── 2. Add venue + guest fields to world_events ────────────────────

    // Check if columns exist before adding (they may not exist if table was created differently)
    const tableDesc = await queryInterface.describeTable('world_events').catch(() => ({}));

    if (!tableDesc.venue_location_id) {
      await queryInterface.addColumn('world_events', 'venue_location_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'world_locations', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'FK to WorldLocation — the venue where this event takes place',
      });
    }

    if (!tableDesc.venue_name) {
      await queryInterface.addColumn('world_events', 'venue_name', {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Display name: "Club Noir" (may differ from WorldLocation name)',
      });
    }

    if (!tableDesc.venue_address) {
      await queryInterface.addColumn('world_events', 'venue_address', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Full address for invitation: "742 Ocean Drive, South Beach, Miami"',
      });
    }

    if (!tableDesc.event_date) {
      await queryInterface.addColumn('world_events', 'event_date', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Story date of the event: "Friday, March 15th" or "Tonight at 9pm"',
      });
    }

    if (!tableDesc.event_time) {
      await queryInterface.addColumn('world_events', 'event_time', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Event time: "9:00 PM - 2:00 AM"',
      });
    }

    if (!tableDesc.guest_list) {
      await queryInterface.addColumn('world_events', 'guest_list', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of { character_id, character_name, rsvp_status, plus_one }',
      });
    }

    if (!tableDesc.invitation_details) {
      await queryInterface.addColumn('world_events', 'invitation_details', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null,
        comment: '{ tagline, rsvp_by, attire_note, special_instructions, hosted_by }',
      });
    }

    if (!tableDesc.deleted_at) {
      await queryInterface.addColumn('world_events', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp',
      });
    }

    // Add indexes
    await queryInterface.addIndex('world_events', ['venue_location_id'], {
      name: 'idx_world_events_venue_location',
    }).catch(() => {}); // ignore if exists
  },

  async down(queryInterface) {
    // world_locations
    await queryInterface.removeColumn('world_locations', 'street_address').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'city').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'district').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'coordinates').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'venue_type').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'venue_details').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'style_guide').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'floor_plan').catch(() => {});
    await queryInterface.removeColumn('world_locations', 'property_type').catch(() => {});

    // world_events
    await queryInterface.removeColumn('world_events', 'venue_location_id').catch(() => {});
    await queryInterface.removeColumn('world_events', 'venue_name').catch(() => {});
    await queryInterface.removeColumn('world_events', 'venue_address').catch(() => {});
    await queryInterface.removeColumn('world_events', 'event_date').catch(() => {});
    await queryInterface.removeColumn('world_events', 'event_time').catch(() => {});
    await queryInterface.removeColumn('world_events', 'guest_list').catch(() => {});
    await queryInterface.removeColumn('world_events', 'invitation_details').catch(() => {});
    await queryInterface.removeColumn('world_events', 'deleted_at').catch(() => {});
  },
};
