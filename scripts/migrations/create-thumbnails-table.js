const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, { logging: console.log });

async function createThumbnailsTable() {
  try {
    console.log('Creating thumbnails table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS thumbnails (
        id SERIAL PRIMARY KEY,
        "episodeId" UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE ON UPDATE CASCADE,
        "s3Bucket" VARCHAR(255) NOT NULL,
        "s3Key" VARCHAR(512) NOT NULL UNIQUE,
        "fileSizeBytes" BIGINT,
        "mimeType" VARCHAR(50) DEFAULT 'image/jpeg',
        "widthPixels" INTEGER,
        "heightPixels" INTEGER,
        format VARCHAR(50) DEFAULT 'thumbnail',
        "thumbnailType" VARCHAR(50),
        "positionSeconds" DECIMAL(10, 2),
        "generatedAt" TIMESTAMP WITH TIME ZONE,
        "qualityRating" INTEGER CHECK ("qualityRating" >= 1 AND "qualityRating" <= 5),
        "publishStatus" VARCHAR(50) DEFAULT 'draft',
        "isPrimary" BOOLEAN DEFAULT false,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "publishedBy" VARCHAR(255),
        "unpublishedAt" TIMESTAMP WITH TIME ZONE,
        "platformUploadStatus" JSONB,
        "platformUrls" JSONB,
        episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
        url TEXT,
        metadata JSONB,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('✅ Thumbnails table created successfully');
    
    // Verify it exists
    const [result] = await sequelize.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'thumbnails')"
    );
    
    console.log('Verification:', result[0].exists ? '✅ Table exists' : '❌ Table not found');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

createThumbnailsTable();
