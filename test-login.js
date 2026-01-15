const axios = require('axios');

// Test login through Vite proxy endpoint
const testAxios = axios.create({
  baseURL: 'http://localhost:5173/api/v1',
});

console.log('Testing login through Vite proxy at http://localhost:5173/api/v1...\n');

testAxios.post('/auth/login', {
  email: 'test@example.com',
  password: 'password123',
  groups: ['USER', 'EDITOR'],
  role: 'USER',
})
.then(resp => {
  console.log('✓ Login via Vite proxy successful!');
  console.log('✓ Response status:', resp.status);
  console.log('✓ Has accessToken:', !!resp.data.data?.accessToken);
  console.log('✓ User name:', resp.data.data?.user?.name);
})
.catch(err => {
  console.log('✗ Login via Vite proxy FAILED');
  console.log('✗ Error:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.log('✗ Cannot connect to http://localhost:5173 - Vite dev server might not be running');
    console.log('✗ Make sure frontend is running: npm run dev');
  }
  if (err.response) {
    console.log('✗ Response status:', err.response.status);
    console.log('✗ Response data:', err.response.data);
  }
});
