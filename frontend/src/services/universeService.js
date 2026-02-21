import api from './api';

const universeService = {
  async getUniverses() {
    const res = await api.get('/api/v1/universe');
    return res.data?.universes || res.data?.data || res.data || [];
  },

  async getUniverse(id) {
    const res = await api.get(`/api/v1/universe/${id}`);
    return res.data?.data || res.data;
  },

  async getSeries(universeId) {
    const url = universeId
      ? `/api/v1/universe/series?universe_id=${universeId}`
      : '/api/v1/universe/series';
    const res = await api.get(url);
    return res.data?.series || res.data?.data || res.data || [];
  },
};

export default universeService;
