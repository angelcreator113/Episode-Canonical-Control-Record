const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const sharp = require('sharp');

async function testAssetUpload() {
  try {
    console.log('🧪 Testing asset upload...\n');

    // Create a test image (100x100 red square)
    const testImagePath = path.join(__dirname, 'test-image-upload.png');
    
    console.log('📸 Creating test image...');
    await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 255, g: 100, b: 100 },
      },
    })
      .png()
      .toFile(testImagePath);

    console.log('✓ Test image created:', testImagePath);

    // Read the image file
    const fileBuffer = fs.readFileSync(testImagePath);
    
    // Create FormData
    const form = new FormData();
    form.append('file', fileBuffer, 'test-image.png');
    form.append('assetType', 'PROMO_LALA');
    form.append('metadata', JSON.stringify({ description: 'Test asset upload' }));

    console.log('\n📤 Uploading asset...');
    const response = await fetch('http://localhost:3002/api/v1/assets', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Upload successful!');
      console.log('Asset ID:', data.data.id);
      console.log('Asset Name:', data.data.name);
      console.log('Asset Type:', data.data.type || data.data.asset_type);
      console.log('Thumbnail:', data.data.thumbnail ? 'Available' : 'Not available');
      console.log('\nFull response:', JSON.stringify(data.data, null, 2));
    } else {
      console.log('❌ Upload failed:', response.status);
      console.log('Error:', data);
    }

    // Cleanup
    fs.unlinkSync(testImagePath);
    console.log('\n✓ Test image cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAssetUpload();
