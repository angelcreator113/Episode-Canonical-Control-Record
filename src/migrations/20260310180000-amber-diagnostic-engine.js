'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── amber_findings ─────────────────────────────────────────────────────
    // Every issue Amber detects lives here until resolved
    await queryInterface.createTable('amber_findings', {
      id: {
        type:          Sequelize.UUID,
        defaultValue:  Sequelize.UUIDV4,
        primaryKey:    true,
        allowNull:     false,
      },
      // Classification
      type: {
        type: Sequelize.ENUM(
          'broken_route',
          'mobile_layout',
          'duplicate_brain_entry',
          'missing_model_registration',
          'unapproved_memory',
          'franchise_law_violation',
          'narrative_gap',
          'database_inconsistency',
          'performance',
          'security',
          'feature_opportunity',
          'other'
        ),
        allowNull: false,
      },
      severity: {
        type:         Sequelize.ENUM('critical', 'high', 'medium', 'low', 'info'),
        allowNull:    false,
        defaultValue: 'medium',
      },
      // Description
      title:       { type: Sequelize.STRING(500),  allowNull: false },
      description: { type: Sequelize.TEXT,          allowNull: false },
      evidence:    { type: Sequelize.TEXT,          allowNull: true  },

      // Location
      affected_file:   { type: Sequelize.STRING(500), allowNull: true },
      affected_route:  { type: Sequelize.STRING(500), allowNull: true },
      affected_table:  { type: Sequelize.STRING(200), allowNull: true },
      affected_page:   { type: Sequelize.STRING(200), allowNull: true },

      // Fix proposal
      proposed_fix:       { type: Sequelize.TEXT,    allowNull: true },
      proposed_diff:      { type: Sequelize.TEXT,    allowNull: true },
      fix_confidence:     { type: Sequelize.INTEGER, allowNull: true },
      fix_category: {
        type: Sequelize.ENUM(
          'code_change',
          'database_cleanup',
          'config_update',
          'content_correction',
          'navigation_fix',
          'style_fix'
        ),
        allowNull: true,
      },

      // Permission level (Level 2 auto-approve)
      auto_approve_eligible: {
        type:         Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull:    false,
      },
      auto_approve_category: {
        type:      Sequelize.STRING(100),
        allowNull: true,
        comment:   'Category slug for Level 2 auto-approve when unlocked',
      },

      // Status lifecycle
      status: {
        type: Sequelize.ENUM(
          'detected',
          'surfaced',
          'approved',
          'dismissed',
          'executing',
          'applied',
          'failed',
          'escalated'
        ),
        allowNull:    false,
        defaultValue: 'detected',
      },

      // Execution results
      execution_log:    { type: Sequelize.TEXT,      allowNull: true },
      execution_result: { type: Sequelize.JSONB,     allowNull: true },
      applied_at:       { type: Sequelize.DATE,      allowNull: true },
      applied_diff:     { type: Sequelize.TEXT,       allowNull: true },

      // Amber's notes after execution
      amber_verdict:    { type: Sequelize.TEXT,      allowNull: true },

      // Surfacing
      surfaced_in_chat: { type: Sequelize.BOOLEAN,   defaultValue: false },
      urgent:           { type: Sequelize.BOOLEAN,   defaultValue: false },

      // Detection metadata
      detected_by:  { type: Sequelize.STRING(100), defaultValue: 'diagnostic_scan' },
      scan_run_id:  { type: Sequelize.UUID,         allowNull: true },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ── amber_scan_runs ────────────────────────────────────────────────────
    await queryInterface.createTable('amber_scan_runs', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
      },
      trigger:          { type: Sequelize.STRING(100), allowNull: false },
      status:           { type: Sequelize.ENUM('running', 'completed', 'failed'), defaultValue: 'running' },
      findings_count:   { type: Sequelize.INTEGER, defaultValue: 0 },
      critical_count:   { type: Sequelize.INTEGER, defaultValue: 0 },
      checks_run:       { type: Sequelize.JSONB,   allowNull: true },
      duration_ms:      { type: Sequelize.INTEGER, allowNull: true },
      error:            { type: Sequelize.TEXT,     allowNull: true },
      createdAt:        { type: Sequelize.DATE,     allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt:        { type: Sequelize.DATE,     allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ── amber_task_queue ───────────────────────────────────────────────────
    await queryInterface.createTable('amber_task_queue', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
      },
      title:       { type: Sequelize.STRING(500), allowNull: false },
      description: { type: Sequelize.TEXT,        allowNull: true  },
      type: {
        type: Sequelize.ENUM('feature', 'fix', 'decision', 'content', 'research'),
        defaultValue: 'feature',
      },
      priority:    { type: Sequelize.ENUM('urgent', 'high', 'medium', 'low'), defaultValue: 'medium' },
      status: {
        type:         Sequelize.ENUM('backlog', 'ready', 'in_progress', 'done', 'cancelled'),
        defaultValue: 'backlog',
      },
      source:            { type: Sequelize.STRING(200), allowNull: true  },
      linked_finding_id: { type: Sequelize.UUID,        allowNull: true  },
      spec:              { type: Sequelize.TEXT,         allowNull: true  },
      spec_approved:     { type: Sequelize.BOOLEAN,     defaultValue: false },
      amber_notes:       { type: Sequelize.TEXT,         allowNull: true  },
      createdAt:         { type: Sequelize.DATE,         allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt:         { type: Sequelize.DATE,         allowNull: false, defaultValue: Sequelize.NOW },
    });

    // Indexes
    await queryInterface.addIndex('amber_findings',   ['status']);
    await queryInterface.addIndex('amber_findings',   ['severity']);
    await queryInterface.addIndex('amber_findings',   ['type']);
    await queryInterface.addIndex('amber_findings',   ['urgent']);
    await queryInterface.addIndex('amber_findings',   ['surfaced_in_chat']);
    await queryInterface.addIndex('amber_task_queue',  ['status']);
    await queryInterface.addIndex('amber_task_queue',  ['priority']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('amber_task_queue');
    await queryInterface.dropTable('amber_scan_runs');
    await queryInterface.dropTable('amber_findings');
  },
};
