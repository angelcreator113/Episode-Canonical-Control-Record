const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 3002,
  path: '/api/v1/character-registry/registries/d118596d-d726-4d63-9855-44a3137586e1',
  method: 'DELETE',
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('Status:', res.statusCode, d));
});
req.end();
