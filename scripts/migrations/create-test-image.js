const sharp = require('sharp');

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
  <text x="250" y="535" font-size="16" text-anchor="middle" fill="white" opacity="0.8" font-family="Arial">InPerprime</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile('./test-images/test-justawomaninperprime.png')
  .then(() => {
    console.log('✅ Created test-justawomaninperprime.png in test-images folder');
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
