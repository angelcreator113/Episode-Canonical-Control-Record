/**
 * Re-process a scene library entry to generate thumbnails and extract metadata
 */
const { SceneLibrary } = require('./src/models');
const videoProcessingService = require('./src/services/VideoProcessingService');
const s3Service = require('./src/services/S3Service');
const logger = require('./src/utils/logger');

async function reprocessScene(sceneId) {
  try {
    console.log(`\n🔄 Re-processing scene: ${sceneId}\n`);

    // Fetch the scene
    const scene = await SceneLibrary.findByPk(sceneId);
    if (!scene) {
      console.error('❌ Scene not found');
      return;
    }

    console.log('📋 Scene details:');
    console.log(`   - Title: ${scene.title || '(no title)'}`);
    console.log(`   - Video URL: ${scene.videoAssetUrl}`);
    console.log(`   - Current Status: ${scene.processingStatus}`);
    console.log('');

    // Update status to processing
    await scene.update({ processingStatus: 'processing' });
    console.log('✅ Status updated to processing\n');

    // Extract S3 key from scene
    const bucket = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || 'episode-metadata-storage-dev';
    const s3Key = scene.s3_key || scene.videoAssetUrl;
    
    if (!s3Key) {
      throw new Error('S3 key is missing');
    }

    console.log(`📥 Downloading video from S3 (${s3Key})...`);
    // Download video from S3
    const videoBuffer = await s3Service.getFileAsBuffer(bucket, s3Key);
    console.log(`✅ Downloaded ${videoBuffer.length} bytes\n`);

    // Extract metadata
    console.log('🔍 Extracting metadata...');
    const metadata = await videoProcessingService.extractMetadata(videoBuffer);
    console.log('✅ Metadata extracted:');
    console.log(`   - Duration: ${metadata.duration}s`);
    console.log(`   - Size: ${metadata.size} bytes`);
    console.log(`   - Resolution: ${metadata.video?.width}x${metadata.video?.height}`);
    console.log(`   - Bitrate: ${metadata.bitRate} bps`);
    console.log('');

    // Generate thumbnail
    console.log('🖼️  Generating thumbnail...');
    const thumbnailBuffer = await videoProcessingService.generateThumbnail(videoBuffer, {
      timestamp: 1,
      width: 320,
    });
    console.log(`✅ Thumbnail generated: ${thumbnailBuffer.length} bytes\n`);

    // Upload thumbnail to S3
    const thumbnailKey = s3Key.replace('/clip.mp4', '/thumbnail.jpg');
    console.log('📤 Uploading thumbnail to S3...');
    await s3Service.uploadFile(bucket, thumbnailKey, thumbnailBuffer, { ContentType: 'image/jpeg' });
    console.log(`✅ Thumbnail uploaded: ${thumbnailKey}\n`);

    // Update scene with metadata
    console.log('💾 Updating scene in database...');
    await scene.update({
      durationSeconds: metadata.duration,
      fileSizeBytes: metadata.size,
      resolutionWidth: metadata.video?.width,
      resolutionHeight: metadata.video?.height,
      thumbnailUrl: thumbnailKey,
      processingStatus: 'ready',
    });

    console.log('✅ Scene updated successfully!\n');
    console.log('📊 Final scene details:');
    console.log(`   - Duration: ${scene.durationSeconds}s`);
    console.log(`   - File Size: ${scene.fileSizeBytes} bytes`);
    console.log(`   - Resolution: ${scene.resolutionWidth}x${scene.resolutionHeight}`);
    console.log(`   - Thumbnail: ${scene.thumbnailUrl}`);
    console.log(`   - Status: ${scene.processingStatus}`);
    console.log('\n✨ Processing complete!\n');

  } catch (error) {
    console.error('\n❌ Error re-processing scene:', error.message);
    logger.error('Scene reprocessing failed', { error: error.message, stack: error.stack });
    
    // Update status to failed
    try {
      const scene = await SceneLibrary.findByPk(sceneId);
      if (scene) {
        await scene.update({ processingStatus: 'failed' });
      }
    } catch (updateError) {
      console.error('Failed to update status to failed:', updateError.message);
    }
    
    process.exit(1);
  }
}

// Get scene ID from command line
const sceneId = process.argv[2] || 'ef8d74c3-0212-4d56-9464-e04c59a68860';

console.log('🎬 Scene Library Re-processor\n');
console.log('================================\n');

reprocessScene(sceneId)
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
