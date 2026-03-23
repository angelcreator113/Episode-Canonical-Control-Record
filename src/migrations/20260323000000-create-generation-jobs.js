'use strict';

/**
 * Migration: Create generation_jobs table
 *
 * Database-backed async job queue for scene generation.
 * Routes enqueue jobs (return 202), worker process picks them up and
 * delegates to sceneGenerationService for the actual Runway pipeline.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table already exists (idempotent — safe to re-run after rename)
    const [tables] = await queryInterface.sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'generation_jobs'`
    );
    if (tables.length > 0) {
      console.log('generation_jobs table already exists — skipping creation');
      return;
    }

    await queryInterface.createTable('generation_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },

      // Job type
      job_type: {
        type: Sequelize.ENUM(
          'generate_base',
          'generate_angle',
          'regenerate_angle',
          'cascade_regenerate'
        ),
        allowNull: false,
      },

      // Status lifecycle: queued → processing → completed / failed
      status: {
        type: Sequelize.ENUM('queued', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'queued',
      },

      // Reference to scene_sets (table created by model sync, not migration)
      scene_set_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      // Reference to scene_angles (null for generate_base and cascade)
      scene_angle_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      // Input payload (prompt overrides, force flag, categories, etc.)
      payload: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },

      // Output result (URLs, seed, quality data)
      result: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      // Error message on failure
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Processing metadata
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Higher = higher priority. Default 0.',
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },

      // Timestamps
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Index for the worker polling query: find queued jobs ordered by priority
    await queryInterface.addIndex('generation_jobs', ['status', 'priority'], {
      name: 'idx_generation_jobs_status_priority',
    });

    // Index for frontend polling: look up jobs by scene_set_id
    await queryInterface.addIndex('generation_jobs', ['scene_set_id', 'status'], {
      name: 'idx_generation_jobs_scene_set_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('generation_jobs');
  },
};
