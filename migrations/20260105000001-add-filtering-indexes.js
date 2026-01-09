exports.up = (pgm) => {
  // Step 1: Create indexes for filter columns to optimize query performance
  pgm.createIndex('thumbnail_compositions', 'status', {
    name: 'idx_composition_status',
  });

  pgm.createIndex('thumbnail_compositions', 'created_at', {
    name: 'idx_composition_created_at',
    direction: 'DESC',
  });

  pgm.createIndex('thumbnail_compositions', 'updated_at', {
    name: 'idx_composition_updated_at',
    direction: 'DESC',
  });

  pgm.createIndex('thumbnail_compositions', 'template_id', {
    name: 'idx_composition_template_id',
  });

  pgm.createIndex('thumbnail_compositions', 'created_by', {
    name: 'idx_composition_created_by',
  });

  pgm.createIndex('thumbnail_compositions', 'episode_id', {
    name: 'idx_composition_episode_id',
  });

  // Step 2: Create GIN index for JSONB array searching (for formats)
  pgm.createIndex(
    'thumbnail_compositions',
    'selected_formats',
    {
      name: 'idx_composition_selected_formats_gin',
      using: 'gin',
    }
  );

  // Step 3: Create full-text search index for name and description
  pgm.sql(`
    CREATE INDEX "idx_composition_name_search"
    ON "thumbnail_compositions"
    USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')))
  `);

  // Step 4: Create composite indexes for common filter combinations
  pgm.createIndex(
    'thumbnail_compositions',
    ['episode_id', 'status'],
    {
      name: 'idx_composition_episode_status',
    }
  );

  pgm.createIndex(
    'thumbnail_compositions',
    ['episode_id', 'created_at'],
    {
      name: 'idx_composition_episode_created',
      direction: 'DESC',
    }
  );
};

exports.down = (pgm) => {
  // Drop all indexes in reverse order
  pgm.dropIndex('thumbnail_compositions', 'idx_composition_episode_created', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_episode_status', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_name_search', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_selected_formats_gin', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_created_by', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_template_id', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_updated_at', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_created_at', {
    ifExists: true,
  });

  pgm.dropIndex('thumbnail_compositions', 'idx_composition_status', {
    ifExists: true,
  });
};
