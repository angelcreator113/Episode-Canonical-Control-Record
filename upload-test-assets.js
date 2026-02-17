const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const API_BASE = 'http://localhost:3002/api/v1';
const SHOW_ID = 'b0e3dd75-8485-4677-99a2-3e16168bbc55'; // Your current show

async function createTestImage(filename, color, width = 1920, height = 1080) {
  // Create a solid color image
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  }).png().toBuffer();

  fs.writeFileSync(filename, buffer);
  return filename;
}

async function uploadAsset(name, filePath, metadata) {
  const form = new (require('form-data'))();
  form.append('file', fs.createReadStream(filePath));
  form.append('assetType', 'BACKGROUND_IMAGE');
  form.append('show_id', SHOW_ID);
  form.append('entity_type', 'environment');
  form.append('category', 'background');
  form.append('asset_scope', 'SHOW');
  
  // Add metadata
  form.append('location_name', metadata.location_name);
  form.append('location_version', metadata.location_version);
  form.append('mood_tags', JSON.stringify(metadata.mood_tags));
  form.append('color_palette', JSON.stringify(metadata.color_palette));

  try {
    const response = await axios.post(`${API_BASE}/assets`, form, {
      headers: form.getHeaders(),
    });
    console.log(`✅ Uploaded: ${name}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to upload ${name}:`, error.response?.data || error.message);
  }
}

async function main() {
  console.log('🎨 Creating test images and uploading to show:', SHOW_ID);

  // Create test images
  const bg1 = await createTestImage('/tmp/lux-bg.png', { r: 230, g: 180, b: 150 });
  const bg2 = await createTestImage('/tmp/modern-bg.png', { r: 50, g: 50, b: 100 });
  const bg3 = await createTestImage('/tmp/calm-bg.png', { r: 100, g: 180, b: 150 });

  // Upload with metadata
  await uploadAsset('Luxury Background', bg1, {
    location_name: 'Elegant Studio',
    location_version: 1,
    mood_tags: ['luxury', 'sophisticated', 'warm'],
    color_palette: ['#E6B496', '#D4A574', '#C29060'],
  });

  await uploadAsset('Modern Background', bg2, {
    location_name: 'Modern Office',
    location_version: 1,
    mood_tags: ['professional', 'modern', 'clean'],
    color_palette: ['#323264', '#4A4A6E', '#6A6A9E'],
  });

  await uploadAsset('Calm Background', bg3, {
    location_name: 'Peaceful Space',
    location_version: 1,
    mood_tags: ['calm', 'natural', 'serene'],
    color_palette: ['#64B496', '#7AC9B4', '#8FD4B8'],
  });

  // Verify
  console.log('\n📊 Verifying assets were uploaded...');
  try {
    const response = await axios.get(`${API_BASE}/assets`, {
      params: {
        show_id: SHOW_ID,
        entity_type: 'environment',
        category: 'background',
        limit: 20,
      },
    });
    console.log(`✨ Found ${response.data.data.length} background assets in your show!`);
    response.data.data.forEach((asset) => {
      console.log(`  • ${asset.location_name} (v${asset.location_version}): ${asset.mood_tags}`);
    });
  } catch (error) {
    console.error('Error verifying:', error.message);
  }

  // Cleanup
  fs.unlinkSync(bg1);
  fs.unlinkSync(bg2);
  fs.unlinkSync(bg3);

  console.log('\n✅ Done! Refresh your browser to see the assets in AssetSelector');
}

main().catch(console.error);
