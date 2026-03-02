const http = require('http');
const data = JSON.stringify({
  title: 'LalaVerse',
  book_tag: 'lalaverse',
  description: 'Characters from the LalaVerse world',
  status: 'draft'
});
const req = http.request({
  hostname: 'localhost',
  port: 3002,
  path: '/api/v1/character-registry/registries',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', d);
  });
});
req.write(data);
req.end();
