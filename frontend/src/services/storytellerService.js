import api from './api';

const storytellerService = {
  async getBooks() {
    const res = await api.get('/api/v1/storyteller/books');
    return res.data?.data || res.data || [];
  },

  async getBook(id) {
    const res = await api.get(`/api/v1/storyteller/books/${id}`);
    return res.data?.data || res.data;
  },
};

export default storytellerService;
