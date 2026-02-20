const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

async function getModels() {
  try { return require('../models'); } catch { return null; }
}

// ═══════════════════════════════════════════
// POST /query  — Run a read-only SQL query (dev only)
// ═══════════════════════════════════════════
router.post('/query', async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });
    const { sequelize } = models;
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql field required' });

    const rows = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
    res.json({ success: true, count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test route to create video_compositions table
router.get('/create-video-compositions-table', async (req, res) => {
  const pool = getPool();
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_compositions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'complete', 'error')),
        scenes JSONB DEFAULT '[]'::jsonb,
        assets JSONB DEFAULT '[]'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_compositions_episode_id ON video_compositions(episode_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_compositions_status ON video_compositions(status);
    `);
    
    res.json({
      success: true,
      message: 'video_compositions table created successfully'
    });
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
