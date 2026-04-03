#!/usr/bin/env node
'use strict';

/**
 * Install invitation fonts
 *
 * Run once on EC2:
 *   node scripts/install-invitation-fonts.js
 *
 * Downloads Cormorant Garamond + Libre Baskerville from Google Fonts GitHub.
 * Saves to src/assets/fonts/invitation/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, '../src/assets/fonts/invitation');

const FONTS = [
  {
    name: 'CormorantGaramond-Regular.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Regular.ttf',
  },
  {
    name: 'CormorantGaramond-Bold.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Bold.ttf',
  },
  {
    name: 'CormorantGaramond-Italic.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Italic.ttf',
  },
  {
    name: 'LibreBaskerville-Regular.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Regular.ttf',
  },
  {
    name: 'LibreBaskerville-Italic.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Italic.ttf',
  },
  {
    name: 'LibreBaskerville-Bold.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/librebaskerville/LibreBaskerville-Bold.ttf',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    get(url);
  });
}

async function main() {
  console.log(`Installing invitation fonts to: ${FONT_DIR}\n`);

  if (!fs.existsSync(FONT_DIR)) {
    fs.mkdirSync(FONT_DIR, { recursive: true });
    console.log('Created font directory');
  }

  for (const font of FONTS) {
    const dest = path.join(FONT_DIR, font.name);
    if (fs.existsSync(dest)) {
      const size = fs.statSync(dest).size;
      if (size > 10000) {
        console.log(`  ✓ Already installed: ${font.name} (${Math.round(size / 1024)}KB)`);
        continue;
      }
    }
    process.stdout.write(`  Downloading: ${font.name}...`);
    try {
      await download(font.url, dest);
      const size = fs.statSync(dest).size;
      console.log(` ✓ (${Math.round(size / 1024)}KB)`);
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n✅ All invitation fonts installed.');
  console.log('The invitation generator will use these automatically.');
}

main().catch(err => { console.error(err); process.exit(1); });
