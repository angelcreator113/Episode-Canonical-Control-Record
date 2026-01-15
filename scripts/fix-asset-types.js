const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing asset type typos...\n');

const files = [
  'src/routes/assets.js',
  'src/services/AssetService.js',
  'frontend/src/pages/AssetManager.jsx',
  'frontend/src/pages/ThumbnailComposer.jsx',
];

let fixedCount = 0;

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  
  // Fix the typo
  content = content.replace(/PROMO_JUSTAWOMANINPERPRIME/g, 'PROMO_JUSTAWOMANINHERPRIME');
  content = content.replace(/TANOMANINHERPRIME/g, 'JUSTAWOMANINHERPRIME');
  content = content.replace(/JUSTAWOMANINPERPRIME/g, 'JUSTAWOMANINHERPRIME');
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${filePath}`);
    fixedCount++;
  } else {
    console.log(`✓ ${filePath} (already correct)`);
  }
});

console.log(`\n🎉 Fixed ${fixedCount} file(s)`);
console.log('\nRestart your server:');
console.log('  npm run dev');