import { useState, useEffect, useCallback } from 'react';
import { iconCueService } from '../services/iconCueService';

export const useIconCues = (episodeId) => {
  const [iconCues, setIconCues] = useState([]);
  const [cursorPaths, setCursorPaths] = useState([]);
  const [musicCues, setMusicCues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [iconRes, cursorRes, musicRes] = await Promise.all([
        iconCueService.listIconCues(episodeId),
        iconCueService.listCursorPaths(episodeId),
        iconCueService.listMusicCues(episodeId),
      ]);

      setIconCues(iconRes.data.data || []);
      setCursorPaths(cursorRes.data.data || []);
      setMusicCues(musicRes.data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching cue data:', err);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    if (episodeId) {
      fetchAll();
    }
  }, [episodeId, fetchAll]);

  const generateIconCues = async () => {
    try {
      const response = await iconCueService.generateIconCues(episodeId);
      setIconCues(response.data.data || []);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const approveIconCue = async (cueId) => {
    try {
      await iconCueService.approveIconCue(episodeId, cueId);
      await fetchAll(); // Refresh
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const approveAll = async () => {
    try {
      await iconCueService.approveAllIconCues(episodeId);
      await fetchAll();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    iconCues,
    cursorPaths,
    musicCues,
    loading,
    error,
    refresh: fetchAll,
    generateIconCues,
    approveIconCue,
    approveAll,
  };
};

export default useIconCues;
