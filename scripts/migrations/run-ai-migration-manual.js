const { Pool } = require('pg');
require('dotenv').config();
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting AI Editing Tables Migration...\n');
    
    // Import the migration file
    const migration = require('./src/migrations/20260205000001-add-ai-editing-tables.js');
    
    console.log('Migration object loaded:', Object.keys(migration));
    
    // Create a simple pgm mock object with the essential methods
    const pgm = {
      createTable: async (tableName, columns) => {
        console.log(`   Creating table: ${tableName}`);
        // Build CREATE TABLE SQL
        let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        const cols = [];
        for (const [colName, colDef] of Object.entries(columns)) {
          let colSql = `  ${colName} ${colDef.type}`;
          if (colDef.primaryKey) colSql += ' PRIMARY KEY';
          if (colDef.notNull) colSql += ' NOT NULL';
          if (colDef.unique) colSql += ' UNIQUE';
          if (colDef.default !== undefined) {
            if (typeof colDef.default === 'object' && colDef.default._func) {
              colSql += ` DEFAULT ${colDef.default._func}`;
            } else if (typeof colDef.default === 'string') {
              colSql += ` DEFAULT '${colDef.default}'`;
            } else {
              colSql += ` DEFAULT ${colDef.default}`;
            }
          }
          if (colDef.references) {
            colSql += ` REFERENCES ${colDef.references}(id)`;
            if (colDef.onDelete) colSql += ` ON DELETE ${colDef.onDelete}`;
          }
          cols.push(colSql);
        }
        sql += cols.join(',\n') + '\n);';
        await client.query(sql);
      },
      
      createIndex: async (tableName, columns, options = {}) => {
        const indexName = `idx_${tableName}_${Array.isArray(columns) ? columns.join('_') : columns}`;
        const columnStr = Array.isArray(columns) ? columns.join(', ') : columns;
        console.log(`   Creating index: ${indexName}`);
        const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnStr});`;
        await client.query(sql);
      },
      
      sql: async (sqlString) => {
        console.log(`   Executing custom SQL...`);
        await client.query(sqlString);
      },
      
      addColumns: async (tableName, columns) => {
        console.log(`   Adding columns to table: ${tableName}`);
        for (const [colName, colDef] of Object.entries(columns)) {
          try {
            let sql = `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} ${colDef.type}`;
            if (colDef.notNull && colDef.default !== undefined) {
              if (typeof colDef.default === 'object' && colDef.default._func) {
                sql += ` DEFAULT ${colDef.default._func}`;
              } else if (typeof colDef.default === 'string') {
                sql += ` DEFAULT '${colDef.default}'`;
              } else if (typeof colDef.default === 'boolean') {
                sql += ` DEFAULT ${colDef.default}`;
              } else {
                sql += ` DEFAULT ${colDef.default}`;
              }
              sql += ' NOT NULL';
            } else if (colDef.notNull) {
              sql += ' NOT NULL';
            }
            if (colDef.references) {
              sql += ` REFERENCES ${colDef.references}(id)`;
              if (colDef.onDelete) sql += ` ON DELETE ${colDef.onDelete}`;
            }
            await client.query(sql);
            console.log(`     Added column: ${colName}`);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              throw err;
            }
            console.log(`     Column ${colName} already exists, skipping...`);
          }
        }
        // Add a small delay to ensure columns are committed before indexes are created
        await new Promise(resolve => setTimeout(resolve, 100));
      },
      
      func: (funcName) => {
        return { _func: funcName };
      }
    };
    
    // Run the migration
    await migration.up(pgm);
    
    // Record the migration
    await client.query(`
      INSERT INTO pgmigrations (name, run_on)
      VALUES ('20260205000001-add-ai-editing-tables', NOW())
      ON CONFLICT (name) DO NOTHING
    `);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('   All AI editing tables have been created.\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
