const axios = require('axios');

async function checkOutfitError() {
  try {
    const response = await axios.get('https://dev.primepisodes.com/api/v1/outfit-sets');
    console.log('✅ Outfit Sets endpoint working:', response.status);
  } catch (error) {
    console.error('❌ Outfit Sets Error:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data?.error || error.response?.data);
  }
}

checkOutfitError();
