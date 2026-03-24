'use strict';

/**
 * Migration: Add 'generate_angle_video' to generation_jobs.job_type ENUM
 */

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_generation_jobs_job_type" ADD VALUE IF NOT EXISTS 'generate_angle_video';`
    );
  },

  async down() {
    // Postgres does not support removing ENUM values — no-op
  },
};
