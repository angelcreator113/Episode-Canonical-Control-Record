import { useState, useEffect } from 'react';
import { thumbnailAPI } from '../services/api';

export const useThumbnails = (episodeId = null) => {
  const [thumbnails, setThumbnails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const fetchThumbnails = async (fetchOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await thumbnailAPI.getAll({
        page: fetchOptions.page || pagination.page,
        limit: fetchOptions.limit || pagination.limit,
      });

      let filtered = response.data.data;

      // If episodeId is provided, filter thumbnails for that episode
      if (episodeId) {
        filtered = filtered.filter(
          thumb => thumb.episode_id === episodeId
        );
      }

      // Transform API response to include s3_url for compatibility
      filtered = filtered.map(thumb => ({
        ...thumb,
        // For now, use placeholder images since real S3 images don't exist
        // In production, construct real S3 URL: https://${thumb.s3Bucket}.s3.amazonaws.com/${thumb.s3Key}
        s3_url: `https://picsum.photos/800/600?random=${thumb.id}`,
        episode_id: thumb.episode_id || thumb.episodeId,
        thumbnail_type: thumb.thumbnail_type || thumb.thumbnailType,
      }));

      setThumbnails(filtered);
      setPagination(response.data.pagination || {
        page: 1,
        limit: 20,
        total: filtered.length,
        pages: Math.ceil(filtered.length / 20),
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch thumbnails');
      console.error('Error fetching thumbnails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThumbnails();
  }, [episodeId]);

  const goToPage = (page) => {
    fetchThumbnails({ page });
  };

  const refresh = () => {
    fetchThumbnails();
  };

  return {
    thumbnails,
    loading,
    error,
    pagination,
    goToPage,
    refresh,
  };
};
