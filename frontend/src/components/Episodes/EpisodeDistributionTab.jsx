// frontend/src/components/Episodes/EpisodeDistributionTab.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../services/api';
import { thumbnailStudioHref } from '../../lib/thumbnailStudioHref';
import StyleSheetDistributionCard from './StyleSheetDistributionCard';
import { ResultsShare } from './EpisodeResultsSummary';
import './EpisodeDistributionTab.css';

// File-local helpers (fresh — no cross-CP overlap).
export const getEpisodeDistributionApi = (showId, episodeId) =>
  apiClient
    .get(`/api/v1/world/${showId}/episodes/${episodeId}/distribution`)
    .then((r) => r.data);
export const putEpisodeDistributionApi = (showId, episodeId, payload) =>
  apiClient.put(
    `/api/v1/world/${showId}/episodes/${episodeId}/distribution`,
    { distribution_metadata: payload },
  );
export const generateEpisodeDistributionApi = (showId, episodeId, payload = {}) =>
  apiClient
    .post(`/api/v1/world/${showId}/episodes/${episodeId}/generate-distribution`, payload)
    .then((r) => r.data);

/**
 * EpisodeDistributionTab - Per-platform publishing metadata
 * 
 * Platforms: YouTube, TikTok, Instagram Reels, Facebook
 * Per platform: Title, Caption, Thumbnail, Hashtags, Schedule, Status, URL, Aspect Ratio
 *
 * Layout (Evoni, 2026-10-22 layout list): Share, with "Draft for all
 * platforms" in its Platform copy box; the platforms as one status list
 * (switch, status, date; a row opens its editor); the editor in two columns
 * on a desktop (the words; schedule, status, link and the thumbnail at the
 * platform's shape); the style sheet last. Save follows along the bottom;
 * what Save and Draft did shows on the page, not in a pop-up.
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

// A scheduled time as the list shows it: "Nov 2, 6:00 PM".
const whenOf = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'var(--text-secondary)' },
  { value: 'scheduled', label: 'Scheduled', color: 'var(--warning-text)' },
  { value: 'published', label: 'Published', color: 'var(--success-text)' },
  { value: 'unlisted', label: 'Unlisted', color: 'var(--text-secondary)' }
];

function EpisodeDistributionTab({ episode, onUpdate, onOpenTab }) {
  const [distributionData, setDistributionData] = useState({});
  const [selectedPlatform, setSelectedPlatform] = useState('youtube');
  const [hasChanges, setHasChanges] = useState(false);
  const [generating, setGenerating] = useState(false);
  // What Draft and Save did: { error, text }, shown on the page.
  const [draftNote, setDraftNote] = useState(null);
  const [saveNote, setSaveNote] = useState(null);
  
  useEffect(() => {
    loadDistributionData();
  }, [episode.id]);
  
  const loadDistributionData = async () => {
    try {
      // Try loading from episode prop first
      let data = null;
      if (episode.distribution_metadata) {
        data = typeof episode.distribution_metadata === 'string'
          ? JSON.parse(episode.distribution_metadata)
          : episode.distribution_metadata;
      }

      // If no data on episode, try fetching from API
      if (!data || Object.keys(data).length === 0) {
        try {
          const showId = episode?.show_id || episode?.showId;
          if (showId) {
            const json = await getEpisodeDistributionApi(showId, episode.id);
            if (json.success && json.data && Object.keys(json.data).length > 0) {
              data = json.data;
            }
          }
        } catch { /* fall through to defaults */ }
      }

      // Defaults for any platform not saved yet. The record can hold only
      // the style sheet entry (Task #2878), which the server keeps on save.
      const merged = { ...(data || {}) };
      Object.keys(PLATFORMS).forEach(platformId => {
        if (merged[platformId]) return;
        merged[platformId] = {
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
      setDistributionData(merged);
    } catch (error) {
      console.error('Error loading distribution data:', error);
    }
  };
  
  const handleSave = async () => {
    try {
      // Try dedicated distribution endpoint first, fall back to generic update
      const showId = episode?.show_id || episode?.showId;
      try {
        await putEpisodeDistributionApi(showId, episode.id, distributionData);
      } catch {
        await onUpdate({
          distribution_metadata: JSON.stringify(distributionData)
        });
      }

      setHasChanges(false);
      setSaveNote({ text: 'Saved.' });
    } catch (error) {
      console.error('Error saving distribution:', error);
      setSaveNote({ error: true, text: 'Distribution was not saved. Try again.' });
    }
  };

  // Draft every platform's copy from the viewer teaser (or the episode).
  const generate = async () => {
    setGenerating(true);
    setDraftNote(null);
    try {
      const showId = episode?.show_id || episode?.showId;
      const data = await generateEpisodeDistributionApi(showId, episode.id, {});
      if (data.success && data.data?.platforms) {
        // Merge generated data into current state
        const generated = data.data.platforms;
        setDistributionData(prev => {
          const merged = { ...prev };
          for (const [platform, content] of Object.entries(generated)) {
            merged[platform] = { ...merged[platform], ...content, enabled: true };
          }
          return merged;
        });
        setHasChanges(true);
        setSaveNote(null);
        // Drafted from the viewer teaser when the episode has one
        // (P12, Task #2386); otherwise from the episode data.
        const fromTeaser = data.data?.context_used?.source === 'teaser';
        setDraftNote({ text: `Drafted for ${Object.keys(generated).length} platforms ${fromTeaser ? 'from the viewer teaser' : 'from the episode (it has no viewer teaser yet)'}. Look them over, then save.` });
      } else {
        setDraftNote({ error: true, text: data.error || 'Nothing was drafted. Try again.' });
      }
    } catch (err) {
      console.error('[Distribution] generate failed:', err);
      setDraftNote({ error: true, text: err?.response?.data?.error || 'Nothing was drafted. Try again.' });
    } finally {
      setGenerating(false);
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
    setSaveNote(null);
  };
  
  const togglePlatform = (platformId) => {
    const newEnabled = !distributionData[platformId]?.enabled;
    updatePlatform(platformId, 'enabled', newEnabled);
    // Switching one on opens it to fill in.
    if (newEnabled) setSelectedPlatform(platformId);
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
  
  // The copy the Share card counts: the platforms switched on.
  const drafted = Object.fromEntries(Object.entries(distributionData).filter(([, d]) => d?.enabled));

  return (
    <div className="episode-distribution-tab">
      {/* Header */}
      <div className="distribution-header">
        <div className="header-left">
          <h2>Distribution</h2>
          <p className="header-subtitle">What each platform shows: titles, descriptions, tags and schedule</p>
        </div>
      </div>

      {/* What viewers and The Pulse see: the teaser the platform copy is
          drafted from, with Draft for all platforms beside it, and Lala's
          posts (on Results › Summary until Evoni's layout list of 2026-10-22). */}
      <ResultsShare
        episode={{ ...episode, distribution_metadata: drafted }}
        showId={episode?.show_id || episode?.showId}
        onOpenTab={onOpenTab}
        copyAction={(
          <button type="button" className="btn-generate" disabled={generating} onClick={generate}>
            {generating ? '⏳ Drafting…' : '✨ Draft for all platforms'}
          </button>
        )}
      />
      {draftNote && <p className={`dist-note${draftNote.error ? ' is-error' : ''}`} role={draftNote.error ? 'alert' : 'status'}>{draftNote.text}</p>}

      {/* The platforms as one list: switch, status and date; a row opens
          its editor below. */}
      <ul className="dist-platforms" aria-label="Platforms">
        {Object.values(PLATFORMS).map(p => {
          const pData = distributionData[p.id] || {};
          const enabled = !!pData.enabled;
          const status = STATUS_OPTIONS.find(o => o.value === (pData.status || 'draft')) || STATUS_OPTIONS[0];
          const active = selectedPlatform === p.id;
          return (
            <li key={p.id} className={`dist-row${active ? ' is-active' : ''}${enabled ? ' is-on' : ''}`} data-testid={`dist-row-${p.id}`}>
              <button type="button" className="dist-row-pick" aria-current={active ? 'true' : undefined} onClick={() => setSelectedPlatform(p.id)}>
                <span className="platform-icon" style={{ color: p.color }} aria-hidden="true">{p.icon}</span>
                <span className="dist-row-name">{p.name}</span>
                <span className="dist-row-status" style={enabled ? { color: status.color } : undefined}>
                  {enabled ? `${status.label}${pData.scheduled_time ? ` · ${whenOf(pData.scheduled_time)}` : ''}` : 'Off'}
                </span>
              </button>
              <label className="toggle-switch">
                <input type="checkbox" role="switch" checked={enabled} aria-label={`${p.name} on`} onChange={() => togglePlatform(p.id)} />
                <span className="toggle-slider"></span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Platform Editor */}
      <section className="platform-editor" aria-labelledby="dist-editor-title">
        <div className="editor-header">
          <div className="editor-title">
            <span className="editor-icon" style={{ color: platform.color }} aria-hidden="true">
              {platform.icon}
            </span>
            <h3 id="dist-editor-title">{platform.name}</h3>
            <span className="aspect-badge">{platform.aspectRatio}</span>
          </div>
        </div>

        {!isEnabled ? (
          <p className="dist-off">{platform.name} is off for this episode. Switch it on in the list to fill it in.</p>
        ) : (
          <div className="editor-form is-split">
            {/* The words */}
            <div className="editor-words">
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
                            type="button"
                            className="hashtag-remove"
                            aria-label={`Remove ${tag}`}
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
            
            </div>

            {/* When, where, and the picture at the platform's shape */}
            <div className="editor-side">
              {platform.features.includes('schedule') && (
                <>
                  <div className="form-group">
                    <label htmlFor="dist-when">Scheduled Time</label>
                    <input
                      id="dist-when"
                      type="datetime-local"
                      className="form-input"
                      value={platformData.scheduled_time || ''}
                      onChange={(e) => updatePlatform(selectedPlatform, 'scheduled_time', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="dist-status">Status</label>
                    <select
                      id="dist-status"
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
                </>
              )}

              {/* Platform URL */}
              <div className="form-group">
                <label htmlFor="dist-url">Platform URL (after publish)</label>
                <input
                  id="dist-url"
                  type="url"
                  className="form-input"
                  value={platformData.platform_url || ''}
                  onChange={(e) => updatePlatform(selectedPlatform, 'platform_url', e.target.value)}
                  placeholder={`https://${platform.id}.com/...`}
                />
              </div>

              {/* Thumbnail: shown here, edited only in Templates › YouTube
                  thumbnails (Evoni, 2026-10-20). */}
              {platform.features.includes('thumbnail') && (
                <div className="form-group" data-testid="distribution-thumbnail">
                  <label>Thumbnail</label>
                  <div className="thumbnail-upload" style={{ aspectRatio: platform.aspectRatio.replace(':', ' / ') }}>
                    {platformData.thumbnail_url || episode.thumbnail_url ? (
                      <div className="thumbnail-preview">
                        <img src={platformData.thumbnail_url || episode.thumbnail_url} alt={`Thumbnail for ${episode.title || 'the episode'}`} />
                      </div>
                    ) : (
                      <div className="thumbnail-placeholder">
                        <span>📸</span>
                        <p>No thumbnail yet</p>
                      </div>
                    )}
                  </div>
                  <Link className="btn-secondary thumbnail-edit-link" to={thumbnailStudioHref({ showId: episode.show_id || episode.showId, episodeId: episode.id })}>
                    {platformData.thumbnail_url || episode.thumbnail_url ? 'Edit in Thumbnail Studio' : 'Make it in Thumbnail Studio'}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* The approved style sheet, sent from the Style Page (Task #2878):
          its own post, so after the platforms. */}
      <StyleSheetDistributionCard episodeId={episode.id} episodeNumber={episode.episode_number} />

      {/* Save follows along the bottom while there are unsaved changes, as
          the script's Save does (Evoni, 2026-10-22 layout list). */}
      {hasChanges && (
        <div className="distribution-savebar" role="region" aria-label="Unsaved changes" data-testid="distribution-savebar">
          <span>Unsaved changes</span>
          <button type="button" className="btn-save" onClick={handleSave}>💾 Save Distribution</button>
        </div>
      )}
      {saveNote && <p className={`dist-note${saveNote.error ? ' is-error' : ''}`} role={saveNote.error ? 'alert' : 'status'}>{saveNote.text}</p>}
    </div>
  );
}

export default EpisodeDistributionTab;
