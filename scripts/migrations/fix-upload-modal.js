const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'EpisodeAssetsTab.jsx');

// Read file
let content = fs.readFileSync(filePath, 'utf8');

// Define replacements
const replacements = [
  ['Ã°Å¸â€™Å" Will be saved as:', '💾 Will be saved as:'],
  [' Ã¢â‚¬Â¢ ', ' • '],
  ["Ã°Å¸â€™Å\" LALA folder", '👩 LALA folder'],
  ["Ã°Å¸â€™Å\" SHOW folder", '📺 SHOW folder'],
  ["Ã°Å¸â€™Å\" GUEST folder", '👤 GUEST folder'],
  ["Ã°Å¸â€™Å\" Show Title Ã¢â€ â€™ SHOW folder", '📺 Show Title → SHOW folder'],
  ["Ã°Å¸Å'â€ž EPISODE folder", '📁 EPISODE folder'],
  ["Ã°Å¸â€"Â±Ã¯Â¸Â EPISODE folder", '🖱️ EPISODE folder'],
  ["Ã°Å¸â€Ëœ EPISODE folder", '📁 EPISODE folder']
];

// Apply replacements
replacements.forEach(([from, to]) => {
  content = content.split(from).join(to);
});

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed all folder icon encodings');
