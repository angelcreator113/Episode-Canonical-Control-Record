const http = require('http');
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 3002, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf.slice(0, 1000) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000);
    req.write(data);
    req.end();
  });
}
async function main() {
  console.log('Testing generate-story-tasks with 16k max_tokens...');
  const t = Date.now();
  const r = await post('/api/v1/memories/generate-story-tasks', { characterKey: 'justawoman' });
  console.log('Status:', r.status, '| Time:', ((Date.now() - t)/1000).toFixed(1) + 's');
  if (r.status === 200 && r.body.tasks) {
    console.log('Tasks:', r.body.tasks.length);
    console.log('Character:', r.body.display_name);
    console.log('First:', JSON.stringify(r.body.tasks[0]?.title));
    console.log('Last:', JSON.stringify(r.body.tasks[r.body.tasks.length - 1]?.title));
  } else {
    console.log('Response:', JSON.stringify(r.body).slice(0, 500));
  }
}
main().catch(e => console.error('FATAL:', e.message));
