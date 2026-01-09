/**
 * Seed Routes (Development Only)
 * POST /api/v1/seed/episodes - Create test episodes
 */
/* eslint-disable no-console */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { models } = require('../models');

const router = express.Router();

// Test episodes
const testEpisodes = [
  {
    id: uuidv4(),
    episode_number: 1,
    title: 'The New Beginning',
    description: 'Lala starts her new role and discovers unexpected challenges.',
    air_date: new Date('2025-01-15'),
    status: 'draft',
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'The New Beginning',
    director: 'Maria Santos',
    writer: 'Jessica Chen',
    durationMinutes: 45,
    rating: 8.5,
    genre: 'Drama,Comedy',
  },
  {
    id: uuidv4(),
    episode_number: 2,
    title: 'Finding Her Voice',
    description: 'Lala learns to stand up for herself in the workplace.',
    air_date: new Date('2025-01-22'),
    status: 'published',
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: 'Finding Her Voice',
    director: 'Maria Santos',
    writer: 'Jessica Chen',
    durationMinutes: 44,
    rating: 8.7,
    genre: 'Drama,Comedy',
  },
  {
    id: uuidv4(),
    episode_number: 3,
    title: 'Unexpected Allies',
    description: 'A guest star joins the cast and creates surprising moments.',
    air_date: new Date('2025-01-29'),
    status: 'published',
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 3,
    episodeTitle: 'Unexpected Allies',
    director: 'James Mitchell',
    writer: 'Alexandra Brown',
    durationMinutes: 46,
    rating: 8.6,
    genre: 'Drama,Comedy',
  },
  {
    id: uuidv4(),
    episode_number: 4,
    title: 'The Guest Episode',
    description: 'A special guest appearance brings new dynamics to the show.',
    air_date: new Date('2025-02-05'),
    status: 'draft',
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 4,
    episodeTitle: 'The Guest Episode',
    director: 'Maria Santos',
    writer: 'Jessica Chen',
    durationMinutes: 45,
    rating: 8.4,
    genre: 'Drama,Comedy',
  },
  {
    id: uuidv4(),
    episode_number: 5,
    title: 'Rising to the Challenge',
    description: 'Lala faces her biggest professional challenge yet.',
    air_date: new Date('2025-02-12'),
    status: 'published',
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 5,
    episodeTitle: 'Rising to the Challenge',
    director: 'James Mitchell',
    writer: 'Alexandra Brown',
    durationMinutes: 47,
    rating: 8.8,
    genre: 'Drama,Comedy',
  },
];

/**
 * POST /api/v1/seed/episodes
 * Create test episodes
 * WARNING: This is for development only!
 */
router.post('/episodes', async (req, res) => {
  try {
    // Check if episodes already exist
    const existingCount = await models.Episode.count();
    if (existingCount > 0) {
      return res.json({
        status: 'SKIPPED',
        message: `Database already has ${existingCount} episodes`,
        count: existingCount,
      });
    }

    // Create episodes
    const created = await models.Episode.bulkCreate(testEpisodes);

    console.log(`✅ Seeded ${created.length} episodes`);

    res.json({
      status: 'SUCCESS',
      message: `Created ${created.length} test episodes`,
      count: created.length,
      episodes: created.map(ep => ({
        id: ep.id,
        episode_number: ep.episodeNumber,
        title: ep.episodeTitle,
      })),
    });
  } catch (error) {
    console.error('❌ Error seeding episodes:', error);
    res.status(500).json({
      error: 'Failed to seed episodes',
      message: error.message,
    });
  }
});

module.exports = router;
