#!/usr/bin/env node
/**
 * Test script to simulate asset upload with show_id and entity_type
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testUpload() {
  try {
    console.log('🧪 Testing asset upload with show_id and entity_type...\n');

    // Read test image
    const imagePath = path.join(__dirname, 'test-images', 'test-lala.png');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Show ID to use
    const showId = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b';
    
    // Create FormData just like the frontend does
    const form = new FormData();
    form.append('file', imageBuffer, {
      filename: 'test-background.png',
      contentType: 'image/png'
    });
    form.append('assetType', 'BACKGROUND_IMAGE');
    form.append('show_id', showId);
    form.append('entity_type', 'environment');
    form.append('category', 'background');
    form.append('metadata', JSON.stringify({
      show_id: showId,
      showId: showId,
      asset_scope: 'SHOW',
      purpose: 'backgrounds',
      uploadedFrom: 'TestScript'
    }));

    console.log('📦 FormData prepared:');
    console.log('  - file: test-background.png');
    console.log('  - assetType: BACKGROUND_IMAGE');
    console.log('  - show_id:', showId);  
    console.log('  - entity_type: environment');
    console.log('  - category: background');
    console.log('');

    // Send request
    console.log('📤 Sending upload request to http://localhost:3002/api/v1/assets...\n');
    
    const response = await axios.post('http://localhost:3002/api/v1/assets', form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    console.log('✅ Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Verify the asset was created with correct fields
    if (response.data.data) {
      console.log('\n🔍 Created Asset Details:');
      console.log('  - id:', response.data.data.id);
      console.log('  - show_id:', response.data.data.show_id);
      console.log('  - entity_type:', response.data.data.entity_type);
      console.log('  - category:', response.data.data.category);
      
      if (!response.data.data.show_id) {
        console.log('\n⚠️  WARNING: show_id is not set! This is the problem.');
      }
      if (!response.data.data.entity_type) {
        console.log('\n⚠️  WARNING: entity_type is not set! This is the problem.');
      }
    }

  } catch (error) {
    console.error('❌ Upload failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testUpload();
