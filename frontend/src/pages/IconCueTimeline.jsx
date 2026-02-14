import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Check,
  X,
  RefreshCw,
  Sparkles,
  Download,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';

const IconCueTimeline = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();

  const [episode, setEpisode] = useState(null);
  const [iconCues, setIconCues] = useState([]);
  const [cursorPaths, setCursorPaths] = useState([]);
  const [musicCues, setMusicCues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [selectedTab, setSelectedTab] = useState('icons'); // icons, cursor, music
  const [filterStatus, setFilterStatus] = useState('all'); // all, suggested, approved
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    fetchData();
  }, [episodeId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch episode
      const episodeRes = await axios.get(`/api/v1/episodes/${episodeId}`);
      setEpisode(episodeRes.data.data);

      // Fetch icon cues
      const iconCuesRes = await axios.get(`/api/v1/episodes/${episodeId}/icon-cues`);
      setIconCues(iconCuesRes.data.data || []);

      // Fetch cursor paths
      const cursorPathsRes = await axios.get(`/api/v1/episodes/${episodeId}/cursor-paths`);
      setCursorPaths(cursorPathsRes.data.data || []);

      // Fetch music cues
      const musicCuesRes = await axios.get(`/api/v1/episodes/${episodeId}/music-cues`);
      setMusicCues(musicCuesRes.data.data || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIconCues = async () => {
    if (!confirm('Generate icon cues from episode scenes? This will use AI to suggest icon placements.')) {
      return;
    }

    try {
      setGenerating(true);
      const response = await axios.post(`/api/v1/episodes/${episodeId}/icon-cues/generate`);
      setIconCues(response.data.data || []);
      alert(`Generated ${response.data.meta.count} icon cues!`);
    } catch (error) {
      console.error('Error generating icon cues:', error);
      alert('Failed to generate icon cues: ' + (error.response?.data?.error?.message || error.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateIconCues = async () => {
    if (!confirm('Regenerate icon cues? This will replace all SUGGESTED cues but keep APPROVED cues.')) {
      return;
    }

    try {
      setGenerating(true);
      const response = await axios.post(`/api/v1/episodes/${episodeId}/icon-cues/regenerate`);
      setIconCues(response.data.data || []);
      alert('Icon cues regenerated!');
    } catch (error) {
      console.error('Error regenerating:', error);
      alert('Failed to regenerate');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateCursorPaths = async () => {
    if (!confirm('Generate cursor paths from approved icon cues?')) {
      return;
    }

    try {
      setGenerating(true);
      const response = await axios.post(`/api/v1/episodes/${episodeId}/cursor-paths/generate`);
      setCursorPaths(response.data.data || []);
      alert(`Generated ${response.data.meta.count} cursor paths!`);
    } catch (error) {
      console.error('Error generating cursor paths:', error);
      alert('Failed to generate cursor paths');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateMusicCues = async () => {
    if (!confirm('Generate music cues from scene structure?')) {
      return;
    }

    try {
      setGenerating(true);
      const response = await axios.post(`/api/v1/episodes/${episodeId}/music-cues/generate`);
      setMusicCues(response.data.data || []);
      alert(`Generated ${response.data.data.length} music cues!`);
    } catch (error) {
      console.error('Error generating music cues:', error);
      alert('Failed to generate music cues');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveIconCue = async (cueId) => {
    try {
      await axios.post(`/api/v1/episodes/${episodeId}/icon-cues/${cueId}/approve`);
      fetchData(); // Refresh
    } catch (error) {
      console.error('Error approving cue:', error);
    }
  };

  const handleRejectIconCue = async (cueId) => {
    const notes = prompt('Rejection reason (optional):');
    try {
      await axios.post(`/api/v1/episodes/${episodeId}/icon-cues/${cueId}/reject`, { notes });
      fetchData();
    } catch (error) {
      console.error('Error rejecting cue:', error);
    }
  };

  const handleApproveAllIconCues = async () => {
    if (!confirm('Approve all suggested icon cues?')) return;

    try {
      await axios.post(`/api/v1/episodes/${episodeId}/icon-cues/approve-all`);
      fetchData();
      alert('All suggested icon cues approved!');
    } catch (error) {
      console.error('Error approving all:', error);
    }
  };

  const handleExportPackage = async () => {
    if (!confirm('Generate production package? This will create a ZIP with all approved cues.')) {
      return;
    }

    try {
      setGenerating(true);
      const response = await axios.post(`/api/v1/episodes/${episodeId}/production-package/generate`);
      
      const zipUrl = response.data.data.zip_file_s3_url;
      
      // Open download in new tab
      window.open(zipUrl, '_blank');
      
      alert('Production package generated! Download started.');
    } catch (error) {
      console.error('Error generating package:', error);
      alert('Failed to generate production package');
    } finally {
      setGenerating(false);
    }
  };

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
  };

  const getStatusBadge = (status) => {
    const colors = {
      suggested: 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border border-yellow-200',
      approved: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200',
      rejected: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200',
      modified: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const filteredIconCues = filterStatus === 'all'
    ? iconCues
    : iconCues.filter(c => c.status === filterStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-8 overflow-hidden">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none"></div>
          
          <div className="relative z-10">
            <button
              onClick={() => navigate(`/episodes/${episodeId}`)}
              className="inline-flex items-center text-indigo-600 hover:text-indigo-700 mb-6 text-sm font-semibold transition-all group hover:gap-2 gap-1"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Episode
            </button>
            
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <div className="relative p-3 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-2xl shadow-lg">
                    <Sparkles className="w-8 h-8 text-white animate-pulse" />
                    <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl"></div>
                  </div>
                  <div>
                    <h1 className="text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1 tracking-tight">
                      Icon Cue Timeline
                    </h1>
                    <p className="text-sm text-indigo-600/60 font-medium tracking-wide uppercase">AI-Powered Animation System</p>
                  </div>
                </div>
                <p className="text-xl text-gray-700 font-medium ml-20">{episode?.title}</p>
              </div>

              <button
                onClick={handleExportPackage}
                disabled={generating}
                className="relative px-8 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-3">
                  <Download className="w-6 h-6 group-hover:animate-bounce" />
                  <span>Export Package</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex border-b border-gray-200/50 bg-gradient-to-r from-gray-50/80 to-white/80 backdrop-blur-sm px-2">
              <button
                onClick={() => setSelectedTab('icons')}
                className={`relative px-10 py-5 font-bold text-base transition-all duration-300 ${
                  selectedTab === 'icons'
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                {selectedTab === 'icons' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-t-full"></div>
                )}
                <div className="flex items-center gap-3">
                  <Sparkles className={`w-5 h-5 ${selectedTab === 'icons' ? 'animate-pulse' : ''}`} />
                  <span>Icon Cues</span>
                  <span className={`px-3 py-1 text-xs rounded-full font-bold transition-all duration-300 ${
                    selectedTab === 'icons' 
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {iconCues.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setSelectedTab('cursor')}
                className={`relative px-10 py-5 font-bold text-base transition-all duration-300 ${
                  selectedTab === 'cursor'
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                {selectedTab === 'cursor' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-t-full"></div>
                )}
                <div className="flex items-center gap-3">
                  <ChevronRight className={`w-5 h-5 ${selectedTab === 'cursor' ? 'animate-pulse' : ''}`} />
                  <span>Cursor Paths</span>
                  <span className={`px-3 py-1 text-xs rounded-full font-bold transition-all duration-300 ${
                    selectedTab === 'cursor' 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {cursorPaths.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setSelectedTab('music')}
                className={`relative px-10 py-5 font-bold text-base transition-all duration-300 ${
                  selectedTab === 'music'
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                {selectedTab === 'music' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 rounded-t-full"></div>
                )}
                <div className="flex items-center gap-3">
                  <Play className={`w-5 h-5 ${selectedTab === 'music' ? 'animate-pulse' : ''}`} />
                  <span>Music Cues</span>
                  <span className={`px-3 py-1 text-xs rounded-full font-bold transition-all duration-300 ${
                    selectedTab === 'music' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {musicCues.length}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Icon Cues Tab */}
          {selectedTab === 'icons' && (
            <div className="p-10 space-y-8">
              {/* Actions */}
              <div className="relative flex items-center justify-between bg-gradient-to-br from-indigo-50/80 via-purple-50/80 to-pink-50/80 backdrop-blur-sm p-6 rounded-2xl border-2 border-indigo-100/50 overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
                
                <div className="relative z-10 flex gap-4">
                  <button
                    onClick={handleGenerateIconCues}
                    disabled={generating}
                    className="relative px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-3">
                      <Sparkles className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                      <span>{iconCues.length === 0 ? 'Generate Icon Cues' : 'Regenerate'}</span>
                    </div>
                  </button>

                  {iconCues.some(c => c.status === 'suggested') && (
                    <button
                      onClick={handleApproveAllIconCues}
                      className="relative px-8 py-4 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white rounded-xl font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 group overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex items-center gap-3">
                        <Check className="w-6 h-6 group-hover:scale-125 transition-transform duration-300" />
                        <span>Approve All Suggested</span>
                      </div>
                    </button>
                  )}
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="relative z-10 px-6 py-3 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="suggested">Suggested</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Cues List */}
              {filteredIconCues.length === 0 ? (
                <div className="text-center py-24">
                  <div className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 rounded-3xl mb-6 shadow-xl">
                    <Sparkles className="w-14 h-14 text-indigo-600 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">
                    {iconCues.length === 0
                      ? 'No icon cues yet'
                      : `No ${filterStatus} icon cues`}
                  </h3>
                  <p className="text-lg text-gray-500 max-w-md mx-auto">
                    {iconCues.length === 0
                      ? 'Click "Generate Icon Cues" to create AI-powered animation suggestions'
                      : 'Try changing the filter above to see other statuses'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredIconCues.map(cue => (
                    <div
                      key={cue.id}
                      className="group relative flex items-center justify-between p-6 border-2 border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-2xl transition-all duration-300 bg-white/80 backdrop-blur-sm transform hover:-translate-y-1"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"></div>
                      
                      <div className="relative z-10 flex items-center gap-6 flex-1">
                        <div className="relative flex flex-col items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border-2 border-indigo-100 shadow-lg group-hover:shadow-xl transition-all duration-300">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          <div className="relative text-2xl font-black text-indigo-600 font-mono">
                            {formatTimestamp(cue.timestamp).split(':')[0]}
                          </div>
                          <div className="relative text-base text-indigo-500 font-mono font-bold">
                            :{formatTimestamp(cue.timestamp).split(':')[1]}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl font-bold text-gray-800">{cue.action}</span>
                            <span className="text-gray-300">•</span>
                            <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold rounded-full">{cue.slot_id}</span>
                          </div>
                          <div className="text-base text-gray-600">{cue.notes || 'No additional notes'}</div>
                        </div>
                        <div>
                          <span className={`text-xs px-4 py-2 rounded-full font-bold shadow-lg ${getStatusBadge(cue.status)}`}>
                            {cue.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {cue.status === 'suggested' && (
                        <div className="relative z-10 flex gap-3 ml-8">
                          <button
                            onClick={() => handleApproveIconCue(cue.id)}
                            className="p-4 text-white bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-125 hover:rotate-6"
                            title="Approve"
                          >
                            <Check className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => handleRejectIconCue(cue.id)}
                            className="p-4 text-white bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-125 hover:-rotate-6"
                            title="Reject"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* Cursor Paths Tab */}
        {selectedTab === 'cursor' && (
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100">
              <p className="text-sm text-gray-700 font-medium">
                🎯 Cursor paths show animated cursor movements to each icon.
              </p>
              <button
                onClick={handleGenerateCursorPaths}
                disabled={generating}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-semibold"
              >
                <Sparkles className="w-5 h-5" />
                Generate Cursor Paths
              </button>
            </div>

            {cursorPaths.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4">
                  <ChevronRight className="w-10 h-10 text-indigo-600" />
                </div>
                <p className="text-xl text-gray-600 mb-2">No cursor paths yet</p>
                <p className="text-gray-500">Generate them from approved icon cues!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cursorPaths.map(path => (
                  <div key={path.id} className="p-5 border-2 border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5 flex-1">
                        <div className="flex flex-col items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-100">
                          <ChevronRight className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-lg text-gray-800 mb-1">
                            {path.action_type}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <span className="font-mono">{formatTimestamp(path.timestamp)}</span>
                            </span>
                            <span className="text-gray-400">•</span>
                            <span>Duration: <span className="font-semibold text-indigo-600">{path.duration_ms}ms</span></span>
                            <span className="text-gray-400">•</span>
                            <span>Easing: <span className="font-medium text-purple-600">{path.easing}</span></span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusBadge(path.status)}`}>
                        {path.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Music Cues Tab */}
        {selectedTab === 'music' && (
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
              <p className="text-sm text-gray-700 font-medium">
                🎵 Music cues define intensity and track type for each scene.
              </p>
              <button
                onClick={handleGenerateMusicCues}
                disabled={generating}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none font-semibold"
              >
                <Sparkles className="w-5 h-5" />
                Generate Music Cues
              </button>
            </div>

            {musicCues.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full mb-4">
                  <Play className="w-10 h-10 text-purple-600" />
                </div>
                <p className="text-xl text-gray-600 mb-2">No music cues yet</p>
                <p className="text-gray-500">Generate them from scene structure!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {musicCues.map(cue => (
                  <div key={cue.id} className="p-6 border-2 border-purple-100 rounded-xl bg-gradient-to-br from-purple-50 via-pink-50 to-white hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-bold text-xl text-gray-800">{cue.scene_name}</h4>
                      </div>
                      <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusBadge(cue.status)}`}>
                        {cue.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="bg-white p-3 rounded-lg border border-purple-100">
                        <span className="text-xs text-gray-500 font-medium block mb-1">⏱️ Time Range</span>
                        <span className="font-mono text-sm font-semibold text-purple-600">{formatTimestamp(cue.start_time)}</span>
                        {cue.end_time && (
                          <> → <span className="font-mono text-sm font-semibold text-purple-600">{formatTimestamp(cue.end_time)}</span></>
                        )}
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-purple-100">
                        <span className="text-xs text-gray-500 font-medium block mb-1">🎹 Track Type</span>
                        <span className="font-semibold text-gray-800 capitalize">{cue.track_type}</span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-purple-100">
                        <span className="text-xs text-gray-500 font-medium block mb-1">📊 Intensity</span>
                        <span className="font-semibold text-gray-800 capitalize">{cue.intensity.replace('_', ' ')}</span>
                      </div>
                      {cue.track_name && (
                        <div className="bg-white p-3 rounded-lg border border-purple-100">
                          <span className="text-xs text-gray-500 font-medium block mb-1">🎼 Track Name</span>
                          <span className="font-semibold text-gray-800">{cue.track_name}</span>
                        </div>
                      )}
                    </div>
                    {cue.mood && (
                      <div className="bg-white p-3 rounded-lg border border-purple-100 mb-3">
                        <span className="text-xs text-gray-500 font-medium block mb-1">😊 Mood</span>
                        <span className="text-gray-700">{cue.mood}</span>
                      </div>
                    )}
                    {cue.notes && (
                      <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500 shadow-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-purple-600 text-sm">📝</span>
                          <span className="text-sm text-gray-700">{cue.notes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default IconCueTimeline;
