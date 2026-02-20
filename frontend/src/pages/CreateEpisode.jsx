/**
 * Create Episode Page - UPGRADED
 * Sectioned, hierarchical, forgiving, confidence-building
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import { API_URL } from '../config/api';
import episodeService from '../services/episodeService';
import thumbnailService from '../services/thumbnailService';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import TagInput from '../components/TagInput';
import { STATUS_OPTIONS } from '../utils/constants';
import SceneComposerFull from '../components/SceneComposer/SceneComposerFull';
import './CreateEpisode.css';

const MAX_THUMB_MB = 5;
const MAX_THUMB_BYTES = MAX_THUMB_MB * 1024 * 1024;

const CreateEpisode = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();
  const isEditMode = Boolean(episodeId);

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

  // Pre-populate show_id from URL query parameter (e.g. /episodes/create?show_id=<uuid>)
  useEffect(() => {
    const showIdFromUrl = searchParams.get('show_id');
    if (showIdFromUrl && !isEditMode) {
      setFormData(prev => ({ ...prev, showId: showIdFromUrl }));
    }
  }, [searchParams, isEditMode]);

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

  // Load episode data for edit mode
  useEffect(() => {
    if (!isEditMode) return;

    if (!episodeId) {
      setError('Invalid episode ID');
      setTimeout(() => navigate('/episodes', { replace: true }), 1000);
      return;
    }

    const fetchEpisode = async () => {
      try {
        setLoading(true);
        const episode = await episodeService.getEpisode(episodeId);

        setFormData({
          title: episode.title || '',
          episodeNumber: episode.episode_number || '',
          season: episode.season_number ?? episode.season ?? '',
          status: episode.status || 'draft',
          description: episode.description || '',
          airDate: episode.air_date ? episode.air_date.split('T')[0] : '',
          categories: Array.isArray(episode.categories) ? episode.categories : [],
          showId: episode.show_id || '',
        });

        // Load distribution & platforms
        if (episode.platforms) setPlatforms(episode.platforms);
        if (episode.platforms_other) setPlatformsOther(episode.platforms_other);
        if (episode.content_strategy) setContentStrategy(episode.content_strategy);
        if (episode.platform_descriptions) setPlatformDescriptions(episode.platform_descriptions);

        // Load content intent
        if (episode.content_types) setContentTypes(episode.content_types);
        if (episode.primary_audience) setPrimaryAudience(episode.primary_audience);
        if (episode.tones) setTones(episode.tones);

        // Load structure
        if (episode.structure) setStructure(episode.structure);

        // Load visual requirements
        if (episode.visual_requirements) setVisualReqs(episode.visual_requirements);

        // Load team & ownership
        if (episode.owner_creator) setOwnerCreator(episode.owner_creator);
        if (episode.collaborators) setCollaborators(episode.collaborators);
        if (typeof episode.needs_approval === 'boolean') setNeedsApproval(episode.needs_approval);

        // Load sponsorship data
        if (typeof episode.has_brand_deal === 'boolean') setHasBrandDeal(episode.has_brand_deal);
        if (episode.sponsor_name) setSponsorName(episode.sponsor_name);
        if (episode.deal_value) setDealValue(episode.deal_value);
        if (episode.deliverables) setDeliverables(episode.deliverables);
        if (episode.integration_requirements) setIntegrationRequirements(episode.integration_requirements);
        if (episode.deal_deadline) setDealDeadline(episode.deal_deadline.split('T')[0]);
        if (episode.sponsor_expectations) setSponsorExpectations(episode.sponsor_expectations);

        // Load social collab data
        if (typeof episode.has_social_collab === 'boolean') setHasSocialCollab(episode.has_social_collab);
        if (episode.collab_partners) setCollabPartners(episode.collab_partners);
        if (episode.collab_platforms) setCollabPlatforms(episode.collab_platforms);
        if (episode.collab_type) setCollabType(episode.collab_type);
        if (episode.collab_deliverables) setCollabDeliverables(episode.collab_deliverables);
        if (episode.collab_timeline) setCollabTimeline(episode.collab_timeline);
        if (episode.collab_notes) setCollabNotes(episode.collab_notes);

        // Set existing thumbnail
        if (episode.thumbnail_url) {
          setThumbnailPreview(episode.thumbnail_url);
        }
        if (episode.thumbnail_id) {
          setThumbnailId(episode.thumbnail_id);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load episode:', err);
        const errorMessage = err?.response?.data?.error || err?.message || 'Failed to load episode';
        setError(errorMessage);
        toast.showError(errorMessage);
        setLoading(false);
      }
    };

    fetchEpisode();
  }, [episodeId, isEditMode, navigate, toast]);

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

      const episodeData = {
        title: formData.title.trim(),
        episode_number: formData.episodeNumber !== '' ? Number(formData.episodeNumber) : null,
        season_number: formData.season !== '' ? Number(formData.season) : null,
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
        // Sponsorship & Brand Deals
        has_brand_deal: hasBrandDeal,
        sponsor_name: sponsorName,
        deal_value: dealValue,
        deliverables: deliverables,
        integration_requirements: integrationRequirements,
        deal_deadline: dealDeadline || null,
        sponsor_expectations: sponsorExpectations,
        // Social Media Collaborations
        has_social_collab: hasSocialCollab,
        collab_partners: collabPartners,
        collab_platforms: collabPlatforms,
        collab_type: collabType,
        collab_deliverables: collabDeliverables,
        collab_timeline: collabTimeline,
        collab_notes: collabNotes,
      };

      let resultEpisode;
      if (isEditMode) {
        const response = await episodeService.updateEpisode(episodeId, episodeData);
        resultEpisode = response?.data || response;
        await uploadThumbnailIfNeeded(episodeId);
        toast.showSuccess('Episode updated successfully!');
      } else {
        const response = await episodeService.createEpisode(episodeData);
        resultEpisode = response?.data || response;
        await uploadThumbnailIfNeeded(resultEpisode.id);
        toast.showSuccess('Episode created successfully!');
      }

      navigate(`/episodes/${resultEpisode.id}`);
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || `Failed to ${isEditMode ? 'update' : 'create'} episode`;
      setError(errorMessage);
      toast.showError(errorMessage);
      setLoading(false);
    }
  };

  if (authLoading) return <LoadingSpinner />;

  return (
    <div className="create-episode-page">
      {/* HEADER */}
      <div className="create-episode-header">
        <div className="header-container">
          <div className="header-top">
            <button
              type="button"
              className="back-btn"
              onClick={() => navigate('/episodes')}
              disabled={loading}
            >
              ← Back to Episodes
            </button>

            <div className="header-title-section">
              <h1>{isEditMode ? 'Edit Episode' : 'Create New Episode'}</h1>
              <div className="header-meta">
                <span className="meta-badge">Draft-friendly</span>
                <span className="meta-separator">•</span>
                <span className="meta-badge">
                  {progress.percent}% complete
                </span>
                {formData.status && (
                  <>
                    <span className="meta-separator">•</span>
                    <span className="meta-badge">
                      Status: {STATUS_OPTIONS.find((o) => o.value === formData.status)?.label || formData.status}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Desktop header actions */}
            <div className="header-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => navigate('/episodes')}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-episode-form"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? (isEditMode ? 'Updating…' : 'Creating…') : (isEditMode ? 'Update Episode' : 'Create Episode')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="episode-tabs">
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-button ${activeTab === 'essentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('essentials')}
          >
            ✨ Essentials
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'publishing' ? 'active' : ''}`}
            onClick={() => setActiveTab('publishing')}
          >
            📅 Publishing
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'distribution' ? 'active' : ''}`}
            onClick={() => setActiveTab('distribution')}
          >
            🌐 Distribution
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'metadata' ? 'active' : ''}`}
            onClick={() => setActiveTab('metadata')}
          >
            🔍 Metadata
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            🎬 Content
          </button>
          {isEditMode && (
            <button
              type="button"
              className={`tab-button ${activeTab === 'scenes' ? 'active' : ''}`}
              onClick={() => setActiveTab('scenes')}
            >
              🎞️ Scene Composer
            </button>
          )}
          <button
            type="button"
            className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            👥 Team
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'sponsorship' ? 'active' : ''}`}
            onClick={() => setActiveTab('sponsorship')}
          >
            🤝 Sponsorship
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'social' ? 'active' : ''}`}
            onClick={() => setActiveTab('social')}
          >
            📱 Social Collab
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="episode-body">
        {/* Hide tip banner and form on Scene Composer tab */}
        {activeTab !== 'scenes' && (
          <>
            {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
            {!error && (
              <div className="tip-banner">
                💡 Tip: you can create with just a <strong>Title</strong> and <strong>Show</strong>. Everything else can be added later.
              </div>
            )}

            <form id="create-episode-form" onSubmit={handleSubmit} className="episode-form">
          
          {/* ===== TAB: Essential Information ===== */}
          {activeTab === 'essentials' && (
            <div className="form-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-icon">✨</span>
                  Essential Information
                  {progress.sections.essential.isComplete && (
                    <span style={{ marginLeft: '0.5rem' }}>✓</span>
                  )}
                </h2>
                <p className="section-description">Required to get started</p>
              </div>

            <div className="form-grid">
              {/* Title */}
              <div className="form-group">
                <label htmlFor="title">
                  Episode Title <span className="required">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  className={`form-input ${errors.title ? 'error' : ''}`}
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Winter Lookbook: Episode 1"
                  disabled={loading}
                  required
                />
                {errors.title && <div className="error-message">{errors.title}</div>}
                <div className="form-hint">Make it searchable and clear</div>
              </div>

              {/* Show Selection */}
              <div className="form-group">
                <label htmlFor="showId">
                  Show <span className="required">*</span>
                </label>
                <select
                  id="showId"
                  name="showId"
                  className={`form-input ${errors.showId ? 'error' : ''}`}
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
                {errors.showId && <div className="error-message">{errors.showId}</div>}
                <div className="form-hint">Which show does this episode belong to?</div>
              </div>
            </div>
          </div>
          )}

          {/* ===== TAB: Scheduling & Publishing ===== */}
          {activeTab === 'publishing' && (
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">📅</span>
                Scheduling & Publishing
                {progress.sections.scheduling.isComplete && (
                  <span style={{ marginLeft: '0.5rem' }}>✓</span>
                )}
              </h2>
              <p className="section-description">When and how to publish</p>
            </div>

            <div className="form-grid form-grid-3">
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  className="form-input"
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

              <div className="form-group">
                <label htmlFor="episodeNumber">Episode Number</label>
                <input
                  id="episodeNumber"
                  name="episodeNumber"
                  type="number"
                  className={`form-input ${errors.episodeNumber ? 'error' : ''}`}
                  value={formData.episodeNumber}
                  onChange={handleChange}
                  placeholder="e.g., 1"
                  disabled={loading}
                  min={0}
                />
                {errors.episodeNumber && <div className="error-message">{errors.episodeNumber}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="season">Season</label>
                <input
                  id="season"
                  name="season"
                  type="number"
                  className="form-input"
                  value={formData.season}
                  onChange={handleChange}
                  placeholder="e.g., 1"
                  disabled={loading}
                  min={0}
                />
                <div className="form-hint">Optional</div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="airDate">Air Date</label>
              <input
                id="airDate"
                name="airDate"
                type="date"
                className="form-input"
                value={formData.airDate}
                onChange={handleChange}
                disabled={loading}
              />
              <div className="form-hint">When will this episode be released?</div>
            </div>
          </div>
          )}

          {/* ===== TAB: Discovery & Metadata ===== */}
          {activeTab === 'metadata' && (
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">🔍</span>
                <h2>Discovery & Metadata</h2>
                {progress.sections.discovery.isComplete && (
                  <span style={{ marginLeft: '0.5rem' }}>✓</span>
                )}
              </div>
              <p>Help people find this episode</p>
            </div>

            <div className="form-grid">
              {/* Description */}
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  className="form-input textarea"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="What is this episode about?"
                  disabled={loading}
                  rows={4}
                />
                <div className="form-hint">Brief summary visible in search and listings</div>
              </div>

              {/* Tags */}
              <div className="form-group">
                <label>Categories / Tags</label>
                <TagInput
                  tags={formData.categories}
                  onChange={handleCategoriesChange}
                  placeholder="Add tags (e.g., fashion, tutorial, winter)"
                  disabled={loading}
                  maxTags={10}
                />
                <div className="form-hint">Tags improve searchability and organization</div>
              </div>
            </div>
          </div>
          )}

          {/* ===== TAB: Distribution & Platforms ===== */}
          {activeTab === 'distribution' && (
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">🌐</span>
                <h2>Distribution & Platforms</h2>
                {progress.sections.distribution.isComplete && (
                  <span style={{ marginLeft: '0.5rem' }}>✓</span>
                )}
              </div>
              <p>Where will this episode be published?</p>
            </div>

            {/* Platform Selection */}
            <div className="form-group">
              <label>Target Platforms</label>
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.youtube}
                    onChange={() => handlePlatformChange('youtube')}
                    disabled={loading}
                  />
                  <span>YouTube (Long-form)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.youtubeShorts}
                    onChange={() => handlePlatformChange('youtubeShorts')}
                    disabled={loading}
                  />
                  <span>YouTube Shorts</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.tiktok}
                    onChange={() => handlePlatformChange('tiktok')}
                    disabled={loading}
                  />
                  <span>TikTok</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.instagramReels}
                    onChange={() => handlePlatformChange('instagramReels')}
                    disabled={loading}
                  />
                  <span>Instagram Reels</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.instagramFeed}
                    onChange={() => handlePlatformChange('instagramFeed')}
                    disabled={loading}
                  />
                  <span>Instagram Feed</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.instagramStories}
                    onChange={() => handlePlatformChange('instagramStories')}
                    disabled={loading}
                  />
                  <span>Instagram Stories</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.facebook}
                    onChange={() => handlePlatformChange('facebook')}
                    disabled={loading}
                  />
                  <span>Facebook</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.twitter}
                    onChange={() => handlePlatformChange('twitter')}
                    disabled={loading}
                  />
                  <span>X / Twitter</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={platforms.linkedin}
                    onChange={() => handlePlatformChange('linkedin')}
                    disabled={loading}
                  />
                  <span>LinkedIn</span>
                </label>
                <label className="checkbox-item">
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
                  className="form-input"
                  value={platformsOther}
                  onChange={(e) => setPlatformsOther(e.target.value)}
                  placeholder="Specify other platforms..."
                  disabled={loading}
                  style={{ marginTop: '0.5rem' }}
                />
              )}
              <div className="form-hint" style={{ marginTop: '0.75rem' }}>
                💡 This determines aspect ratios, safe areas, templates, and export presets
              </div>
            </div>

            {/* Content Strategy */}
            {selectedPlatforms.length > 0 && (
              <div className="form-group">
                <label>Content Strategy</label>
                <div className="radio-group">
                  <label className="radio-item">
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
                  <label className="radio-item">
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
                  <label className="radio-item">
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
                <div className="form-hint">
                  Choosing customized options enables platform-specific overrides in the composer
                </div>
              </div>
            )}

            {/* Platform-Specific Descriptions */}
            {showPlatformDescriptions && (
              <div className="form-group">
                <label>Platform-Specific Descriptions (Optional)</label>
                <div className="platform-descriptions">
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
                      <div key={platformKey} className="platform-desc">
                        <h4 className="platform-desc-title">{platformLabels[platformKey]}</h4>
                        <textarea
                          className="form-input textarea"
                          placeholder="Description / caption"
                          value={platformDescriptions[platformKey]?.description || ''}
                          onChange={(e) => handlePlatformDescriptionChange(platformKey, 'description', e.target.value)}
                          disabled={loading}
                          rows={2}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Hashtags (e.g., #fashion #style)"
                          value={platformDescriptions[platformKey]?.hashtags || ''}
                          onChange={(e) => handlePlatformDescriptionChange(platformKey, 'hashtags', e.target.value)}
                          disabled={loading}
                          style={{ marginTop: '0.5rem' }}
                        />
                        <input
                          type="text"
                          className="form-input"
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
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">🎬</span>
                <h2>Content Intent & Format</h2>
                {progress.sections.contentIntent.isComplete && (
                  <span style={{ marginLeft: '0.5rem' }}>✓</span>
                )}
              </div>
              <p>Help us understand the nature of this content</p>
            </div>

            {/* Content Type */}
            <div className="form-group">
              <label>Content Type (Optional)</label>
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={contentTypes.trailer}
                    onChange={() => handleContentTypeChange('trailer')}
                    disabled={loading}
                  />
                  <span>Trailer</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={contentTypes.behindTheScenes}
                    onChange={() => handleContentTypeChange('behindTheScenes')}
                    disabled={loading}
                  />
                  <span>Behind the Scenes</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={contentTypes.announcement}
                    onChange={() => handleContentTypeChange('announcement')}
                    disabled={loading}
                  />
                  <span>Announcement</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={contentTypes.mainShow}
                    onChange={() => handleContentTypeChange('mainShow')}
                    disabled={loading}
                  />
                  <span>Main Show</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={contentTypes.credits}
                    onChange={() => handleContentTypeChange('credits')}
                    disabled={loading}
                  />
                  <span>Credits</span>
                </label>
              </div>
              <div className="form-hint">Informs default pacing and scene templates</div>
            </div>

            {/* Tone */}
            <div className="form-group">
              <label>Tone (Optional)</label>
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={tones.playful}
                    onChange={() => handleToneChange('playful')}
                    disabled={loading}
                  />
                  <span>Playful</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={tones.educational}
                    onChange={() => handleToneChange('educational')}
                    disabled={loading}
                  />
                  <span>Educational</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={tones.inspirational}
                    onChange={() => handleToneChange('inspirational')}
                    disabled={loading}
                  />
                  <span>Inspirational</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={tones.dramatic}
                    onChange={() => handleToneChange('dramatic')}
                    disabled={loading}
                  />
                  <span>Dramatic</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={tones.calm}
                    onChange={() => handleToneChange('calm')}
                    disabled={loading}
                  />
                  <span>Calm</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={tones.highEnergy}
                    onChange={() => handleToneChange('highEnergy')}
                    disabled={loading}
                  />
                  <span>High-energy</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={tones.professional}
                    onChange={() => handleToneChange('professional')}
                    disabled={loading}
                  />
                  <span>Professional</span>
                </label>
              </div>
              <div className="form-hint">Can influence music, caption tone, and pacing</div>
            </div>

            {/* Audience */}
            <div className="form-group">
              <label htmlFor="primaryAudience">Primary Audience (Optional)</label>
              <input
                id="primaryAudience"
                type="text"
                className="form-input"
                value={primaryAudience}
                onChange={(e) => setPrimaryAudience(e.target.value)}
                placeholder="e.g., Fashion enthusiasts, Young professionals"
                disabled={loading}
              />
              <div className="form-hint">Who is this content for?</div>
            </div>
          </div>

          {/* ===== Episode Structure (Optional) ===== */}
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">🏗️</span>
                <h2>Episode Structure (Optional)</h2>
              </div>
              <p>Helps pre-create scene slots and suggest templates</p>
            </div>

            <div className="form-group">
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={structure.hasIntro}
                    onChange={() => handleStructureChange('hasIntro')}
                    disabled={loading}
                  />
                  <span>Has intro</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={structure.hasOutro}
                    onChange={() => handleStructureChange('hasOutro')}
                    disabled={loading}
                  />
                  <span>Has outro</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={structure.hasCTA}
                    onChange={() => handleStructureChange('hasCTA')}
                    disabled={loading}
                  />
                  <span>Has CTA</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={structure.hasRecurringSegment}
                    onChange={() => handleStructureChange('hasRecurringSegment')}
                    disabled={loading}
                  />
                  <span>Has recurring segment</span>
                </label>
                <label className="checkbox-item">
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
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">🎨</span>
                <h2>Visual Requirements (Optional)</h2>
              </div>
              <p>Constraints for the Scene Composer</p>
            </div>

            <div className="form-group">
              <div className="checkbox-grid">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={visualReqs.brandSafeColors}
                    onChange={() => handleVisualReqChange('brandSafeColors')}
                    disabled={loading}
                  />
                  <span>Brand safe colors only</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={visualReqs.mustIncludeLogo}
                    onChange={() => handleVisualReqChange('mustIncludeLogo')}
                    disabled={loading}
                  />
                  <span>Must include logo</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={visualReqs.avoidTextNearEdges}
                    onChange={() => handleVisualReqChange('avoidTextNearEdges')}
                    disabled={loading}
                  />
                  <span>Avoid text near edges (safe areas)</span>
                </label>
              </div>
              <div className="form-hint">These constraints will show warnings in the composer</div>
            </div>
          </div>
          </>
          )}

          {/* ===== TAB: Team & Approvals (Optional) ===== */}
          {activeTab === 'team' && (
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">👥</span>
                <h2>Team & Approvals (Optional)</h2>
              </div>
              <p>Ownership and collaboration</p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="ownerCreator">Owner / Creator</label>
                <input
                  id="ownerCreator"
                  type="text"
                  className="form-input"
                  value={ownerCreator}
                  onChange={(e) => setOwnerCreator(e.target.value)}
                  placeholder="e.g., John Doe"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="collaborators">Collaborators</label>
                <input
                  id="collaborators"
                  type="text"
                  className="form-input"
                  value={collaborators}
                  onChange={(e) => setCollaborators(e.target.value)}
                  placeholder="e.g., Jane Smith, Alice Johnson"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-item">
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
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">🤝</span>
                <h2>Sponsorship & Brand Deals</h2>
              </div>
              <p>Track partnerships and brand integrations</p>
            </div>

            <div className="form-group">
              <label className="checkbox-item">
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
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label htmlFor="sponsorName">Sponsor / Brand Name *</label>
                    <input
                      id="sponsorName"
                      type="text"
                      className="form-input"
                      value={sponsorName}
                      onChange={(e) => setSponsorName(e.target.value)}
                      placeholder="e.g., Nike, Spotify"
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="dealValue">Deal Value / Compensation</label>
                    <input
                      id="dealValue"
                      type="text"
                      className="form-input"
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                      placeholder="e.g., $5,000, Product exchange"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="deliverables">Deliverables *</label>
                  <textarea
                    id="deliverables"
                    className="form-input textarea"
                    value={deliverables}
                    onChange={(e) => setDeliverables(e.target.value)}
                    placeholder="What needs to be delivered? (e.g., 60-second product feature, 2 Instagram stories, brand logo in intro)"
                    disabled={loading}
                    rows={3}
                  />
                  <div className="form-hint">Specify what content you're contractually obligated to create</div>
                </div>

                <div className="form-group">
                  <label htmlFor="integrationRequirements">Integration Requirements</label>
                  <textarea
                    id="integrationRequirements"
                    className="form-input textarea"
                    value={integrationRequirements}
                    onChange={(e) => setIntegrationRequirements(e.target.value)}
                    placeholder="How should the brand be featured? (e.g., Seamless product integration in scene 2, verbal mention in intro, logo placement requirements)"
                    disabled={loading}
                    rows={3}
                  />
                  <div className="form-hint">Details about how to integrate the brand into the episode</div>
                </div>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label htmlFor="dealDeadline">Deadline / Due Date</label>
                    <input
                      id="dealDeadline"
                      type="date"
                      className="form-input"
                      value={dealDeadline}
                      onChange={(e) => setDealDeadline(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="sponsorExpectations">Special Expectations / Notes</label>
                  <textarea
                    id="sponsorExpectations"
                    className="form-input textarea"
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
          <div className="form-section">
            <div className="section-header">
              <div>
                <span className="section-icon">📱</span>
                <h2>Social Media Collaborations</h2>
              </div>
              <p>Coordinate with influencers and partners</p>
            </div>

            <div className="form-group">
              <label className="checkbox-item">
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
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label htmlFor="collabPartners">Collaboration Partners *</label>
                    <input
                      id="collabPartners"
                      type="text"
                      className="form-input"
                      value={collabPartners}
                      onChange={(e) => setCollabPartners(e.target.value)}
                      placeholder="e.g., @fashioninfluencer, @brandname"
                      disabled={loading}
                    />
                    <div className="form-hint">Names or handles of collaborators</div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="collabPlatforms">Platforms</label>
                    <input
                      id="collabPlatforms"
                      type="text"
                      className="form-input"
                      value={collabPlatforms}
                      onChange={(e) => setCollabPlatforms(e.target.value)}
                      placeholder="e.g., Instagram, TikTok, YouTube"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="collabType">Collaboration Type</label>
                  <input
                    id="collabType"
                    type="text"
                    className="form-input"
                    value={collabType}
                    onChange={(e) => setCollabType(e.target.value)}
                    placeholder="e.g., Duet, Shoutout, Guest appearance, Cross-promotion"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="collabDeliverables">Deliverables & Expectations</label>
                  <textarea
                    id="collabDeliverables"
                    className="form-input textarea"
                    value={collabDeliverables}
                    onChange={(e) => setCollabDeliverables(e.target.value)}
                    placeholder="What content will each party create? (e.g., Partner will share our video on their story, we'll tag them in 2 posts)"
                    disabled={loading}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="collabTimeline">Timeline / Post Schedule</label>
                  <textarea
                    id="collabTimeline"
                    className="form-input textarea"
                    value={collabTimeline}
                    onChange={(e) => setCollabTimeline(e.target.value)}
                    placeholder="When will content be posted? (e.g., Day 1: Our video goes live, Day 2: Partner shares story, Day 3: Follow-up post)"
                    disabled={loading}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="collabNotes">Additional Notes</label>
                  <textarea
                    id="collabNotes"
                    className="form-input textarea"
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
          </>
        )}

        {/* ===== TAB: Scene Composer (Outside Form) ===== */}
        {activeTab === 'scenes' && isEditMode && (
          <SceneComposerFull />
        )}

        {/* Sticky Footer */}
        <div className="sticky-footer">
          <div className="footer-content">
            <div className="footer-progress">
              <div className="progress-text">
                <span className="progress-icon">💪</span>
                <span>{progress.percent}% Complete</span>
              </div>
              <div className="progress-hint">
                ✨ You can finish this later — your progress is saved
              </div>
            </div>
            <div className="footer-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => navigate('/episodes')}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-episode-form"
                className="btn-submit btn-large"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Update Episode' : 'Create Episode'
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
