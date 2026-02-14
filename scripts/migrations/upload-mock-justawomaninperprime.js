#!/usr/bin/env node
/**
 * Upload mock image for PROMO_JUSTAWOMANINPERPRIME asset type
 * Creates a simple PNG image and uploads it via the API
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function uploadMockImage() {
  try {
    console.log('📤 Creating mock PROMO_JUSTAWOMANINPERPRIME image...');

    // Create a PNG image using Sharp
    const svgImage = `
      <svg width="500" height="600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FF6B9D;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#C44569;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="500" height="600" fill="url(#grad1)"/>
        <circle cx="250" cy="150" r="80" fill="white" opacity="0.9"/>
        <text x="250" y="500" font-size="32" font-weight="bold" text-anchor="middle" fill="white" font-family="Arial">JustAWoman</text>
        <text x="250" y="535" font-size="16" text-anchor="middle" fill="white" opacity="0.8" font-family="Arial">InPerprime</text>
      </svg>
    `;

    const tempPath = path.join(__dirname, 'temp-mock-image.png');
    
    // Convert SVG to PNG using Sharp
    await sharp(Buffer.from(svgImage))
      .png()
      .toFile(tempPath);

    const fileBuffer = fs.readFileSync(tempPath);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="mock-justawomaninperprime.png"\r\nContent-Type: image/png\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="assetType"\r\n\r\nPROMO_JUSTAWOMANINPERPRIME\r\n--${boundary}--\r\n`),
    ]);

    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/v1/assets/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          fs.unlinkSync(tempPath);
          
          if (res.statusCode === 201 || res.statusCode === 200) {
            console.log('✅ Mock image uploaded successfully!');
            try {
              const response = JSON.parse(data);
              console.log('Asset ID:', response.data?.id);
            } catch (e) {
              console.log('Response:', data);
            }
            resolve(true);
          } else {
            console.error('❌ Upload failed:', res.statusCode);
            console.error('Response:', data);
            reject(new Error(`Upload failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(err);
      });

      req.write(body);
      req.end();
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadMockImage()
  .then(() => {
    console.log('✨ Done! Refresh Asset Manager to see the new asset.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
