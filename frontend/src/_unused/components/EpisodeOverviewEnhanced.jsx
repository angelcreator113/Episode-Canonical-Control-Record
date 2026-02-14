import React, { useState, useEffect } from 'react';
import axios from 'axios';

const EpisodeOverviewEnhanced = ({ episodeId, episode }) => {
  const [stats, setStats] = useState({
    scenesCount: 0,
    assetsCount: 0,
    wardrobeCount: 0,
    totalDuration: 0,
    hasThumbnail: false,
    hasScript: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [episodeId]);

  const loadStats = async () => {
    try {
      const [scenes, assets, wardrobe] = await Promise.all([
        axios.get(`/api/v1/scenes?episode_id=${episodeId}`).catch(() => ({ data: { data: [] } })),
        axios.get(`/api/v1/episodes/${episodeId}/assets`).catch(() => ({ data: { data: [] } })),
        axios.get(`/api/v1/wardrobe?episode_id=${episodeId}`).catch(() => ({ data: { data: [] } }))
      ]);

      const totalDuration = scenes.data.data?.reduce((sum, scene) => sum + (scene.duration_seconds || 0), 0) || 0;

      setStats({
        scenesCount: scenes.data.data?.length || 0,
        assetsCount: assets.data.data?.length || 0,
        wardrobeCount: wardrobe.data.data?.length || 0,
        totalDuration,
        hasThumbnail: !!episode.thumbnail_url,
        hasScript: !!episode.script_url
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const completionPercentage = () => {
    const checks = [
      stats.hasScript,
      stats.scenesCount > 0,
      stats.assetsCount > 0,
      stats.wardrobeCount > 0,
      stats.hasThumbnail
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>;
  }

  const completion = completionPercentage();

  return (
    <div className="space-y-4">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold mb-1 truncate">{episode.title}</h2>
            <p className="text-blue-100 text-sm mb-3">
              Season {episode.season_number}, Episode {episode.episode_number}
            </p>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                📅 {episode.air_date || 'TBD'}
              </span>
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                {episode.status?.toUpperCase() || 'DRAFT'}
              </span>
            </div>
          </div>
          
          {episode.thumbnail_url && (
            <img
              src={episode.thumbnail_url}
              alt="Thumbnail"
              className="w-24 h-16 object-cover rounded border border-white flex-shrink-0"
            />
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span>Completion</span>
            <span className="font-bold">{completion}%</span>
          </div>
          <div className="bg-white bg-opacity-20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard icon="🎬" label="Scenes" value={stats.scenesCount} />
        <StatCard icon="📁" label="Assets" value={stats.assetsCount} />
        <StatCard icon="👗" label="Wardrobe" value={stats.wardrobeCount} />
        <StatCard icon="⏱️" label="Duration" value={formatDuration(stats.totalDuration)} />
      </div>

      {/* Checklist */}
      <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
        <h3 className="text-xs font-bold text-gray-300 mb-2 uppercase">Checklist</h3>
        <div className="space-y-1.5 text-xs">
          <ChecklistItem label="Script" completed={stats.hasScript} />
          <ChecklistItem label="Scenes" completed={stats.scenesCount > 0} />
          <ChecklistItem label="Assets" completed={stats.assetsCount > 0} />
          <ChecklistItem label="Wardrobe" completed={stats.wardrobeCount > 0} />
          <ChecklistItem label="Thumbnail" completed={stats.hasThumbnail} />
        </div>
      </div>

      {/* Description */}
      {episode.description && (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <h3 className="text-xs font-bold text-gray-300 mb-2">📝 Description</h3>
          <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">{episode.description}</p>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-2 border border-slate-700 text-center">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-sm font-bold text-gray-200">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
};

const ChecklistItem = ({ label, completed }) => {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
        completed ? 'bg-green-600 border-green-600' : 'border-slate-600'
      }`}>
        {completed && <span className="text-white text-xs">✓</span>}
      </div>
      <span className={completed ? 'text-gray-300' : 'text-gray-500'}>{label}</span>
    </div>
  );
};

export default EpisodeOverviewEnhanced;
