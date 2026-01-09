#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing asset type typos across all files...\n');

const filesToFix = [
  'src/routes/assets.js',
  'src/services/AssetService.js',
  'src/controllers/assetController.js',
  'frontend/src/pages/AssetManager.jsx',
  'frontend/src/pages/ThumbnailComposer.jsx',
];

const typoPatterns = [
  { from: /PROMO_JUSTAWOMANINPERPRIME/g, to: 'PROMO_JUSTAWOMANINHERPRIME' },
  { from: /TANOMANINHERPRIME/g, to: 'JUSTAWOMANINHERPRIME' },
  { from: /approv_TANOMANINHERPRIME/g, to: 'approved/PROMO_JUSTAWOMANINHERPRIME' },
];

let totalFixed = 0;
let filesFixed = 0;

filesToFix.forEach(relPath => {
  const fullPath = path.join(process.cwd(), relPath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${relPath} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  let fileFixCount = 0;
  
  // Apply all typo fixes
  typoPatterns.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      fileFixCount += matches.length;
      content = content.replace(from, to);
    }
  });
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${relPath} (${fileFixCount} replacements)`);
    filesFixed++;
    totalFixed += fileFixCount;
  } else {
    console.log(`✓  ${relPath} (already correct)`);
  }
});

console.log(`\n📊 Summary:`);
console.log(`  Files fixed: ${filesFixed}`);
console.log(`  Total replacements: ${totalFixed}`);

if (filesFixed > 0) {
  console.log(`\n🎉 All typos fixed!`);
  console.log(`\n⚡ Next steps:`);
  console.log(`  1. Restart your server: npm run dev`);
  console.log(`  2. Clear browser cache: Ctrl+Shift+R`);
  console.log(`  3. Test asset upload at /assets`);
} else {
  console.log(`\n✨ No typos found - everything looks good!`);
}