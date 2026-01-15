/**
 * Generate thumbnails for all existing compositions
 * Triggers the thumbnail generation endpoint for each composition
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3002/api/v1';

async function generateThumbnailsForAllCompositions() {
  try {
    console.log('🎬 Starting thumbnail generation for all compositions...\n');

    // Get all compositions for episode 2
    const compositionsResponse = await axios.get(`${API_BASE_URL}/compositions/episode/2`);
    const compositions = compositionsResponse.data.data || [];

    console.log(`📊 Found ${compositions.length} compositions\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const composition of compositions) {
      try {
        const formats = composition.selected_formats || [];
        console.log(`🎬 Generating thumbnails for composition: ${composition.id}`);
        console.log(`   Episode: ${composition.episodeName}`);
        console.log(`   Formats: ${formats.join(', ')}\n`);

        // Trigger thumbnail generation
        const response = await axios.post(
          `${API_BASE_URL}/compositions/${composition.id}/generate-thumbnails`,
          { selected_formats: formats }
        );

        if (response.data.success) {
          console.log(`✅ Thumbnails generated successfully:`);
          console.log(`   - Status: ${response.data.status}`);
          console.log(`   - Count: ${response.data.thumbnails_generated}`);
          console.log(`   - Uploaded: ${response.data.uploaded_thumbnails?.length || 0} to S3\n`);
          successCount++;
        } else {
          console.log(`⚠️ Generation completed but with issues: ${response.data.message}\n`);
          successCount++;
        }
      } catch (error) {
        failureCount++;
        const errorMsg = error.response?.data?.message || error.message;
        console.error(`❌ Failed to generate thumbnails for ${composition.id}:`);
        console.error(`   Error: ${errorMsg}\n`);
      }

      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📋 Total: ${compositions.length}\n`);

    if (failureCount === 0) {
      console.log('🎉 All thumbnails generated successfully!');
      process.exit(0);
    } else {
      console.log('⚠️ Some generations failed. Check the errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

generateThumbnailsForAllCompositions();
