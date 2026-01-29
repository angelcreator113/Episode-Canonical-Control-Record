/**
 * Add deleted_at column to existing composition_outputs table
 */

exports.up = (pgm) => {
  pgm.addColumns('composition_outputs', {
    deleted_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Soft delete timestamp - null means record is active',
    },
  });

  pgm.createIndex('composition_outputs', 'deleted_at', {
    name: 'idx_composition_outputs_deleted_at',
  });

  console.log('✅ Added deleted_at column to composition_outputs table');
};

exports.down = (pgm) => {
  pgm.dropIndex('composition_outputs', 'deleted_at', {
    name: 'idx_composition_outputs_deleted_at',
  });

  pgm.dropColumns('composition_outputs', ['deleted_at']);

  console.log('✅ Removed deleted_at column from composition_outputs table');
};
