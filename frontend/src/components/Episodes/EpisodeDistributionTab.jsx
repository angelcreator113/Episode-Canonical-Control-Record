// frontend/src/components/Episodes/EpisodeDistributionTab.jsx
import React, { useState, useEffect } from 'react';
import './EpisodeDistributionTab.css';

/**
 * EpisodeDistributionTab - Per-platform publishing metadata
 * 
 * Platforms: YouTube, TikTok, Instagram Reels, Facebook
 * Per platform: Title, Caption, Thumbnail, Hashtags, Schedule, Status, URL, Aspect Ratio
 */

const PLATFORMS = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: '📺',
    color: '#FF0000',
    aspectRatio: '16:9',
    maxTitleLength: 100,
    maxDescriptionLength: 5000,
    features: ['title', 'description', 'thumbnail', 'hashtags', 'schedule']
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    aspectRatio: '9:16',
    maxTitleLength: 150,
    maxDescriptionLength: 2200,
    features: ['caption', 'thumbnail', 'hashtags', 'schedule']
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram Reels',
    icon: '📸',
    color: '#E4405F',
    aspectRatio: '9:16',
    maxTitleLength: null,
    maxDescriptionLength: 2200,
    features: ['caption', 'thumbnail', 'hashtags', 'schedule']
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: '👥',
    color: '#1877F2',
    aspectRatio: '1:1',
    maxTitleLength: null,
    maxDescriptionLength: 63206,
    features: ['title', 'description', 'thumbnail', 'hashtags', 'schedule']
  }
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#94a3b8' },
  { value: 'scheduled', label: 'Scheduled', color: '#f59e0b' },
  { value: 'published', label: 'Published', color: '#10b981' },
  { value: 'unlisted', label: 'Unlisted', color: '#64748b' }
];

function EpisodeDistributionTab({ episode, onUpdate }) {
  const [distributionData, setDistributionData] = useState({});
  const [selectedPlatform, setSelectedPlatform] = useState('youtube');
  const [hasChanges, setHasChanges] = useState(false);
  
  useEffect(() => {
    loadDistributionData();
  }, [episode.id]);
  
  const loadDistributionData = () => {
    try {
      if (episode.distribution_metadata) {
        const parsed = typeof episode.distribution_metadata === 'string'
          ? JSON.parse(episode.distribution_metadata)
          : episode.distribution_metadata;
        setDistributionData(parsed);
      } else {
        // Initialize with defaults
        const defaults = {};
        Object.keys(PLATFORMS).forEach(platformId => {
          defaults[platformId] = {
            enabled: false,
            title: episode.title || '',
            caption: '',
            description: '',
            hashtags: [],
            scheduled_time: null,
            status: 'draft',
            thumbnail_url: null,
            platform_url: null
          };
        });
        setDistributionData(defaults);
      }
    } catch (error) {
      console.error('Error loading distribution data:', error);
    }
  };
  
  const handleSave = async () => {
    try {
      await onUpdate({
        distribution_metadata: JSON.stringify(distributionData)
      });
      
      setHasChanges(false);
      alert('Distribution settings saved successfully!');
    } catch (error) {
      console.error('Error saving distribution:', error);
      alert('Failed to save distribution settings');
    }
  };
  
  const updatePlatform = (platformId, field, value) => {
    setDistributionData(prev => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        [field]: value
      }
    }));
    setHasChanges(true);
  };
  
  const togglePlatform = (platformId) => {
    const newEnabled = !distributionData[platformId]?.enabled;
    updatePlatform(platformId, 'enabled', newEnabled);
  };
  
  const addHashtag = (platformId, hashtag) => {
    const currentHashtags = distributionData[platformId]?.hashtags || [];
    if (hashtag && !currentHashtags.includes(hashtag)) {
      updatePlatform(platformId, 'hashtags', [...currentHashtags, hashtag]);
    }
  };
  
  const removeHashtag = (platformId, hashtag) => {
    const currentHashtags = distributionData[platformId]?.hashtags || [];
    updatePlatform(platformId, 'hashtags', currentHashtags.filter(h => h !== hashtag));
  };
  
  const platform = PLATFORMS[selectedPlatform];
  const platformData = distributionData[selectedPlatform] || {};
  const isEnabled = platformData.enabled;
  
  const getCharacterCount = (text, maxLength) => {
    if (!maxLength) return null;
    return `${(text || '').length} / ${maxLength}`;
  };
  
  return (
    <div className="episode-distribution-tab">
      {/* Header */}
      <div className="distribution-header">
        <div className="header-left">
          <h2>🚀 Distribution</h2>
          <p className="header-subtitle">Per-platform publishing metadata</p>
        </div>
        <div className="header-actions">
          {hasChanges && (
            <span className="unsaved-indicator">● Unsaved changes</span>
          )}
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            💾 Save Distribution
          </button>
        </div>
      </div>
      
      {/* Platform Selector */}
      <div className="platform-selector">
        {Object.values(PLATFORMS).map(p => {
          const pData = distributionData[p.id] || {};
          const enabled = pData.enabled;
          
          return (
            <button
              key={p.id}
              className={`platform-card ${selectedPlatform === p.id ? 'active' : ''} ${enabled ? 'enabled' : ''}`}
              onClick={() => setSelectedPlatform(p.id)}
              style={{
                borderColor: selectedPlatform === p.id ? p.color : '#e2e8f0'
              }}
            >
              <div className="platform-icon" style={{ color: p.color }}>
                {p.icon}
              </div>
              <div className="platform-info">
                <div className="platform-name">{p.name}</div>
                <div className="platform-status">
                  {enabled ? (
                    <span className="status-enabled">✓ Enabled</span>
                  ) : (
                    <span className="status-disabled">Not configured</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Platform Editor */}
      <div className="platform-editor">
        <div className="editor-header">
          <div className="editor-title">
            <span className="editor-icon" style={{ color: platform.color }}>
              {platform.icon}
            </span>
            <h3>{platform.name}</h3>
            <span className="aspect-badge">{platform.aspectRatio}</span>
          </div>
          
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={!!isEnabled}
              onChange={() => togglePlatform(selectedPlatform)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">{isEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
        
        {!isEnabled ? (
          <div className="editor-disabled">
            <p>Enable this platform to configure publishing settings</p>
            <button
              className="btn-primary"
              onClick={() => togglePlatform(selectedPlatform)}
            >
              Enable {platform.name}
            </button>
          </div>
        ) : (
          <div className="editor-form">
            {/* Title/Caption */}
            {platform.features.includes('title') && (
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={platformData.title || ''}
                  onChange={(e) => updatePlatform(selectedPlatform, 'title', e.target.value)}
                  placeholder={`Enter ${platform.name} title...`}
                  maxLength={platform.maxTitleLength}
                />
                {platform.maxTitleLength && (
                  <small className="char-count">
                    {getCharacterCount(platformData.title, platform.maxTitleLength)}
                  </small>
                )}
              </div>
            )}
            
            {platform.features.includes('caption') && (
              <div className="form-group">
                <label>Caption</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={platformData.caption || ''}
                  onChange={(e) => updatePlatform(selectedPlatform, 'caption', e.target.value)}
                  placeholder={`Enter ${platform.name} caption...`}
                  maxLength={platform.maxDescriptionLength}
                />
                {platform.maxDescriptionLength && (
                  <small className="char-count">
                    {getCharacterCount(platformData.caption, platform.maxDescriptionLength)}
                  </small>
                )}
              </div>
            )}
            
            {/* Description */}
            {platform.features.includes('description') && (
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-textarea"
                  rows="6"
                  value={platformData.description || ''}
                  onChange={(e) => updatePlatform(selectedPlatform, 'description', e.target.value)}
                  placeholder={`Enter ${platform.name} description...`}
                  maxLength={platform.maxDescriptionLength}
                />
                {platform.maxDescriptionLength && (
                  <small className="char-count">
                    {getCharacterCount(platformData.description, platform.maxDescriptionLength)}
                  </small>
                )}
              </div>
            )}
            
            {/* Hashtags */}
            {platform.features.includes('hashtags') && (
              <div className="form-group">
                <label>Hashtags</label>
                <div className="hashtag-input">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Type hashtag and press Enter..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        let value = e.target.value.trim();
                        if (value && !value.startsWith('#')) {
                          value = '#' + value;
                        }
                        if (value.length > 1) {
                          addHashtag(selectedPlatform, value);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </div>
                {platformData.hashtags && platformData.hashtags.length > 0 && (
                  <div className="hashtag-list">
                    {platformData.hashtags.map(tag => (
                      <span key={tag} className="hashtag-chip">
                        {tag}
                        <button
                          className="hashtag-remove"
                          onClick={() => removeHashtag(selectedPlatform, tag)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Schedule */}
            {platform.features.includes('schedule') && (
              <div className="form-row">
                <div className="form-group">
                  <label>Scheduled Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={platformData.scheduled_time || ''}
                    onChange={(e) => updatePlatform(selectedPlatform, 'scheduled_time', e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-select"
                    value={platformData.status || 'draft'}
                    onChange={(e) => updatePlatform(selectedPlatform, 'status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            {/* Platform URL */}
            <div className="form-group">
              <label>Platform URL (after publish)</label>
              <input
                type="url"
                className="form-input"
                value={platformData.platform_url || ''}
                onChange={(e) => updatePlatform(selectedPlatform, 'platform_url', e.target.value)}
                placeholder={`https://${platform.id}.com/...`}
              />
            </div>
            
            {/* Thumbnail */}
            {platform.features.includes('thumbnail') && (
              <div className="form-group">
                <label>Platform Thumbnail</label>
                <div className="thumbnail-upload">
                  {platformData.thumbnail_url ? (
                    <div className="thumbnail-preview">
                      <img src={platformData.thumbnail_url} alt="Thumbnail" />
                      <button
                        className="btn-remove-thumb"
                        onClick={() => updatePlatform(selectedPlatform, 'thumbnail_url', null)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="thumbnail-placeholder">
                      <span>📸</span>
                      <p>Upload {platform.aspectRatio} thumbnail</p>
                      <button className="btn-secondary">
                        Upload Thumbnail
                      </button>
                    </div>
                  )}
                </div>
                <small className="form-hint">
                  Recommended: {platform.aspectRatio} aspect ratio
                </small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EpisodeDistributionTab;
