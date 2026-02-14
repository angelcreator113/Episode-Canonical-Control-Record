/**
 * Add Thumbnail Templates Route to Backend
 * Fixes 404 error for /api/v1/thumbnail-templates endpoint
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 Adding thumbnail templates route to backend...\n');

// Step 1: Copy route file
const sourceRoute = path.join(__dirname, 'src', 'routes', 'thumbnailTemplates.js');
const destRoute = path.join(__dirname, 'deploy-package', 'backend', 'routes', 'thumbnailTemplates.js');

if (!fs.existsSync(sourceRoute)) {
  console.error('❌ Source route file not found:', sourceRoute);
  process.exit(1);
}

console.log('📂 Copying route file...');
console.log('   From:', sourceRoute);
console.log('   To:', destRoute);

fs.copyFileSync(sourceRoute, destRoute);
console.log('✅ Route file copied\n');

// Step 2: Update app.js to load the route
const appJsPath = path.join(__dirname, 'deploy-package', 'backend', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

console.log('📝 Updating app.js...\n');

// Check if already added
if (appJsContent.includes('thumbnailTemplateRoutes')) {
  console.log('⚠️  Thumbnail template routes already added to app.js');
} else {
  // Add route loading code after templateRoutes
  const loadingCode = `
// Thumbnail template routes (separate from episode templates)
let thumbnailTemplateRoutes;
try {
  thumbnailTemplateRoutes = require('./routes/thumbnailTemplates');
  console.log('✓ Thumbnail templates routes loaded');
} catch (e) {
  console.error('✗ Failed to load thumbnail templates routes:', e.message);
  thumbnailTemplateRoutes = (req, res) => res.status(500).json({ error: 'Routes not available' });
}
`;

  // Find where to insert (after templateRoutes loading)
  const searchPattern = /try\s*{\s*templateRoutes\s*=\s*require\('\.\/routes\/templates'\);[\s\S]*?\}\s*catch[\s\S]*?\}\s*/;
  const match = appJsContent.match(searchPattern);
  
  if (match) {
    const insertPosition = match.index + match[0].length;
    appJsContent = appJsContent.slice(0, insertPosition) + loadingCode + appJsContent.slice(insertPosition);
    console.log('✅ Added route loading code');
  } else {
    console.error('❌ Could not find insertion point for route loading');
    process.exit(1);
  }

  // Add route mount after app.use('/api/v1/templates', templateRoutes)
  const mountPattern = /app\.use\('\/api\/v1\/templates',\s*templateRoutes\);/;
  const mountMatch = appJsContent.match(mountPattern);
  
  if (mountMatch) {
    const mountPosition = mountMatch.index + mountMatch[0].length;
    const mountCode = `\napp.use('/api/v1/thumbnail-templates', thumbnailTemplateRoutes);`;
    appJsContent = appJsContent.slice(0, mountPosition) + mountCode + appJsContent.slice(mountPosition);
    console.log('✅ Added route mount');
  } else {
    console.error('❌ Could not find insertion point for route mount');
    process.exit(1);
  }

  // Write updated app.js
  fs.writeFileSync(appJsPath, appJsContent, 'utf8');
  console.log('✅ app.js updated\n');
}

console.log('🎉 Thumbnail templates route added successfully!');
console.log('\n📋 Next steps:');
console.log('   1. Restart backend server');
console.log('   2. Refresh browser at http://localhost:5174');
console.log('   3. Wizard should now load templates correctly\n');
