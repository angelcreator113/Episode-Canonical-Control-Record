/**
 * Test JustAWoman Asset Upload
 * Uploads a JustAWoman test image to the system
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function createAndUploadJustAWomanAsset() {
  try {
    console.log('🎨 Creating JustAWoman test image...');

    // Create SVG for JustAWoman
    const svg = `<svg width="500" height="600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FF6B9D;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#C44569;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="500" height="600" fill="url(#grad1)"/>
      <circle cx="250" cy="150" r="80" fill="white" opacity="0.9"/>
      <text x="250" y="500" font-size="32" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">JustAWoman</text>
      <text x="250" y="535" font-size="16" text-anchor="middle" fill="white" opacity="0.8" font-family="Arial">InHerPrime</text>
    </svg>`;

    // Convert SVG to PNG buffer
    const imageBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    console.log('✅ Image created, uploading...');

    // Create FormData
    const form = new FormData();
    form.append('file', imageBuffer, 'test-justawomaninherprime.png');
    form.append('assetType', 'PROMO_JUSTAWOMANINPERPRIME');
    form.append('metadata', JSON.stringify({
      outfit: 'JustAWoman In Her Prime',
      description: 'Test JustAWoman promotional image',
    }));

    // Upload to backend
    const response = await fetch('http://localhost:3002/api/v1/assets/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('\n✅ JustAWoman asset uploaded successfully!');
    console.log('Asset ID:', data.data?.id);
    console.log('Type:', data.data?.asset_type);
    console.log('Status:', data.data?.approval_status);
    console.log('\n🎉 Ready to use in compositions!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAndUploadJustAWomanAsset();
