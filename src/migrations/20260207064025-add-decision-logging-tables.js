exports.up = async (pgm) => {
  // user_decisions table
  pgm.createTable('user_decisions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_id: {
      type: 'uuid',
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    scene_id: {
      type: 'uuid',
      references: 'scenes',
      onDelete: 'SET NULL',
    },
    decision_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    decision_category: {
      type: 'varchar(50)',
      notNull: true,
    },
    chosen_option: {
      type: 'jsonb',
      notNull: true,
    },
    rejected_options: {
      type: 'jsonb',
    },
    was_ai_suggestion: {
      type: 'boolean',
      default: false,
    },
    ai_confidence_score: {
      type: 'decimal(3,2)',
    },
    user_rating: {
      type: 'integer',
    },
    user_notes: {
      type: 'text',
    },
    context_data: {
      type: 'jsonb',
    },
    timestamp: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    created_by: {
      type: 'varchar(255)',
    },
  });

  // Indexes for user_decisions
  pgm.createIndex('user_decisions', 'episode_id');
  pgm.createIndex('user_decisions', 'scene_id');
  pgm.createIndex('user_decisions', 'decision_type');
  pgm.createIndex('user_decisions', 'decision_category');
  pgm.createIndex('user_decisions', 'timestamp');
  pgm.createIndex('user_decisions', 'was_ai_suggestion');
  
  // GIN indexes for JSONB
  pgm.createIndex('user_decisions', 'chosen_option', {
    method: 'gin',
  });
  pgm.createIndex('user_decisions', 'context_data', {
    method: 'gin',
  });

  // decision_patterns table
  pgm.createTable('decision_patterns', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    pattern_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    pattern_category: {
      type: 'varchar(50)',
      notNull: true,
    },
    pattern_data: {
      type: 'jsonb',
      notNull: true,
    },
    sample_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    confidence_score: {
      type: 'decimal(3,2)',
      notNull: true,
    },
    last_updated: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    first_detected: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('NOW()'),
    },
  });

  // Indexes for decision_patterns
  pgm.createIndex('decision_patterns', 'pattern_type');
  pgm.createIndex('decision_patterns', 'pattern_category');
  pgm.createIndex('decision_patterns', 'confidence_score');
  pgm.createIndex('decision_patterns', 'sample_count');

  // Add check constraint
  pgm.addConstraint('user_decisions', 'user_rating_check', {
    check: 'user_rating BETWEEN 1 AND 5',
  });
};

exports.down = async (pgm) => {
  pgm.dropTable('decision_patterns');
  pgm.dropTable('user_decisions');
};
