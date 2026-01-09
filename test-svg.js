// Test SVG encoding to understand the issue

const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect fill='#667eea' width='150' height='150'/><text x='75' y='65' text-anchor='middle' font-size='40' dy='.3em' dominant-baseline='middle'>🎨</text><text x='75' y='120' text-anchor='middle' fill='white' font-size='11'>Promo 1</text></svg>`;

console.log('SVG length:', svg.length);
console.log('SVG:', svg);

// Test encoding
const encoded = Buffer.from(svg).toString('base64');
console.log('Base64 encoded:', encoded);

// Test data URI
const dataUri = `data:image/svg+xml;base64,${encoded}`;
console.log('Data URI:', dataUri);
console.log('Data URI length:', dataUri.length);

// Test if it's decodable
try {
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  console.log('Decoded matches original:', decoded === svg);
} catch (e) {
  console.error('Decoding error:', e.message);
}
