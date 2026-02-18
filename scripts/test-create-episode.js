/**
 * Test episode creation on dev server
 */
const http = require('http');
const data = JSON.stringify({
  title: 'Test EP Create',
  show_id: 'bd52ee95-4f6c-4c07-9b67-82b233098640'
});

const opts = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/v1/episodes',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(opts, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const j = JSON.parse(body);
      console.log('Success:', !!j.data);
      if (j.data) {
        console.log('Episode ID:', j.data.id);
        console.log('Title:', j.data.title);
        console.log('Show ID:', j.data.show_id);
        
        // Clean up: delete the test episode
        const delReq = http.request({
          hostname: 'localhost',
          port: 3002,
          path: `/api/v1/episodes/${j.data.id}`,
          method: 'DELETE'
        }, delRes => {
          console.log('Cleanup delete:', delRes.statusCode);
        });
        delReq.end();
      } else {
        console.log('Error:', j.error, j.message);
      }
    } catch(e) {
      console.log('Body:', body.substring(0, 500));
    }
  });
});
req.write(data);
req.end();
