// frontend/src/components/Show/ShowDistributionTab.jsx
import React, { useState, useEffect } from 'react';
import './ShowDistributionTab.css';

/**
 * ShowDistributionTab - Show-level distribution defaults & settings
 * 
 * Features:
 * - Default distribution settings per platform
 * - Platform account credentials
 * - Publishing templates
 * - Brand guidelines
 * - Default hashtags per show
 * - Aspect ratio preferences
 */

const PLATFORMS = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: '📺',
    color: '#FF0000',
    aspectRatio: '16:9'
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    aspectRatio: '9:16'
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram Reels',
    icon: '📸',
    color: '#E4405F',
    aspectRatio: '9:16'
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: '👥',
    color: '#1877F2',
    aspectRatio: '1:1'
  }
};

function ShowDistributionTab({ show, onUpdate }) {
  const [distributionDefaults, setDistributionDefaults] = useState({});
  const [selectedPlatform, setSelectedPlatform] = useState('youtube');
  const [hasChanges, setHasChanges] = useState(false);
  
  useEffect(() => {
    loadDistributionDefaults();
  }, [show.id]);
  
  const loadDistributionDefaults = () => {
    try {
      if (show.distribution_defaults) {
        const parsed = typeof show.distribution_defaults === 'string'
          ? JSON.parse(show.distribution_defaults)
          : show.distribution_defaults;
        setDistributionDefaults(parsed);
      } else {
        // Initialize with defaults
        const defaults = {};
        Object.keys(PLATFORMS).forEach(platformId => {
          defaults[platformId] = {
            enabled: false,
            account_name: '',
            account_url: '',
            default_hashtags: [],
            default_description_template: '',
            auto_publish: false,
            brand_guidelines: {
              primary_color: '',
              logo_url: '',
              tagline: ''
            }
          };
        });
        setDistributionDefaults(defaults);
      }
    } catch (error) {
      console.error('Error loading distribution defaults:', error);
    }
  };
  
  const handleSave = async () => {
    try {
      await onUpdate({
        distribution_defaults: JSON.stringify(distributionDefaults)
      });
      
      setHasChanges(false);
      alert('Distribution defaults saved successfully!');
    } catch (error) {
      console.error('Error saving distribution defaults:', error);
      alert('Failed to save distribution defaults');
    }
  };
  
  const updatePlatform = (platformId, field, value) => {
    setDistributionDefaults(prev => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        [field]: value
      }
    }));
    setHasChanges(true);
  };
  
  const updateBrandGuideline = (platformId, field, value) => {
    setDistributionDefaults(prev => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        brand_guidelines: {
          ...prev[platformId].brand_guidelines,
          [field]: value
        }
      }
    }));
    setHasChanges(true);
  };
  
  const togglePlatform = (platformId) => {
    const newEnabled = !distributionDefaults[platformId]?.enabled;
    updatePlatform(platformId, 'enabled', newEnabled);
  };
  
  const addHashtag = (platformId, hashtag) => {
    const currentHashtags = distributionDefaults[platformId]?.default_hashtags || [];
    if (hashtag && !currentHashtags.includes(hashtag)) {
      updatePlatform(platformId, 'default_hashtags', [...currentHashtags, hashtag]);
    }
  };
  
  const removeHashtag = (platformId, hashtag) => {
    const currentHashtags = distributionDefaults[platformId]?.default_hashtags || [];
    updatePlatform(platformId, 'default_hashtags', currentHashtags.filter(h => h !== hashtag));
  };
  
  const platform = PLATFORMS[selectedPlatform];
  const platformData = distributionDefaults[selectedPlatform] || {};
  const isEnabled = !!platformData.enabled;
  
  return (
    <div className="show-distribution-tab">
      {/* Header */}
      <div className="distribution-header">
        <div className="header-left">
          <h2>🚀 Distribution Defaults</h2>
          <p className="header-subtitle">
            Show-level settings applied to all new episodes
          </p>
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
            💾 Save Defaults
          </button>
        </div>
      </div>
      
      {/* Info Banner */}
      <div className="info-banner">
        <div className="banner-icon">💡</div>
        <div className="banner-content">
          <strong>Show-Level Defaults:</strong> These settings will be automatically
          applied to all new episodes. You can override them per-episode in the
          Episode Distribution tab.
        </div>
      </div>
      
      {/* Platform Selector */}
      <div className="platform-selector">
        {Object.values(PLATFORMS).map(p => {
          const pData = distributionDefaults[p.id] || {};
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
                    <>
                      <span className="status-enabled">✓ Configured</span>
                      {pData.account_name && (
                        <span className="account-name">@{pData.account_name}</span>
                      )}
                    </>
                  ) : (
                    <span className="status-disabled">Not configured</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Platform Configuration */}
      <div className="platform-config">
        <div className="config-header">
          <div className="config-title">
            <span className="config-icon" style={{ color: platform.color }}>
              {platform.icon}
            </span>
            <h3>{platform.name} Defaults</h3>
            <span className="aspect-badge">{platform.aspectRatio}</span>
          </div>
          
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => togglePlatform(selectedPlatform)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">{isEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
        
        {!isEnabled ? (
          <div className="config-disabled">
            <p>Enable this platform to configure default settings</p>
            <button
              className="btn-primary"
              onClick={() => togglePlatform(selectedPlatform)}
            >
              Enable {platform.name}
            </button>
          </div>
        ) : (
          <div className="config-form">
            {/* Account Settings */}
            <div className="form-section">
              <h4 className="section-title">
                <span className="section-icon">👤</span>
                Account Settings
              </h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Account Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={platformData.account_name || ''}
                    onChange={(e) => updatePlatform(selectedPlatform, 'account_name', e.target.value)}
                    placeholder={`@${show.name.toLowerCase().replace(/\s+/g, '')}`}
                  />
                  <small className="form-hint">Your {platform.name} username/handle</small>
                </div>
                
                <div className="form-group">
                  <label>Account URL</label>
                  <input
                    type="url"
                    className="form-input"
                    value={platformData.account_url || ''}
                    onChange={(e) => updatePlatform(selectedPlatform, 'account_url', e.target.value)}
                    placeholder={`https://${platform.id}.com/...`}
                  />
                  <small className="form-hint">Link to your {platform.name} profile</small>
                </div>
              </div>
            </div>
            
            {/* Default Content */}
            <div className="form-section">
              <h4 className="section-title">
                <span className="section-icon">📝</span>
                Default Content
              </h4>
              
              <div className="form-group">
                <label>Description Template</label>
                <textarea
                  className="form-textarea"
                  rows="6"
                  value={platformData.default_description_template || ''}
                  onChange={(e) => updatePlatform(selectedPlatform, 'default_description_template', e.target.value)}
                  placeholder={`Default description for ${show.name} episodes...\n\nUse {{episode_title}} and {{episode_number}} as placeholders.\n\nExample:\n"Welcome to {{episode_title}}! 🎬\n\n👉 Subscribe for more ${show.name}"`}
                />
                <small className="form-hint">
                  Use <code>{'{{episode_title}}'}</code> and <code>{'{{episode_number}}'}</code> as placeholders
                </small>
              </div>
              
              <div className="form-group">
                <label>Default Hashtags</label>
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
                {platformData.default_hashtags && platformData.default_hashtags.length > 0 && (
                  <div className="hashtag-list">
                    {platformData.default_hashtags.map(tag => (
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
                <small className="form-hint">
                  These hashtags will be added to all episodes by default
                </small>
              </div>
            </div>
            
            {/* Brand Guidelines */}
            <div className="form-section">
              <h4 className="section-title">
                <span className="section-icon">🎨</span>
                Brand Guidelines
              </h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Primary Color</label>
                  <div className="color-input-wrapper">
                    <input
                      type="color"
                      className="color-input"
                      value={platformData.brand_guidelines?.primary_color || '#667eea'}
                      onChange={(e) => updateBrandGuideline(selectedPlatform, 'primary_color', e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input color-text"
                      value={platformData.brand_guidelines?.primary_color || '#667eea'}
                      onChange={(e) => updateBrandGuideline(selectedPlatform, 'primary_color', e.target.value)}
                      placeholder="#667eea"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Tagline</label>
                  <input
                    type="text"
                    className="form-input"
                    value={platformData.brand_guidelines?.tagline || ''}
                    onChange={(e) => updateBrandGuideline(selectedPlatform, 'tagline', e.target.value)}
                    placeholder="Your show's tagline..."
                  />
                </div>
              </div>
            </div>
            
            {/* Publishing Options */}
            <div className="form-section">
              <h4 className="section-title">
                <span className="section-icon">⚙️</span>
                Publishing Options
              </h4>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={platformData.auto_publish || false}
                  onChange={(e) => updatePlatform(selectedPlatform, 'auto_publish', e.target.checked)}
                />
                <span className="checkbox-text">
                  <strong>Auto-Publish</strong>
                  <small>Automatically publish to {platform.name} when episode is marked as "Published"</small>
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="quick-actions">
        <h4>Quick Actions</h4>
        <div className="actions-grid">
          <button className="action-card">
            <span className="action-icon">📋</span>
            <span className="action-label">Apply to All Episodes</span>
          </button>
          <button className="action-card">
            <span className="action-icon">🔄</span>
            <span className="action-label">Sync Account Settings</span>
          </button>
          <button className="action-card">
            <span className="action-icon">📊</span>
            <span className="action-label">View Platform Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShowDistributionTab;
