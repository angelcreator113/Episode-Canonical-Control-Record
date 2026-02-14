const db = require('./src/models');

async function runWardrobeLibraryMigration() {
  const queryInterface = db.sequelize.getQueryInterface();
  
  try {
    console.log('🚀 Starting wardrobe library migration...\n');
    
    // Check if tables exist
    const tables = await queryInterface.showAllTables();
    console.log('📋 Existing tables:', tables);
    
    if (!tables.includes('wardrobe_library')) {
      console.log('\n✨ Creating wardrobe_library table...');
      await db.sequelize.query(`
        CREATE TABLE wardrobe_library (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type VARCHAR(50) NOT NULL,
          item_type VARCHAR(100),
          image_url TEXT NOT NULL,
          thumbnail_url TEXT,
          s3_key VARCHAR(500),
          default_character VARCHAR(255),
          default_occasion VARCHAR(255),
          default_season VARCHAR(100),
          color VARCHAR(100),
          tags JSONB DEFAULT '[]'::jsonb,
          website TEXT,
          price DECIMAL(10,2),
          vendor VARCHAR(255),
          show_id UUID REFERENCES shows(id) ON DELETE SET NULL,
          total_usage_count INTEGER DEFAULT 0,
          last_used_at TIMESTAMP,
          view_count INTEGER DEFAULT 0,
          selection_count INTEGER DEFAULT 0,
          created_by VARCHAR(255),
          updated_by VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP
        );
        
        CREATE INDEX idx_wardrobe_library_type ON wardrobe_library(type);
        CREATE INDEX idx_wardrobe_library_item_type ON wardrobe_library(item_type);
        CREATE INDEX idx_wardrobe_library_show_id ON wardrobe_library(show_id);
        CREATE INDEX idx_wardrobe_library_deleted_at ON wardrobe_library(deleted_at);
        CREATE INDEX idx_wardrobe_library_color ON wardrobe_library(color);
        CREATE INDEX idx_wardrobe_library_tags ON wardrobe_library USING GIN(tags);
        CREATE INDEX idx_wardrobe_library_search ON wardrobe_library 
          USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
      `);
      console.log('✅ wardrobe_library table created');
    } else {
      console.log('⏭️  wardrobe_library table already exists');
    }
    
    if (!tables.includes('outfit_set_items')) {
      console.log('\n✨ Creating outfit_set_items table...');
      await db.sequelize.query(`
        CREATE TABLE outfit_set_items (
          id SERIAL PRIMARY KEY,
          outfit_set_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
          wardrobe_item_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
          position INTEGER DEFAULT 0,
          layer VARCHAR(50),
          is_optional BOOLEAN DEFAULT false,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(outfit_set_id, wardrobe_item_id)
        );
        
        CREATE INDEX idx_outfit_set_items_set ON outfit_set_items(outfit_set_id);
        CREATE INDEX idx_outfit_set_items_item ON outfit_set_items(wardrobe_item_id);
      `);
      console.log('✅ outfit_set_items table created');
    } else {
      console.log('⏭️  outfit_set_items table already exists');
    }
    
    if (!tables.includes('wardrobe_usage_history')) {
      console.log('\n✨ Creating wardrobe_usage_history table...');
      await db.sequelize.query(`
        CREATE TABLE wardrobe_usage_history (
          id SERIAL PRIMARY KEY,
          library_item_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
          episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL,
          scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
          show_id UUID REFERENCES shows(id) ON DELETE SET NULL,
          usage_type VARCHAR(50) NOT NULL,
          character VARCHAR(255),
          occasion VARCHAR(255),
          user_id VARCHAR(255),
          notes TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_usage_history_library_item ON wardrobe_usage_history(library_item_id);
        CREATE INDEX idx_usage_history_episode ON wardrobe_usage_history(episode_id);
        CREATE INDEX idx_usage_history_show ON wardrobe_usage_history(show_id);
        CREATE INDEX idx_usage_history_type ON wardrobe_usage_history(usage_type);
        CREATE INDEX idx_usage_history_created_at ON wardrobe_usage_history(created_at);
      `);
      console.log('✅ wardrobe_usage_history table created');
    } else {
      console.log('⏭️  wardrobe_usage_history table already exists');
    }
    
    if (!tables.includes('wardrobe_library_references')) {
      console.log('\n✨ Creating wardrobe_library_references table...');
      await db.sequelize.query(`
        CREATE TABLE wardrobe_library_references (
          id SERIAL PRIMARY KEY,
          library_item_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
          s3_key VARCHAR(500) NOT NULL,
          reference_count INTEGER DEFAULT 1,
          file_size BIGINT,
          content_type VARCHAR(100),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(library_item_id, s3_key)
        );
        
        CREATE INDEX idx_library_references_s3_key ON wardrobe_library_references(s3_key);
      `);
      console.log('✅ wardrobe_library_references table created');
    } else {
      console.log('⏭️  wardrobe_library_references table already exists');
    }
    
    // Check if library_item_id column exists in wardrobe table
    const wardrobeColumns = await queryInterface.describeTable('wardrobe');
    if (!wardrobeColumns.library_item_id) {
      console.log('\n✨ Adding library_item_id column to wardrobe table...');
      await db.sequelize.query(`
        ALTER TABLE wardrobe 
        ADD COLUMN library_item_id INTEGER REFERENCES wardrobe_library(id) ON DELETE SET NULL;
        
        CREATE INDEX idx_wardrobe_library_item_id ON wardrobe(library_item_id);
      `);
      console.log('✅ library_item_id column added to wardrobe table');
    } else {
      console.log('⏭️  library_item_id column already exists in wardrobe table');
    }
    
    console.log('\n✅ Wardrobe library system created successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    process.exit();
  }
}

runWardrobeLibraryMigration();
