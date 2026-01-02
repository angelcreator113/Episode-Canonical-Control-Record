#!/usr/bin/env node
/**
 * Seed Thumbnails with Proper Data
 * Updates thumbnails with episode references and S3 keys
 */

require('dotenv').config();
const { sequelize, models } = require('./src/models');
const { Thumbnail, Episode } = models;

async function seedThumbnails() {
  try {
    console.log('🚀 Starting thumbnail seed...');

    // Get all episodes
    const episodes = await Episode.findAll({
      limit: 20,
      order: [['id', 'ASC']],
    });

    console.log(`📦 Found ${episodes.length} episodes`);

    if (episodes.length === 0) {
      console.warn('⚠️  No episodes found. Please seed episodes first.');
      process.exit(1);
    }

    // Get all thumbnails
    let thumbnails = await Thumbnail.findAll({
      limit: 100,
    });

    console.log(`📸 Found ${thumbnails.length} existing thumbnails`);

    if (thumbnails.length === 0) {
      console.warn('⚠️  No thumbnails found. Please create thumbnails first.');
      process.exit(1);
    }

    // Assign episodes to thumbnails and generate S3 keys
    let updated = 0;
    for (let i = 0; i < thumbnails.length; i++) {
      const thumbnail = thumbnails[i];
      const episode = episodes[i % episodes.length]; // Round-robin assign episodes

      // Generate realistic S3 key
      const s3Key = `episodes/${episode.id}/thumbnails/thumb-${thumbnail.id}.jpg`;

      // Update thumbnail
      const result = await thumbnail.update({
        episodeId: episode.id,
        s3Key: s3Key,
        fileSizeBytes: Math.floor(Math.random() * 500000) + 50000, // 50KB - 550KB
      });

      updated++;
      console.log(`✅ Updated thumbnail ${thumbnail.id}: episode ${episode.id}, key: ${s3Key}`);
    }

    console.log(`\n✨ Successfully updated ${updated} thumbnails!`);

    // Verify the updates
    const verifyThumbnails = await Thumbnail.findAll({
      limit: 5,
      include: {
        model: Episode,
        as: 'episode',
        attributes: ['id', 'title'],
      },
    });

    console.log('\n📋 Sample updated records:');
    verifyThumbnails.forEach(t => {
      console.log(`  - Thumbnail ${t.id}: ${t.s3Key}`);
      console.log(`    Episode: ${t.episode?.title || 'N/A'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding thumbnails:', error);
    process.exit(1);
  } finally {
    if (sequelize) await sequelize.close();
  }
}

seedThumbnails();
