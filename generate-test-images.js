/**
 * Generate test images for Phase 2.5 testing
 * Creates PNG images with different colors to distinguish them
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Sharp not installed. Install with: npm install sharp');
  process.exit(1);
}

const testDir = path.join(__dirname, 'test-images');

// Create test-images directory if it doesn't exist
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

async function generateTestImages() {
  console.log('🎨 Generating test images for Phase 2.5 testing...\n');

  try {
    // Test image 1: PROMO_LALA (Pink background)
    console.log('Creating test image 1: PROMO_LALA (300x300px, pink)...');
    await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 255, g: 192, b: 203 }, // Pink
      },
    })
      .png()
      .toFile(path.join(testDir, 'test-lala.png'));
    console.log('  ✅ test-lala.png created\n');

    // Test image 2: PROMO_GUEST (Blue background)
    console.log('Creating test image 2: PROMO_GUEST (300x300px, blue)...');
    await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 173, g: 216, b: 230 }, // Light blue
      },
    })
      .png()
      .toFile(path.join(testDir, 'test-guest.png'));
    console.log('  ✅ test-guest.png created\n');

    // Test image 3: EPISODE_FRAME (Green background)
    console.log('Creating test image 3: EPISODE_FRAME (1920x1080px, green)...');
    await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 144, g: 238, b: 144 }, // Light green
      },
    })
      .png()
      .toFile(path.join(testDir, 'test-frame.png'));
    console.log('  ✅ test-frame.png created\n');

    console.log('📁 All test images created in: ' + testDir);
    console.log('\n📋 Image files:');
    console.log('  • test-lala.png (300x300px, PROMO_LALA)');
    console.log('  • test-guest.png (300x300px, PROMO_GUEST)');
    console.log('  • test-frame.png (1920x1080px, EPISODE_FRAME)\n');

    console.log('✅ Ready for testing!\n');
  } catch (error) {
    console.error('❌ Error generating images:', error.message);
    process.exit(1);
  }
}

generateTestImages();
