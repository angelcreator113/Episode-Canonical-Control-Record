/**
 * Seed Script - Create sample data for testing
 * Run with: node scripts/seed-test-data.js
 */

require('dotenv').config();
const db = require('../src/models');
const { Episode, Thumbnail, MetadataStorage, ProcessingQueue } = db.models;

async function seedData() {
  try {
    console.log('🌱 Starting database seeding...\n');
    
    await db.sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Clear existing data (optional, uncomment if needed)
    // await Episode.destroy({ where: {} });

    // Create sample episodes
    console.log('Creating sample episodes...');
    const episodes = await Episode.bulkCreate([
      {
        showName: 'Styling Adventures with Lala',
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Pilot Episode - Introduction to Styling',
        description: 'The first episode introduces basic styling techniques and color theory.',
        uploadDate: new Date('2025-01-15'),
        processingStatus: 'complete',
        videoPath: 's3://episode-metadata-storage-dev/episodes/s1e1-intro.mp4',
        thumbnailUrl: 's3://episode-metadata-thumbnails-dev/s1e1-thumb.jpg',
      },
      {
        showName: 'Styling Adventures with Lala',
        seasonNumber: 1,
        episodeNumber: 2,
        episodeTitle: 'Fabric Selection and Care',
        description: 'Learn how to select and care for different fabric types.',
        uploadDate: new Date('2025-01-22'),
        processingStatus: 'complete',
        videoPath: 's3://episode-metadata-storage-dev/episodes/s1e2-fabric.mp4',
        thumbnailUrl: 's3://episode-metadata-thumbnails-dev/s1e2-thumb.jpg',
      },
      {
        showName: 'Styling Adventures with Lala',
        seasonNumber: 1,
        episodeNumber: 3,
        episodeTitle: 'Pattern Matching Basics',
        description: 'Master the art of matching patterns and textures.',
        uploadDate: new Date('2025-01-29'),
        processingStatus: 'processing',
        videoPath: 's3://episode-metadata-storage-dev/episodes/s1e3-patterns.mp4',
        thumbnailUrl: 's3://episode-metadata-thumbnails-dev/s1e3-thumb.jpg',
      },
      {
        showName: 'Styling Adventures with Lala',
        seasonNumber: 2,
        episodeNumber: 1,
        episodeTitle: 'Advanced Layering Techniques',
        description: 'Explore advanced methods for layering and combining styles.',
        uploadDate: new Date('2025-02-05'),
        processingStatus: 'pending',
        videoPath: 's3://episode-metadata-storage-dev/episodes/s2e1-layers.mp4',
        thumbnailUrl: 's3://episode-metadata-thumbnails-dev/s2e1-thumb.jpg',
      },
    ]);

    console.log(`✅ Created ${episodes.length} episodes\n`);

    // Create sample thumbnails
    console.log('Creating sample thumbnails...');
    const thumbnails = await Thumbnail.bulkCreate(
      episodes.slice(0, 2).map((ep, idx) => [
        {
          episode_id: ep.id,
          s3_bucket: 'episode-metadata-thumbnails-dev',
          s3_key: `episodes/${ep.id}/thumbnail-primary.jpg`,
          file_size_bytes: 125000 + idx * 10000,
          mime_type: 'image/jpeg',
          width_pixels: 1920,
          height_pixels: 1080,
          format: 'jpeg',
          thumbnail_type: 'primary',
          quality_rating: 4.8,
        },
        {
          episode_id: ep.id,
          s3_bucket: 'episode-metadata-thumbnails-dev',
          s3_key: `episodes/${ep.id}/thumbnail-frame-30s.jpg`,
          file_size_bytes: 95000 + idx * 8000,
          mime_type: 'image/jpeg',
          width_pixels: 1920,
          height_pixels: 1080,
          format: 'jpeg',
          thumbnail_type: 'frame',
          position_seconds: 30,
          quality_rating: 4.5,
        },
      ]).flat()
    );

    console.log(`✅ Created ${thumbnails.length} thumbnails\n`);

    // Create sample metadata
    console.log('Creating sample metadata...');
    try {
      const metadata = await MetadataStorage.bulkCreate(
        episodes.slice(0, 2).map((ep) => ({
          episodeId: ep.id,
          extractedText: 'Sample text extracted from episode for testing',
          scenesDetected: [
            { timestamp: 0, description: 'Opening scene' },
            { timestamp: 600, description: 'Main content segment' },
          ],
          sentimentAnalysis: { overall: 'positive', scenes: [] },
          visualObjects: ['Fabric', 'Models', 'Studio Setup'],
          transcription: 'Sample transcription of the episode audio',
          tags: ['styling', 'fashion', 'tutorial'],
          categories: ['Fashion', 'How-To'],
          processingDurationSeconds: 120,
        }))
      );
      console.log(`✅ Created ${metadata.length} metadata entries\n`);
    } catch (metadataError) {
      console.log(`⚠️  Skipping metadata (table schema mismatch): ${metadataError.message}\n`);
    }

    // Create sample processing queue entries
    console.log('Creating sample processing queue entries...');
    let processingQueue = [];
    try {
      processingQueue = await ProcessingQueue.bulkCreate([
        {
          episodeId: episodes[2].id,
          jobType: 'thumbnail_generation',
          status: 'pending',
          jobConfig: {
            frame_intervals: [0, 15, 30, 45],
            thumbnail_sizes: ['1920x1080', '800x600', '400x300'],
          },
        },
        {
          episodeId: episodes[3].id,
          jobType: 'metadata_extraction',
          status: 'pending',
          jobConfig: {
            extract_text: true,
            detect_scenes: true,
            analyze_sentiment: true,
          },
        },
      ]);
      console.log(`✅ Created ${processingQueue.length} processing queue entries\n`);
    } catch (queueError) {
      console.log(`⚠️  Skipping processing queue (table schema mismatch): ${queueError.message}\n`);
      processingQueue = [];
    }

    console.log('='.repeat(50));
    console.log('✅ SEEDING COMPLETE!');
    console.log('='.repeat(50));
    console.log(`\nSummary:`);
    console.log(`  📺 Episodes: ${episodes.length}`);
    console.log(`  🖼️  Thumbnails: ${thumbnails.length}`);
    console.log(`  📋 Metadata: Skipped (schema mismatch)`);
    console.log(`  ⏳ Processing Queue: Skipped (schema mismatch)`);
    console.log(`\nYou can now test the API with:`);
    console.log(`  GET http://localhost:3001/api/v1/episodes`);
    console.log(`  GET http://localhost:3001/api/v1/thumbnails`);
    console.log(`  GET http://localhost:3001/api/v1/metadata`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedData();
