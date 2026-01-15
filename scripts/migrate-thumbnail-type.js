/**
 * Manual migration script to add missing columns to thumbnails table
 * Run this with: node scripts/migrate-thumbnail-type.js
 */

require('dotenv').config();
const db = require('../src/models');

async function migrate() {
  try {
    console.log('🚀 Starting migration...');
    console.log('Database:', process.env.DATABASE_URL?.split('/').pop());

    // Connect to database
    await db.sequelize.authenticate();
    console.log('✅ Database connected');

    // List of columns and their definitions to add
    const columnsToAdd = [
      {
        name: 's3_bucket',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(255) NOT NULL DEFAULT 'episode-metadata-thumbnails-dev'"
      },
      {
        name: 's3_key',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS s3_key VARCHAR(512) UNIQUE"
      },
      {
        name: 'file_size_bytes',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER"
      },
      {
        name: 'mime_type',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50) DEFAULT 'image/jpeg'"
      },
      {
        name: 'width_pixels',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS width_pixels INTEGER"
      },
      {
        name: 'height_pixels',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS height_pixels INTEGER"
      },
      {
        name: 'format',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS format VARCHAR(20)"
      },
      {
        name: 'position_seconds',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS position_seconds INTEGER"
      },
      {
        name: 'generated_at',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
      },
      {
        name: 'quality_rating',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS quality_rating NUMERIC(3,2)"
      },
      {
        name: 'thumbnail_type',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS thumbnail_type VARCHAR(50) DEFAULT 'primary'"
      },
      {
        name: 'created_at',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
      },
      {
        name: 'updated_at',
        sql: "ALTER TABLE thumbnails ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
      }
    ];

    // Add each column
    for (const col of columnsToAdd) {
      try {
        console.log(`Adding column ${col.name}...`);
        await db.sequelize.query(col.sql);
        console.log(`✅ Column ${col.name} added/verified`);
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('Duplicate column')) {
          console.log(`✓ Column ${col.name} already exists`);
        } else {
          console.warn(`⚠ Warning adding ${col.name}: ${err.message}`);
        }
      }
    }

    // Create indexes
    const indexesToCreate = [
      {
        name: 'idx_episode_id',
        sql: "CREATE INDEX IF NOT EXISTS idx_episode_id ON thumbnails(episode_id)"
      },
      {
        name: 'idx_s3_key',
        sql: "CREATE INDEX IF NOT EXISTS idx_s3_key ON thumbnails(s3_key)"
      },
      {
        name: 'idx_thumbnail_type',
        sql: "CREATE INDEX IF NOT EXISTS idx_thumbnail_type ON thumbnails(episode_id, thumbnail_type)"
      }
    ];

    for (const idx of indexesToCreate) {
      try {
        console.log(`Creating index ${idx.name}...`);
        await db.sequelize.query(idx.sql);
        console.log(`✅ Index ${idx.name} created/verified`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`✓ Index ${idx.name} already exists`);
        } else {
          console.warn(`⚠ Warning creating ${idx.name}: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.original) {
      console.error('Database error:', error.original.message);
    }
    process.exit(1);
  }
}

migrate();
