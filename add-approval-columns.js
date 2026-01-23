/**
 * Add approval workflow columns to episode_wardrobe table
 * This migration adds columns for the approval workflow feature
 */

const { Pool } = require('pg');
require('dotenv').config();

async function addApprovalColumns() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  console.log('Adding approval workflow columns to episode_wardrobe table...\n');

  try {
    // Check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'episode_wardrobe' 
      AND column_name IN ('approval_status', 'approved_by', 'approved_at', 'rejection_reason');
    `;
    
    const existingColumns = await pool.query(checkQuery);
    const existingColumnNames = existingColumns.rows.map(row => row.column_name);
    
    console.log('Existing approval columns:', existingColumnNames.length > 0 ? existingColumnNames : 'none');
    
    // Add approval_status if not exists
    if (!existingColumnNames.includes('approval_status')) {
      console.log('Adding approval_status column...');
      await pool.query(`
        ALTER TABLE episode_wardrobe 
        ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pending';
      `);
      console.log('✓ Added approval_status column');
    } else {
      console.log('⊘ approval_status column already exists');
    }
    
    // Add approved_by if not exists
    if (!existingColumnNames.includes('approved_by')) {
      console.log('Adding approved_by column...');
      await pool.query(`
        ALTER TABLE episode_wardrobe 
        ADD COLUMN approved_by VARCHAR(255);
      `);
      console.log('✓ Added approved_by column');
    } else {
      console.log('⊘ approved_by column already exists');
    }
    
    // Add approved_at if not exists
    if (!existingColumnNames.includes('approved_at')) {
      console.log('Adding approved_at column...');
      await pool.query(`
        ALTER TABLE episode_wardrobe 
        ADD COLUMN approved_at TIMESTAMP;
      `);
      console.log('✓ Added approved_at column');
    } else {
      console.log('⊘ approved_at column already exists');
    }
    
    // Add rejection_reason if not exists
    if (!existingColumnNames.includes('rejection_reason')) {
      console.log('Adding rejection_reason column...');
      await pool.query(`
        ALTER TABLE episode_wardrobe 
        ADD COLUMN rejection_reason TEXT;
      `);
      console.log('✓ Added rejection_reason column');
    } else {
      console.log('⊘ rejection_reason column already exists');
    }
    
    // Create index on approval_status if not exists
    console.log('\nCreating index on approval_status...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_approval 
      ON episode_wardrobe(approval_status);
    `);
    console.log('✓ Created index idx_episode_wardrobe_approval');
    
    console.log('\n✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  addApprovalColumns()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = addApprovalColumns;
