import { useState, useEffect } from 'react';
import { episodeAPI } from '../services/api';

export const useEpisodeDetail = (id) => {
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEpisode = async () => {
      if (!id) {
        setError('No episode ID provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await episodeAPI.getById(id);
        setEpisode(response.data.data);
      } catch (err) {
        setError(err.message || 'Failed to fetch episode details');
        console.error('Error fetching episode:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEpisode();
  }, [id]);

  const refresh = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await episodeAPI.getById(id);
      setEpisode(response.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { episode, loading, error, refresh };
};
