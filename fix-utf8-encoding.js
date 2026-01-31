/**
 * Fix UTF-8 Encoding Issues in Frontend Files
 * 
 * This script fixes corrupted emoji characters that were saved with incorrect encoding.
 * The file was saved as UTF-8 but characters got double-encoded or misinterpreted.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'EpisodeAssetsTab.jsx');

console.log('\ud83d\udd27 FIXING UTF-8 ENCODING ISSUES\n');
console.log('=' .repeat(70));

try {
  // Read the file as UTF-8
  let content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`\ud83d\udcc4 Reading: ${filePath}\n`);
  
  // Define all the corrupted→correct emoji mappings using Buffer for corrupted bytes
  const fixes = [
    // Corrupted bytes as Buffer, correct UTF-8 emoji
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x9C, 0xC2, 0xA4]).toString('utf8'), good: '\ud83d\udce4', desc: 'Upload emoji 📤' },
    { bad: Buffer.from([0xC5, 0xA1, 0x20, 0xC3, 0xAF, 0xC2, 0xB8]).toString('utf8'), good: '\u26a0\ufe0f', desc: 'Warning emoji ⚠️' },
    { bad: '\u2026', good: '\u2705', desc: 'Check mark emoji ✅' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x9C, 0xE2, 0x80, 0x9E]).toString('utf8'), good: '\ud83d\udd04', desc: 'Processing emoji 🔄' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x9C, 0xC2, 0xA5]).toString('utf8'), good: '\ud83d\udce5', desc: 'Download emoji 📥' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x93, 0xC2, 0xBC, 0xC3, 0xAF, 0xC2, 0xB8]).toString('utf8'), good: '\ud83d\uddbc\ufe0f', desc: 'Picture frame emoji 🖼️' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x9C, 0xC2, 0xA2]).toString('utf8'), good: '\ud83d\udce2', desc: 'Loudspeaker emoji 📢' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x9C, 0xC2, 0xA6]).toString('utf8'), good: '\ud83d\udce6', desc: 'Package emoji 📦' },
    { bad: '\u00a5', good: '\ud83c\udfa5', desc: 'Movie camera emoji 🎥' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x98, 0xC3, 0xAF, 0xC2, 0xB8]).toString('utf8'), good: '\ud83d\udc41\ufe0f', desc: 'Eye emoji 👁️' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x94, 0xE2, 0x80, 0x98, 0xC3, 0xAF, 0xC2, 0xB8]).toString('utf8'), good: '\ud83d\uddd1\ufe0f', desc: 'Trash emoji 🗑️' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xC2, 0xB7, 0xC3, 0xAF, 0xC2, 0xB8]).toString('utf8'), good: '\ud83c\udff7\ufe0f', desc: 'Label emoji 🏷️' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x98, 0xC2, 0xA9]).toString('utf8'), good: '\ud83d\udc69', desc: 'Woman emoji 👩' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x98, 0xC5, 0x93]).toString('utf8'), good: '\ud83d\udc5c', desc: 'Handbag emoji 👜' },
    { bad: Buffer.from([0xC3, 0xB0, 0xC5, 0xB8, 0xE2, 0x80, 0x98, 0xC2, 0xA4]).toString('utf8'), good: '\ud83d\udc64', desc: 'Bust emoji 👤' },
    { bad: '\u2026', good: '\u2705', desc: 'Checkmark' },
    { bad: Buffer.from([0xC2, 0xA5]).toString('utf8'), good: '\ud83c\udfa5', desc: 'Video camera' },
  ];
  
  let fixCount = 0;
  
  fixes.forEach(({ bad, good, desc }) => {
    const regex = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    
    if (matches) {
      content = content.replace(regex, good);
      fixCount += matches.length;
      console.log(`\u2705 Fixed ${matches.length}x ${desc}: "${bad}" \u2192 "${good}"`);
    }
  });
  
  if (fixCount > 0) {
    // Write back with UTF-8 BOM to ensure proper encoding
    fs.writeFileSync(filePath, '\ufeff' + content.replace(/^\ufeff/, ''), 'utf8');
    console.log(`\n\u2705 Fixed ${fixCount} encoding issues and saved file with UTF-8 BOM`);
  } else {
    console.log('\n\u2705 No encoding issues found!');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\u2705 ENCODING FIX COMPLETE\n');
  
} catch (error) {
  console.error('\n\u274c ERROR:', error.message);
  process.exit(1);
}
