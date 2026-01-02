import { useState, useEffect } from 'react';
import { episodeAPI } from '../services/api';

export const useEpisodes = (options = {}) => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const fetchEpisodes = async (fetchOptions = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await episodeAPI.getAll({
        page: fetchOptions.page || pagination.page,
        limit: fetchOptions.limit || pagination.limit,
        status: fetchOptions.status || options.status,
        ...fetchOptions,
      });
      
      setEpisodes(response.data.data);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to fetch episodes');
      console.error('Error fetching episodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, []);

  const goToPage = (page) => {
    fetchEpisodes({ page });
  };

  const changeStatus = (status) => {
    fetchEpisodes({ page: 1, status });
  };

  const refresh = () => {
    fetchEpisodes();
  };

  return {
    episodes,
    loading,
    error,
    pagination,
    goToPage,
    changeStatus,
    refresh,
  };
};
