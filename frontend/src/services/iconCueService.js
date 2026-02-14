import axios from 'axios';

const API_BASE = '/api/v1';

export const iconCueService = {
  // Icon Cues
  generateIconCues: (episodeId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/icon-cues/generate`),
  
  regenerateIconCues: (episodeId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/icon-cues/regenerate`),
  
  listIconCues: (episodeId, params = {}) =>
    axios.get(`${API_BASE}/episodes/${episodeId}/icon-cues`, { params }),
  
  getIconCue: (episodeId, cueId) =>
    axios.get(`${API_BASE}/episodes/${episodeId}/icon-cues/${cueId}`),
  
  approveIconCue: (episodeId, cueId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/icon-cues/${cueId}/approve`),
  
  rejectIconCue: (episodeId, cueId, notes) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/icon-cues/${cueId}/reject`, { notes }),
  
  approveAllIconCues: (episodeId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/icon-cues/approve-all`),
  
  // Cursor Paths
  generateCursorPaths: (episodeId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/cursor-paths/generate`),
  
  listCursorPaths: (episodeId, params = {}) =>
    axios.get(`${API_BASE}/episodes/${episodeId}/cursor-paths`, { params }),
  
  approveCursorPath: (episodeId, pathId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/cursor-paths/${pathId}/approve`),
  
  // Music Cues
  generateMusicCues: (episodeId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/music-cues/generate`),
  
  listMusicCues: (episodeId, params = {}) =>
    axios.get(`${API_BASE}/episodes/${episodeId}/music-cues`, { params }),
  
  approveMusicCue: (episodeId, cueId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/music-cues/${cueId}/approve`),
  
  // Production Package
  generatePackage: (episodeId) =>
    axios.post(`${API_BASE}/episodes/${episodeId}/production-package/generate`),
  
  getLatestPackage: (episodeId) =>
    axios.get(`${API_BASE}/episodes/${episodeId}/production-package/latest`),
  
  getPackageVersions: (episodeId) =>
    axios.get(`${API_BASE}/episodes/${episodeId}/production-package/versions`),
  
  downloadPackage: (episodeId, packageId) =>
    `${API_BASE}/episodes/${episodeId}/production-package/${packageId}/download`,
};

export default iconCueService;
