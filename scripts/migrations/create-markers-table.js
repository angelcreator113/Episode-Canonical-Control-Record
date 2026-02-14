#!/usr/bin/env node
/**
 * Create markers table for Timeline View (Phase 2 Week 1)
 * Episode-scoped markers with optional scene references
 */

require('dotenv').config();
const { Client } = require('pg');

async function createMarkersTable() {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'episode_metadata',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Ayanna123',
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('🔄 Creating markers table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS markers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
        
        -- Timing (absolute episode time)
        timecode DECIMAL(10,2) NOT NULL CHECK (timecode >= 0),
        
        -- Metadata
        title VARCHAR(255),
        marker_type VARCHAR(50) DEFAULT 'note',
        category VARCHAR(50),
        tags TEXT[],
        color VARCHAR(7) DEFAULT '#3B82F6',
        description TEXT,
        
        -- Scene context (auto-calculated)
        scene_relative_timecode DECIMAL(10,2),
        
        -- Deliverable tracking
        deliverable_id VARCHAR(100),
        fulfillment_checkpoint BOOLEAN DEFAULT FALSE,
        
        -- Audit fields
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by VARCHAR(255),
        updated_by VARCHAR(255)
      );
    `);

    console.log('✅ Markers table created successfully!\n');

    console.log('🔄 Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_markers_episode ON markers(episode_id);
      CREATE INDEX IF NOT EXISTS idx_markers_scene ON markers(scene_id);
      CREATE INDEX IF NOT EXISTS idx_markers_timecode ON markers(episode_id, timecode);
      CREATE INDEX IF NOT EXISTS idx_markers_type ON markers(marker_type);
      CREATE INDEX IF NOT EXISTS idx_markers_category ON markers(category);
    `);

    console.log('✅ Indexes created successfully!\n');

    console.log('🔄 Adding table comments...');

    await client.query(`
      COMMENT ON TABLE markers IS 'Episode-scoped timeline markers with optional scene references (Phase 2)';
      COMMENT ON COLUMN markers.timecode IS 'Absolute time in seconds from episode start';
      COMMENT ON COLUMN markers.scene_id IS 'Optional reference to scene containing this marker';
      COMMENT ON COLUMN markers.scene_relative_timecode IS 'Position within referenced scene (calculated)';
      COMMENT ON COLUMN markers.marker_type IS 'Type: note, chapter, cue, script, deliverable';
      COMMENT ON COLUMN markers.category IS 'User-defined category for grouping';
      COMMENT ON COLUMN markers.color IS 'Hex color code for visual display';
      COMMENT ON COLUMN markers.fulfillment_checkpoint IS 'For deliverable tracking';
    `);

    console.log('✅ Comments added!\n');

    // Verify the table
    console.log('📋 Verifying markers table schema...');
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_name = 'markers'
      ORDER BY ordinal_position;
    `);

    console.log('\n✅ Markers table columns:');
    result.rows.forEach((row) => {
      const nullable = row.is_nullable === 'YES' ? '' : ' NOT NULL';
      const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
      console.log(`  - ${row.column_name}: ${row.data_type}${nullable}${defaultVal}`);
    });

    console.log('\n🎉 Migration complete! Markers table is ready for Phase 2.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

if (require.main === module) {
  createMarkersTable()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = createMarkersTable;
