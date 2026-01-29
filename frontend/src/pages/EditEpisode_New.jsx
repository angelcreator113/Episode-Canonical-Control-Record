/**
 * Edit Episode Page - UPGRADED
 * Sectioned, hierarchical, forgiving, confidence-building
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import { API_URL } from '../config/api';
import episodeService from '../services/episodeService';
import thumbnailService from '../services/thumbnailService';
import AssetPicker from '../components/Scenes/AssetPicker';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import TagInput from '../components/TagInput';
import { STATUS_OPTIONS } from '../utils/constants';
import '../styles/EpisodeForm.css';

const MAX_THUMB_MB = 5;
const MAX_THUMB_BYTES = MAX_THUMB_MB * 1024 * 1024;

const EditEpisode = () => {
  const { episodeId } = useParams();
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

  const [shows, setShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailId, setThumbnailId] = useState(null);

  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  // Load episode data
  useEffect(() => {
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
          season: episode.season || '',
          status: episode.status || 'draft',
          description: episode.description || '',
          airDate: episode.air_date ? episode.air_date.split('T')[0] : '',
          categories: Array.isArray(episode.categories) ? episode.categories : [],
          showId: episode.show_id || '',
        });

        // Set existing thumbnail
        if (episode.thumbnail_url) {
          setThumbnailPreview(episode.thumbnail_url);
          setThumbnailId(episode.thumbnail_id || null);
        }
      } catch (err) {
        const errorMessage = err?.response?.data?.error || err?.message || 'Failed to load episode';
        setError(errorMessage);
        toast.showError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchEpisode();
  }, [episodeId, navigate, toast]);

  const progress = useMemo(() => {
    const sections = {
      essential: {
        title: Boolean(formData.title?.trim()),
        show: Boolean(formData.showId),
      },
      scheduling: {
        status: Boolean(formData.status),
        airDate: Boolean(formData.airDate),
      },
      discovery: {
        description: Boolean(formData.description?.trim()),
        tags: (formData.categories?.length || 0) > 0,
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
  }, [formData, thumbnailPreview, thumbnailId, thumbnailFile]);

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

  const handleThumbnailSelect = async (asset) => {
    if (!asset?.id) return;
    setThumbnailId(asset.id);
    setThumbnailPreview(asset.thumbnail_url || asset.url || null);
    setShowAssetPicker(false);
    clearFieldError('thumbnail');
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setThumbnailId(null);
    const fileInput = document.getElementById('thumbnailFile');
    if (fileInput) fileInput.value = '';
  };

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

  const uploadThumbnailIfNeeded = async () => {
    if (!thumbnailFile) return;
    try {
      await thumbnailService.uploadThumbnail(episodeId, thumbnailFile);
    } catch (err) {
      console.error('Failed to upload thumbnail:', err);
      toast.showError('Episode updated, but thumbnail upload failed.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    try {
      setSubmitting(true);

      await episodeService.updateEpisode(episodeId, {
        title: formData.title.trim(),
        episode_number: formData.episodeNumber !== '' ? Number(formData.episodeNumber) : null,
        season: formData.season !== '' ? Number(formData.season) : null,
        status: formData.status,
        description: formData.description,
        air_date: formData.airDate || null,
        categories: formData.categories,
        thumbnail_id: thumbnailId || null,
        show_id: formData.showId || null,
      });

      await uploadThumbnailIfNeeded();

      toast.showSuccess('Episode updated successfully!');
      navigate(`/episodes/${episodeId}`);
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to update episode';
      setError(errorMessage);
      toast.showError(errorMessage);
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <LoadingSpinner />;

  if (error && !formData.title) {
    return (
      <div className="episode-form-page ce-page">
        <div className="ce-body ce-body--single">
          <div className="ce-card">
            <ErrorMessage message={error} />
            <div style={{ marginTop: 12 }}>
              <button onClick={() => navigate('/episodes')} className="ce-btn ce-btn--secondary">
                Back to Episodes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const episodeName = formData.title?.trim() || 'Untitled Episode';

  return (
    <div className="episode-form-page ce-page">
      {/* HEADER */}
      <div className="ce-header">
        <div className="ce-header__inner">
          <button
            type="button"
            className="ce-link"
            onClick={() => navigate(`/episodes/${episodeId}`)}
            disabled={submitting}
          >
            ← Back
          </button>

          <div className="ce-header__title">
            <h1>Edit Episode</h1>
            <div className="ce-subline">
              <span className="ce-pill">{episodeName}</span>
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
              onClick={() => navigate(`/episodes/${episodeId}`)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-episode-form"
              className="ce-btn ce-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="ce-body ce-body--single">
        <div className="ce-card ce-alert">
          {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
          {!error && (
            <div className="ce-mutedSm">
              💡 Tip: All changes are saved when you click "Save Changes". You can always come back later.
            </div>
          )}
        </div>

        <form id="edit-episode-form" onSubmit={handleSubmit} className="ce-formWrapper">
          
          {/* ===== SECTION: Essential Information ===== */}
          <div className="ce-card ce-section">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">✨</span>
                <h2>Essential Information</h2>
                {progress.sections.essential.isComplete && (
                  <span className="ce-checkmark">✓</span>
                )}
              </div>
              <div className="ce-sectionDesc">Core episode details</div>
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
                  disabled={submitting}
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
                  disabled={submitting || loadingShows}
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

          {/* ===== SECTION: Scheduling & Publishing ===== */}
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
                  disabled={submitting}
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
                  disabled={submitting}
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
                  disabled={submitting}
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
                disabled={submitting}
              />
              <div className="ce-hint">When will this episode be released?</div>
            </div>
          </div>

          {/* ===== SECTION: Discovery & Metadata ===== */}
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
                  disabled={submitting}
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
                  disabled={submitting}
                  maxTags={10}
                />
                <div className="ce-hint">Tags improve searchability and organization</div>
              </div>
            </div>
          </div>

          {/* ===== SECTION: Creative Workflow (Thumbnail) ===== */}
          <div className="ce-card ce-section ce-section--creative">
            <div className="ce-sectionHeader">
              <div className="ce-sectionTitle">
                <span className="ce-sectionIcon">🎨</span>
                <h2>Thumbnail</h2>
                {progress.sections.creative.isComplete && (
                  <span className="ce-checkmark">✓</span>
                )}
              </div>
              <div className="ce-sectionDesc">Create an eye-catching cover</div>
            </div>

            {thumbnailPreview ? (
              <div className="ce-thumbnailPreviewCard">
                <img src={thumbnailPreview} alt="Thumbnail preview" className="ce-thumbnailPreviewImage" />
                <div className="ce-thumbnailActions">
                  <button
                    type="button"
                    className="ce-btn ce-btn--secondary"
                    onClick={() => navigate(`/composer/default?episodeId=${episodeId}`)}
                    disabled={submitting}
                  >
                    🎨 Edit in Composer
                  </button>
                  <button
                    type="button"
                    className="ce-btn ce-btn--ghost"
                    onClick={handleRemoveThumbnail}
                    disabled={submitting}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="ce-thumbnailEmpty">
                <div className="ce-thumbnailEmptyIcon">🖼️</div>
                <div className="ce-thumbnailEmptyText">No thumbnail yet</div>
                <div className="ce-thumbnailEmptyHint">
                  Create a professional thumbnail using our template-based composer
                </div>
                <div className="ce-thumbnailEmptyActions">
                  <button
                    type="button"
                    className="ce-btn ce-btn--primary ce-btn--large"
                    onClick={() => navigate(`/composer/default?episodeId=${episodeId}`)}
                    disabled={submitting}
                  >
                    🎨 Create with Thumbnail Composer
                  </button>
                  <div className="ce-orDivider">
                    <span>or</span>
                  </div>
                  <div className="ce-quickOptions">
                    <button
                      type="button"
                      className="ce-btn ce-btn--ghost"
                      onClick={() => setShowAssetPicker(true)}
                      disabled={submitting}
                    >
                      📁 Choose from Gallery
                    </button>
                    <label className="ce-btn ce-btn--ghost" htmlFor="thumbnailFile">
                      ⬆️ Upload Image
                    </label>
                    <input
                      type="file"
                      id="thumbnailFile"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      disabled={submitting}
                      className="ce-thumbFileInput"
                    />
                  </div>
                </div>
              </div>
            )}

            {errors.thumbnail && <div className="ce-error">{errors.thumbnail}</div>}
            <div className="ce-hint" style={{ marginTop: '1rem' }}>
              Recommended: 1920x1080px (16:9) — Max {MAX_THUMB_MB}MB
            </div>
          </div>

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
                ✨ All changes saved when you click "Save Changes"
              </div>
            </div>
            <div className="ce-footerActions">
              <button
                type="button"
                className="ce-btn ce-btn--ghost"
                onClick={() => navigate(`/episodes/${episodeId}`)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-episode-form"
                className="ce-btn ce-btn--primary ce-btn--large"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="ce-spinner"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Picker Modal */}
      <AssetPicker
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        onSelect={handleThumbnailSelect}
        multiSelect={false}
        selectedIds={[]}
        allowUpload={true}
      />
    </div>
  );
};

export default EditEpisode;
