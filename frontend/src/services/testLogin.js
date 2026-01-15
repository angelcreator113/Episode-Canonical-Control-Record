import axios from 'axios';
import authService from './authService';

// Test login from frontend context
export const testFrontendLogin = async () => {
  try {
    console.log('Starting login test...');
    console.log('API_BASE_URL:', authService.API_BASE_URL || '/api/v1');
    
    const response = await axios.post('/api/v1/auth/login', {
      email: 'test@example.com',
      password: 'password123',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    });
    
    console.log('✓ Login successful');
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('✗ Login failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.request);
    }
    throw error;
  }
};
