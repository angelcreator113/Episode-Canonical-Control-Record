/**
 * Create Episode Page - UPGRADED
 * Sectioned, hierarchical, forgiving, confidence-building
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import { API_URL } from '../config/api';
import episodeService from '../services/episodeService';
import thumbnailService from '../services/thumbnailService';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import TagInput from '../components/TagInput';
import { STATUS_OPTIONS } from '../utils/constants';
import '../styles/EpisodeForm.css';

const MAX_THUMB_MB = 5;
const MAX_THUMB_BYTES = MAX_THUMB_MB * 1024 * 1024;

const CreateEpisode = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState({
    title: '',
    episodeNumber: '',
    season: '',
    status: 'draft',
    description: '',
    airDate: '',
    categories: [],
    showId: '',
  });

  // Distribution & Platforms
  const [platforms, setPlatforms] = useState({
    youtube: false,
    youtubeShorts: false,
    tiktok: false,
    instagramReels: false,
    instagramFeed: false,
    instagramStories: false,
    facebook: false,
    twitter: false,
    linkedin: false,
    other: false,
  });
  const [platformsOther, setPlatformsOther] = useState('');
  const [contentStrategy, setContentStrategy] = useState('same-everywhere'); // same-everywhere, same-visuals-diff-captions, fully-customized
  const [platformDescriptions, setPlatformDescriptions] = useState({});

  // Content Intent
  const [contentTypes, setContentTypes] = useState({
    trailer: false,
    behindTheScenes: false,
    announcement: false,
    mainShow: false,
    credits: false,
  });
  const [primaryAudience, setPrimaryAudience] = useState('');
  const [tones, setTones] = useState({
    playful: false,
    educational: false,
    inspirational: false,
    dramatic: false,
    calm: false,
    highEnergy: false,
    professional: false,
  });

  // Episode Structure
  const [structure, setStructure] = useState({
    hasIntro: false,
    hasOutro: false,
    hasCTA: false,
    hasRecurringSegment: false,
    hasSponsor: false,
  });

  // Visual Requirements
  const [visualReqs, setVisualReqs] = useState({
    brandSafeColors: false,
    mustIncludeLogo: false,
    avoidTextNearEdges: false,
  });

  // Ownership & Collaboration
  const [ownerCreator, setOwnerCreator] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [collaborators, setCollaborators] = useState('');

  // Sponsorship & Brand Deals
  const [hasBrandDeal, setHasBrandDeal] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [integrationRequirements, setIntegrationRequirements] = useState('');
  const [dealDeadline, setDealDeadline] = useState('');
  const [sponsorExpectations, setSponsorExpectations] = useState('');

  // Social Media Collaborations
  const [hasSocialCollab, setHasSocialCollab] = useState(false);
  const [collabPartners, setCollabPartners] = useState('');
  const [collabPlatforms, setCollabPlatforms] = useState('');
  const [collabType, setCollabType] = useState('');
  const [collabDeliverables, setCollabDeliverables] = useState('');
  const [collabTimeline, setCollabTimeline] = useState('');
  const [collabNotes, setCollabNotes] = useState('');

  const [shows, setShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailId, setThumbnailId] = useState(null);

  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('essentials');

  // Redirect if not authed
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load shows
  useEffect(() => {
    const fetchShows = async () => {
      try {
        setLoadingShows(true);
        const response = await fetch(`${API_URL}/shows`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setShows(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load shows:', err);
      } finally {
        setLoadingShows(false);
      }
    };
    fetchShows();
  }, []);

  const progress = useMemo(() => {
    const sections = {
      essential: {
        title: Boolean(formData.title?.trim()),
        show: Boolean(formData.showId),
      },
      scheduling: {
        status: Boolean(formData.status && formData.status !== 'draft'), // Don't count default value
        airDate: Boolean(formData.airDate),
      },
      distribution: {
        platforms: Object.values(platforms).some(Boolean),
        strategy: Boolean(contentStrategy && contentStrategy !== 'same-everywhere'), // Don't count default value
      },
      discovery: {
        description: Boolean(formData.description?.trim()),
        tags: (formData.categories?.length || 0) > 0,
      },
      contentIntent: {
        type: Object.values(contentTypes).some(Boolean),
        tone: Object.values(tones).some(Boolean),
      },
      creative: {
        thumbnail: Boolean(thumbnailPreview || thumbnailId || thumbnailFile),
      },
    };

    const sectionCompletion = {};
    let totalComplete = 0;
    let totalFields = 0;

    Object.keys(sections).forEach((sectionKey) => {
      const fields = sections[sectionKey];
      const complete = Object.values(fields).filter(Boolean).length;
      const total = Object.keys(fields).length;
      sectionCompletion[sectionKey] = {
        complete,
        total,
        percent: Math.round((complete / total) * 100),
        isComplete: complete === total,
      };
      totalComplete += complete;
      totalFields += total;
    });

    return {
      sections: sectionCompletion,
      percent: Math.round((totalComplete / totalFields) * 100),
      totalComplete,
      totalFields,
    };
  }, [formData, thumbnailPreview, thumbnailId, thumbnailFile, platforms, contentStrategy, contentTypes, tones]);

  const clearFieldError = (name) => {
    if (!errors[name]) return;
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const handleCategoriesChange = (newCategories) => {
    setFormData((prev) => ({ ...prev, categories: newCategories }));
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_THUMB_BYTES) {
      setErrors((prev) => ({ ...prev, thumbnail: `File too large (max ${MAX_THUMB_MB}MB)` }));
      return;
    }

    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onload = () => setThumbnailPreview(reader.result);
    reader.readAsDataURL(file);
    clearFieldError('thumbnail');
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setThumbnailId(null);
    const fileInput = document.getElementById('thumbnailFile');
    if (fileInput) fileInput.value = '';
  };

  // Platform checkbox handlers
  const handlePlatformChange = (platform) => {
    setPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  const handleContentTypeChange = (type) => {
    setContentTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleToneChange = (tone) => {
    setTones(prev => ({ ...prev, [tone]: !prev[tone] }));
  };

  const handleStructureChange = (item) => {
    setStructure(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const handleVisualReqChange = (req) => {
    setVisualReqs(prev => ({ ...prev, [req]: !prev[req] }));
  };

  const handlePlatformDescriptionChange = (platform, field, value) => {
    setPlatformDescriptions(prev => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || {}),
        [field]: value,
      },
    }));
  };

  const selectedPlatforms = Object.keys(platforms).filter(p => platforms[p]);
  const showPlatformDescriptions = contentStrategy !== 'same-everywhere' && selectedPlatforms.length > 0;

  const validate = () => {
    const newErrors = {};
    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.showId) {
      newErrors.showId = 'Show is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadThumbnailIfNeeded = async (episodeId) => {
    if (!thumbnailFile) return;
    try {
      await thumbnailService.uploadThumbnail(episodeId, thumbnailFile);
    } catch (err) {
      console.error('Failed to upload thumbnail:', err);
      toast.showError('Episode created, but thumbnail upload failed.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    try {
      setLoading(true);

      const response = await episodeService.createEpisode({
        title: formData.title.trim(),
        episode_number: formData.episodeNumber !== '' ? Number(formData.episodeNumber) : null,
        season: formData.season !== '' ? Number(formData.season) : null,
        status: formData.status,
        description: formData.description,
        air_date: formData.airDate || null,
        categories: formData.categories,
        thumbnail_id: thumbnailId || null,
        show_id: formData.showId || null,
        // Distribution & Platforms
        platforms: platforms,
        platforms_other: platformsOther,
        content_strategy: contentStrategy,
        platform_descriptions: platformDescriptions,
        // Content Intent
        content_types: contentTypes,
        primary_audience: primaryAudience,
        tones: tones,
        // Structure
        structure: structure,
        // Visual Requirements
        visual_requirements: visualReqs,
        // Ownership
        owner_creator: ownerCreator,
        needs_approval: needsApproval,
        collaborators: collaborators,
      });

      const newEpisode = response?.data || response;

      await uploadThumbnailIfNeeded(newEpisode.id);

      toast.showSuccess('Episode created successfully!');
      navigate(`/episodes/${newEpisode.id}`);
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to create episode';
      setError(errorMessage);
      toast.showError(errorMessage);
      setLoading(false);
    }
  };

  if (authLoading) return <LoadingSpinner />;

  return (
    <div className="episode-form-page ce-page">
      {/* HEADER */}
      <div className="ce-header">
        <div className="ce-header__inner">
          <button
            type="button"
            className="ce-link"
            onClick={() => navigate('/episodes')}
            disabled={loading}
          >
            ← Episodes
          </button>

          <div className="ce-header__title">
            <h1>Create New Episode</h1>
            <div className="ce-subline">
              <span className="ce-pill">Draft-friendly</span>
              <span className="ce-dot">•</span>
              <span className="ce-mutedSm">
                {progress.percent}% complete
              </span>
              {formData.status && (
                <>
                  <span className="ce-dot">•</span>
                  <span className="ce-pill ce-pill--soft">
                    Status: {STATUS_OPTIONS.find((o) => o.value === formData.status)?.label || formData.status}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Desktop header actions */}
          <div className="ce-header__actions">
            <button
              type="button"
              className="ce-btn ce-btn--ghost"
              onClick={() => navigate('/episodes')}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-episode-form"
              className="ce-btn ce-btn--primary"
              disabled={loading}
            >
              {loading ? 'Creating…' : 'Create Episode'}
            </button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="ce-tabs">
        <div className="ce-tabs__inner">
          <button
            type="button"
            className={`ce-tab ${activeTab === 'essentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('essentials')}
          >
            ✨ Essentials
          </button>
          <button
            type="button"
            className={`ce-tab ${activeTab === 'publishing' ? 'active' : ''}`}
            onClick={() => setActiveTab('publishing')}
          >
            📅 Publishing
          </button>
          <button
            type="button"
            className={`ce-tab ${activeTab === 'distribution' ? 'active' : ''}`}
            onClick={() => setActiveTab('distribution')}
          >
            🌐 Distribution
          </button>
          <button
            type="button"
            className={`ce-tab ${activeTab === 'metadata' ? 'active' : ''}`}
            onClick={() => setActiveTab('metadata')}
          >
            🔍 Metadata
          </button>
          <button
            type="button"
            className={`ce-tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            🎬 Content
          </button>
          <button
            type="button"
            className={`ce-tab ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            👥 Team
          </button>
          <button
            type="button"
            className={`ce-tab ${activeTab === 'sponsorship' ? 'active' : ''}`}
            onClick={() => setActiveTab('sponsorship')}
          >
            🤝 Sponsorship
          </button>
          <button
            type="button"
            className={`ce-tab ${activeTab === 'social' ? 'active' : ''}`}
            onClick={() => setActiveTab('social')}
          >
            📱 Social Collab
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="ce-body ce-body--single">
        <div className="ce-card ce-alert">
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
          {!error && (
            <div className="ce-mutedSm">
              💡 Tip: you can create with just a <strong>Title</strong> and <strong>Show</strong>. Everything else can be added later.
            </div>
          )}
        </div>

        <form id="create-episode-form" onSubmit={handleSubmit} className="ce-formWrapper">
          
          {/* ===== TAB: Essential Information ===== */}
          {activeTab === 'essentials' && (
            <div className="ce-card ce-section">
              <div className="ce-sectionHeader">
                <div className="ce-sectionTitle">
                  <span className="ce-sectionIcon">✨</span>
                  <h2>Essential Information</h2>
                  {progress.sections.essential.isComplete && (
                    <span className="ce-checkmark">✓</span>
                  )}
                </div>
                <div className="ce-sectionDesc">Required to get started</div>
              </div>

            <div className="ce-grid">
              {/* Title */}
              <div className="ce-field">
                <label htmlFor="title">
                  Episode Title <span className="ce-required">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  className={`ce-input ${errors.title ? 'ce-input--error' : ''}`}
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Winter Lookbook: Episode 1"
                  disabled={loading}
                  required
                />
                {errors.title && <div className="ce-error">{errors.title}</div>}
                <div className="ce-hint">Make it searchable and clear</div>
              </div>

              {/* Show Selection */}
              <div className="ce-field">
                <label htmlFor="showId">
                  Show <span className="ce-required">*</span>
                </label>
                <select
                  id="showId"
                  name="showId"
                  className={`ce-input ${errors.showId ? 'ce-input--error' : ''}`}
                  value={formData.showId}
                  onChange={handleChange}
                  disabled={loading || loadingShows}
                  required
                >
                  <option value="">-- Select a Show --</option>
                  {shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.icon || '📺'} {show.name}
                    </option>
                  ))}
                </select>
                {errors.showId && <div className="ce-error">{errors.showId}</div>}
                <div className="ce-hint">Which show does this episode belong to?</div>
              </div>
            </div>
          </div>
          )}

          {/* ===== TAB: Scheduling & Publishing ===== */}
          {activeTab === 'publishing' && (
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">📅</span>
                <h2>Scheduling & Publishing</h2>
                {progress.sections.scheduling.isComplete && (
                  <span className="ce-checkmark">✓</span>
                )}
              </div>
              <div className="ce-sectionDesc">When and how to publish</div>
            </div>

            <div className="ce-grid ce-grid--3">
              <div className="ce-field">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  className="ce-input"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={loading}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ce-field">
                <label htmlFor="episodeNumber">Episode Number</label>
                <input
                  id="episodeNumber"
                  name="episodeNumber"
                  type="number"
                  className={`ce-input ${errors.episodeNumber ? 'ce-input--error' : ''}`}
                  value={formData.episodeNumber}
                  onChange={handleChange}
                  placeholder="e.g., 1"
                  disabled={loading}
                  min={0}
                />
                {errors.episodeNumber && <div className="ce-error">{errors.episodeNumber}</div>}
              </div>

              <div className="ce-field">
                <label htmlFor="season">Season</label>
                <input
                  id="season"
                  name="season"
                  type="number"
                  className="ce-input"
                  value={formData.season}
                  onChange={handleChange}
                  placeholder="e.g., 1"
                  disabled={loading}
                  min={0}
                />
                <div className="ce-hint">Optional</div>
              </div>
            </div>

            <div className="ce-field">
              <label htmlFor="airDate">Air Date</label>
              <input
                id="airDate"
                name="airDate"
                type="date"
                className="ce-input"
                value={formData.airDate}
                onChange={handleChange}
                disabled={loading}
              />
              <div className="ce-hint">When will this episode be released?</div>
            </div>
          </div>
          )}

          {/* ===== TAB: Discovery & Metadata ===== */}
          {activeTab === 'metadata' && (
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">🔍</span>
                <h2>Discovery & Metadata</h2>
                {progress.sections.discovery.isComplete && (
                  <span className="ce-checkmark">✓</span>
                )}
              </div>
              <div className="ce-sectionDesc">Help people find this episode</div>
            </div>

            <div className="ce-grid">
              {/* Description */}
              <div className="ce-field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  className="ce-input ce-textarea"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="What is this episode about?"
                  disabled={loading}
                  rows={4}
                />
                <div className="ce-hint">Brief summary visible in search and listings</div>
              </div>

              {/* Tags */}
              <div className="ce-field">
                <label>Categories / Tags</label>
                <TagInput
                  tags={formData.categories}
                  onChange={handleCategoriesChange}
                  placeholder="Add tags (e.g., fashion, tutorial, winter)"
                  disabled={loading}
                  maxTags={10}
                />
                <div className="ce-hint">Tags improve searchability and organization</div>
              </div>
            </div>
          </div>
          )}

          {/* ===== TAB: Distribution & Platforms ===== */}
          {activeTab === 'distribution' && (
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">🌐</span>
                <h2>Distribution & Platforms</h2>
                {progress.sections.distribution.isComplete && (
                  <span className="ce-checkmark">✓</span>
                )}
              </div>
              <div className="ce-sectionDesc">Where will this episode be published?</div>
            </div>

            {/* Platform Selection */}
            <div className="ce-field">
              <label>Target Platforms</label>
              <div className="ce-checkboxGrid">
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.youtube}
                    onChange={() => handlePlatformChange('youtube')}
                    disabled={loading}
                  />
                  <span>YouTube (Long-form)</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.youtubeShorts}
                    onChange={() => handlePlatformChange('youtubeShorts')}
                    disabled={loading}
                  />
                  <span>YouTube Shorts</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.tiktok}
                    onChange={() => handlePlatformChange('tiktok')}
                    disabled={loading}
                  />
                  <span>TikTok</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.instagramReels}
                    onChange={() => handlePlatformChange('instagramReels')}
                    disabled={loading}
                  />
                  <span>Instagram Reels</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.instagramFeed}
                    onChange={() => handlePlatformChange('instagramFeed')}
                    disabled={loading}
                  />
                  <span>Instagram Feed</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.instagramStories}
                    onChange={() => handlePlatformChange('instagramStories')}
                    disabled={loading}
                  />
                  <span>Instagram Stories</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.facebook}
                    onChange={() => handlePlatformChange('facebook')}
                    disabled={loading}
                  />
                  <span>Facebook</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.twitter}
                    onChange={() => handlePlatformChange('twitter')}
                    disabled={loading}
                  />
                  <span>X / Twitter</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.linkedin}
                    onChange={() => handlePlatformChange('linkedin')}
                    disabled={loading}
                  />
                  <span>LinkedIn</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={platforms.other}
                    onChange={() => handlePlatformChange('other')}
                    disabled={loading}
                  />
                  <span>Other</span>
                </label>
              </div>
              {platforms.other && (
                <input
                  type="text"
                  className="ce-input"
                  value={platformsOther}
                  onChange={(e) => setPlatformsOther(e.target.value)}
                  placeholder="Specify other platforms..."
                  disabled={loading}
                  style={{ marginTop: '0.5rem' }}
                />
              )}
              <div className="ce-hint" style={{ marginTop: '0.75rem' }}>
                💡 This determines aspect ratios, safe areas, templates, and export presets
              </div>
            </div>

            {/* Content Strategy */}
            {selectedPlatforms.length > 0 && (
              <div className="ce-field">
                <label>Content Strategy</label>
                <div className="ce-radioGroup">
                  <label className="ce-radio">
                    <input
                      type="radio"
                      name="contentStrategy"
                      value="same-everywhere"
                      checked={contentStrategy === 'same-everywhere'}
                      onChange={(e) => setContentStrategy(e.target.value)}
                      disabled={loading}
                    />
                    <span>Same visuals & copy everywhere</span>
                  </label>
                  <label className="ce-radio">
                    <input
                      type="radio"
                      name="contentStrategy"
                      value="same-visuals-diff-captions"
                      checked={contentStrategy === 'same-visuals-diff-captions'}
                      onChange={(e) => setContentStrategy(e.target.value)}
                      disabled={loading}
                    />
                    <span>Same visuals, different captions</span>
                  </label>
                  <label className="ce-radio">
                    <input
                      type="radio"
                      name="contentStrategy"
                      value="fully-customized"
                      checked={contentStrategy === 'fully-customized'}
                      onChange={(e) => setContentStrategy(e.target.value)}
                      disabled={loading}
                    />
                    <span>Different visuals and captions per platform</span>
                  </label>
                </div>
                <div className="ce-hint">
                  Choosing customized options enables platform-specific overrides in the composer
                </div>
              </div>
            )}

            {/* Platform-Specific Descriptions */}
            {showPlatformDescriptions && (
              <div className="ce-field">
                <label>Platform-Specific Descriptions (Optional)</label>
                <div className="ce-platformDescriptions">
                  {selectedPlatforms.map((platformKey) => {
                    const platformLabels = {
                      youtube: 'YouTube',
                      youtubeShorts: 'YouTube Shorts',
                      tiktok: 'TikTok',
                      instagramReels: 'Instagram Reels',
                      instagramFeed: 'Instagram Feed',
                      instagramStories: 'Instagram Stories',
                      facebook: 'Facebook',
                      twitter: 'X / Twitter',
                      linkedin: 'LinkedIn',
                      other: platformsOther || 'Other',
                    };
                    return (
                      <div key={platformKey} className="ce-platformDesc">
                        <h4 className="ce-platformDescTitle">{platformLabels[platformKey]}</h4>
                        <textarea
                          className="ce-input ce-textarea"
                          placeholder="Description / caption"
                          value={platformDescriptions[platformKey]?.description || ''}
                          onChange={(e) => handlePlatformDescriptionChange(platformKey, 'description', e.target.value)}
                          disabled={loading}
                          rows={2}
                        />
                        <input
                          type="text"
                          className="ce-input"
                          placeholder="Hashtags (e.g., #fashion #style)"
                          value={platformDescriptions[platformKey]?.hashtags || ''}
                          onChange={(e) => handlePlatformDescriptionChange(platformKey, 'hashtags', e.target.value)}
                          disabled={loading}
                          style={{ marginTop: '0.5rem' }}
                        />
                        <input
                          type="text"
                          className="ce-input"
                          placeholder="Mentions / CTAs"
                          value={platformDescriptions[platformKey]?.cta || ''}
                          onChange={(e) => handlePlatformDescriptionChange(platformKey, 'cta', e.target.value)}
                          disabled={loading}
                          style={{ marginTop: '0.5rem' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}

          {/* ===== TAB: Content Intent & Format ===== */}
          {activeTab === 'content' && (
          <>
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">🎬</span>
                <h2>Content Intent & Format</h2>
                {progress.sections.contentIntent.isComplete && (
                  <span className="ce-checkmark">✓</span>
                )}
              </div>
              <div className="ce-sectionDesc">Help us understand the nature of this content</div>
            </div>

            {/* Content Type */}
            <div className="ce-field">
              <label>Content Type (Optional)</label>
              <div className="ce-checkboxGrid">
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={contentTypes.trailer}
                    onChange={() => handleContentTypeChange('trailer')}
                    disabled={loading}
                  />
                  <span>Trailer</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={contentTypes.behindTheScenes}
                    onChange={() => handleContentTypeChange('behindTheScenes')}
                    disabled={loading}
                  />
                  <span>Behind the Scenes</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={contentTypes.announcement}
                    onChange={() => handleContentTypeChange('announcement')}
                    disabled={loading}
                  />
                  <span>Announcement</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={contentTypes.mainShow}
                    onChange={() => handleContentTypeChange('mainShow')}
                    disabled={loading}
                  />
                  <span>Main Show</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={contentTypes.credits}
                    onChange={() => handleContentTypeChange('credits')}
                    disabled={loading}
                  />
                  <span>Credits</span>
                </label>
              </div>
              <div className="ce-hint">Informs default pacing and scene templates</div>
            </div>

            {/* Tone */}
            <div className="ce-field">
              <label>Tone (Optional)</label>
              <div className="ce-checkboxGrid">
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={tones.playful}
                    onChange={() => handleToneChange('playful')}
                    disabled={loading}
                  />
                  <span>Playful</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={tones.educational}
                    onChange={() => handleToneChange('educational')}
                    disabled={loading}
                  />
                  <span>Educational</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={tones.inspirational}
                    onChange={() => handleToneChange('inspirational')}
                    disabled={loading}
                  />
                  <span>Inspirational</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={tones.dramatic}
                    onChange={() => handleToneChange('dramatic')}
                    disabled={loading}
                  />
                  <span>Dramatic</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={tones.calm}
                    onChange={() => handleToneChange('calm')}
                    disabled={loading}
                  />
                  <span>Calm</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={tones.highEnergy}
                    onChange={() => handleToneChange('highEnergy')}
                    disabled={loading}
                  />
                  <span>High-energy</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={tones.professional}
                    onChange={() => handleToneChange('professional')}
                    disabled={loading}
                  />
                  <span>Professional</span>
                </label>
              </div>
              <div className="ce-hint">Can influence music, caption tone, and pacing</div>
            </div>

            {/* Audience */}
            <div className="ce-field">
              <label htmlFor="primaryAudience">Primary Audience (Optional)</label>
              <input
                id="primaryAudience"
                type="text"
                className="ce-input"
                value={primaryAudience}
                onChange={(e) => setPrimaryAudience(e.target.value)}
                placeholder="e.g., Fashion enthusiasts, Young professionals"
                disabled={loading}
              />
              <div className="ce-hint">Who is this content for?</div>
            </div>
          </div>

          {/* ===== Episode Structure (Optional) ===== */}
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">🏗️</span>
                <h2>Episode Structure (Optional)</h2>
              </div>
              <div className="ce-sectionDesc">Helps pre-create scene slots and suggest templates</div>
            </div>

            <div className="ce-field">
              <div className="ce-checkboxGrid">
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={structure.hasIntro}
                    onChange={() => handleStructureChange('hasIntro')}
                    disabled={loading}
                  />
                  <span>Has intro</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={structure.hasOutro}
                    onChange={() => handleStructureChange('hasOutro')}
                    disabled={loading}
                  />
                  <span>Has outro</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={structure.hasCTA}
                    onChange={() => handleStructureChange('hasCTA')}
                    disabled={loading}
                  />
                  <span>Has CTA</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={structure.hasRecurringSegment}
                    onChange={() => handleStructureChange('hasRecurringSegment')}
                    disabled={loading}
                  />
                  <span>Has recurring segment</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={structure.hasSponsor}
                    onChange={() => handleStructureChange('hasSponsor')}
                    disabled={loading}
                  />
                  <span>Has sponsor / brand moment</span>
                </label>
              </div>
            </div>
          </div>

          {/* ===== Visual Requirements & Constraints ===== */}
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">🎨</span>
                <h2>Visual Requirements (Optional)</h2>
              </div>
              <div className="ce-sectionDesc">Constraints for the Scene Composer</div>
            </div>

            <div className="ce-field">
              <div className="ce-checkboxGrid">
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={visualReqs.brandSafeColors}
                    onChange={() => handleVisualReqChange('brandSafeColors')}
                    disabled={loading}
                  />
                  <span>Brand safe colors only</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={visualReqs.mustIncludeLogo}
                    onChange={() => handleVisualReqChange('mustIncludeLogo')}
                    disabled={loading}
                  />
                  <span>Must include logo</span>
                </label>
                <label className="ce-checkbox">
                  <input
                    type="checkbox"
                    checked={visualReqs.avoidTextNearEdges}
                    onChange={() => handleVisualReqChange('avoidTextNearEdges')}
                    disabled={loading}
                  />
                  <span>Avoid text near edges (safe areas)</span>
                </label>
              </div>
              <div className="ce-hint">These constraints will show warnings in the composer</div>
            </div>
          </div>
          </>
          )}

          {/* ===== TAB: Team & Approvals (Optional) ===== */}
          {activeTab === 'team' && (
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">👥</span>
                <h2>Team & Approvals (Optional)</h2>
              </div>
              <div className="ce-sectionDesc">Ownership and collaboration</div>
            </div>

            <div className="ce-grid">
              <div className="ce-field">
                <label htmlFor="ownerCreator">Owner / Creator</label>
                <input
                  id="ownerCreator"
                  type="text"
                  className="ce-input"
                  value={ownerCreator}
                  onChange={(e) => setOwnerCreator(e.target.value)}
                  placeholder="e.g., John Doe"
                  disabled={loading}
                />
              </div>

              <div className="ce-field">
                <label htmlFor="collaborators">Collaborators</label>
                <input
                  id="collaborators"
                  type="text"
                  className="ce-input"
                  value={collaborators}
                  onChange={(e) => setCollaborators(e.target.value)}
                  placeholder="e.g., Jane Smith, Alice Johnson"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="ce-field">
              <label className="ce-checkbox">
                <input
                  type="checkbox"
                  checked={needsApproval}
                  onChange={(e) => setNeedsApproval(e.target.checked)}
                  disabled={loading}
                />
                <span>Needs approval before publish</span>
              </label>
            </div>
          </div>
          )}

          {/* ===== TAB: Sponsorship & Brand Deals ===== */}
          {activeTab === 'sponsorship' && (
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">🤝</span>
                <h2>Sponsorship & Brand Deals</h2>
              </div>
              <div className="ce-sectionDesc">Track partnerships and brand integrations</div>
            </div>

            <div className="ce-field">
              <label className="ce-checkbox">
                <input
                  type="checkbox"
                  checked={hasBrandDeal}
                  onChange={(e) => setHasBrandDeal(e.target.checked)}
                  disabled={loading}
                />
                <span>This episode has a brand deal or sponsorship</span>
              </label>
            </div>

            {hasBrandDeal && (
              <>
                <div className="ce-grid ce-grid--2">
                  <div className="ce-field">
                    <label htmlFor="sponsorName">Sponsor / Brand Name *</label>
                    <input
                      id="sponsorName"
                      type="text"
                      className="ce-input"
                      value={sponsorName}
                      onChange={(e) => setSponsorName(e.target.value)}
                      placeholder="e.g., Nike, Spotify"
                      disabled={loading}
                    />
                  </div>

                  <div className="ce-field">
                    <label htmlFor="dealValue">Deal Value / Compensation</label>
                    <input
                      id="dealValue"
                      type="text"
                      className="ce-input"
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                      placeholder="e.g., $5,000, Product exchange"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="ce-field">
                  <label htmlFor="deliverables">Deliverables *</label>
                  <textarea
                    id="deliverables"
                    className="ce-input ce-textarea"
                    value={deliverables}
                    onChange={(e) => setDeliverables(e.target.value)}
                    placeholder="What needs to be delivered? (e.g., 60-second product feature, 2 Instagram stories, brand logo in intro)"
                    disabled={loading}
                    rows={3}
                  />
                  <div className="ce-hint">Specify what content you're contractually obligated to create</div>
                </div>

                <div className="ce-field">
                  <label htmlFor="integrationRequirements">Integration Requirements</label>
                  <textarea
                    id="integrationRequirements"
                    className="ce-input ce-textarea"
                    value={integrationRequirements}
                    onChange={(e) => setIntegrationRequirements(e.target.value)}
                    placeholder="How should the brand be featured? (e.g., Seamless product integration in scene 2, verbal mention in intro, logo placement requirements)"
                    disabled={loading}
                    rows={3}
                  />
                  <div className="ce-hint">Details about how to integrate the brand into the episode</div>
                </div>

                <div className="ce-grid ce-grid--2">
                  <div className="ce-field">
                    <label htmlFor="dealDeadline">Deadline / Due Date</label>
                    <input
                      id="dealDeadline"
                      type="date"
                      className="ce-input"
                      value={dealDeadline}
                      onChange={(e) => setDealDeadline(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="ce-field">
                  <label htmlFor="sponsorExpectations">Special Expectations / Notes</label>
                  <textarea
                    id="sponsorExpectations"
                    className="ce-input ce-textarea"
                    value={sponsorExpectations}
                    onChange={(e) => setSponsorExpectations(e.target.value)}
                    placeholder="Any special requirements, approval processes, do's and don'ts, or other notes"
                    disabled={loading}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
          )}

          {/* ===== TAB: Social Media Collaborations ===== */}
          {activeTab === 'social' && (
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">📱</span>
                <h2>Social Media Collaborations</h2>
              </div>
              <div className="ce-sectionDesc">Coordinate with influencers and partners</div>
            </div>

            <div className="ce-field">
              <label className="ce-checkbox">
                <input
                  type="checkbox"
                  checked={hasSocialCollab}
                  onChange={(e) => setHasSocialCollab(e.target.checked)}
                  disabled={loading}
                />
                <span>This episode involves social media collaboration</span>
              </label>
            </div>

            {hasSocialCollab && (
              <>
                <div className="ce-grid ce-grid--2">
                  <div className="ce-field">
                    <label htmlFor="collabPartners">Collaboration Partners *</label>
                    <input
                      id="collabPartners"
                      type="text"
                      className="ce-input"
                      value={collabPartners}
                      onChange={(e) => setCollabPartners(e.target.value)}
                      placeholder="e.g., @fashioninfluencer, @brandname"
                      disabled={loading}
                    />
                    <div className="ce-hint">Names or handles of collaborators</div>
                  </div>

                  <div className="ce-field">
                    <label htmlFor="collabPlatforms">Platforms</label>
                    <input
                      id="collabPlatforms"
                      type="text"
                      className="ce-input"
                      value={collabPlatforms}
                      onChange={(e) => setCollabPlatforms(e.target.value)}
                      placeholder="e.g., Instagram, TikTok, YouTube"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="ce-field">
                  <label htmlFor="collabType">Collaboration Type</label>
                  <input
                    id="collabType"
                    type="text"
                    className="ce-input"
                    value={collabType}
                    onChange={(e) => setCollabType(e.target.value)}
                    placeholder="e.g., Duet, Shoutout, Guest appearance, Cross-promotion"
                    disabled={loading}
                  />
                </div>

                <div className="ce-field">
                  <label htmlFor="collabDeliverables">Deliverables & Expectations</label>
                  <textarea
                    id="collabDeliverables"
                    className="ce-input ce-textarea"
                    value={collabDeliverables}
                    onChange={(e) => setCollabDeliverables(e.target.value)}
                    placeholder="What content will each party create? (e.g., Partner will share our video on their story, we'll tag them in 2 posts)"
                    disabled={loading}
                    rows={3}
                  />
                </div>

                <div className="ce-field">
                  <label htmlFor="collabTimeline">Timeline / Post Schedule</label>
                  <textarea
                    id="collabTimeline"
                    className="ce-input ce-textarea"
                    value={collabTimeline}
                    onChange={(e) => setCollabTimeline(e.target.value)}
                    placeholder="When will content be posted? (e.g., Day 1: Our video goes live, Day 2: Partner shares story, Day 3: Follow-up post)"
                    disabled={loading}
                    rows={3}
                  />
                </div>

                <div className="ce-field">
                  <label htmlFor="collabNotes">Additional Notes</label>
                  <textarea
                    id="collabNotes"
                    className="ce-input ce-textarea"
                    value={collabNotes}
                    onChange={(e) => setCollabNotes(e.target.value)}
                    placeholder="Contact info, agreements, special arrangements, etc."
                    disabled={loading}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
          )}

        </form>

        {/* Sticky Footer */}
        <div className="ce-stickyFooter">
          <div className="ce-stickyFooterContent">
            <div className="ce-footerProgress">
              <div className="ce-footerProgressText">
                <span className="ce-footerProgressIcon">💪</span>
                <span>{progress.percent}% Complete</span>
              </div>
              <div className="ce-footerHint">
                ✨ You can finish this later — your progress is saved
              </div>
            </div>
            <div className="ce-footerActions">
              <button
                type="button"
                className="ce-btn ce-btn--ghost"
                onClick={() => navigate('/episodes')}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-episode-form"
                className="ce-btn ce-btn--primary ce-btn--large"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="ce-spinner"></span>
                    Creating...
                  </>
                ) : (
                  'Create Episode'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEpisode;
