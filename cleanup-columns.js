const { sequelize } = require('./src/models');

async function removeDeprecatedColumns() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');
    
    // Drop deprecated columns if they exist
    await sequelize.query(`
      ALTER TABLE episodes 
      DROP COLUMN IF EXISTS "showName",
      DROP COLUMN IF EXISTS "seasonNumber",
      DROP COLUMN IF EXISTS "episodeNumber",
      DROP COLUMN IF EXISTS "episodeTitle",
      DROP COLUMN IF EXISTS "plotSummary",
      DROP COLUMN IF EXISTS "director",
      DROP COLUMN IF EXISTS "writer",
      DROP COLUMN IF EXISTS "durationMinutes",
      DROP COLUMN IF EXISTS "rating",
      DROP COLUMN IF EXISTS "genre",
      DROP COLUMN IF EXISTS "thumbnailUrl",
      DROP COLUMN IF EXISTS "posterUrl",
      DROP COLUMN IF EXISTS "videoUrl",
      DROP COLUMN IF EXISTS "rawVideoS3Key",
      DROP COLUMN IF EXISTS "processedVideoS3Key",
      DROP COLUMN IF EXISTS "metadataJsonS3Key",
      DROP COLUMN IF EXISTS "processingStatus",
      DROP COLUMN IF EXISTS "uploadDate",
      DROP COLUMN IF EXISTS "lastModified"
    `);
    
    console.log('✅ Cleaned up deprecated columns');
  } catch (error) {
    console.log('Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

removeDeprecatedColumns();
