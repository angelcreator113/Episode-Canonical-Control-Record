/**
 * Create Episode Page - Upgraded
 * Mobile/tablet/desktop friendly, minimal + polished
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
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

const CreateEpisode = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState({
    title: '',
    episodeNumber: '',
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
  const [loading, setLoading] = useState(false);

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
        const response = await fetch('http://localhost:3002/api/v1/shows', {
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
    const checks = {
      title: Boolean(formData.title?.trim()),
      status: Boolean(formData.status),
      description: Boolean(formData.description?.trim()),
      tags: (formData.categories?.length || 0) > 0,
      thumbnail: Boolean(thumbnailPreview || thumbnailId || thumbnailFile),
    };
    const done = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;
    return {
      checks,
      percent: Math.round((done / total) * 100),
      done,
      total,
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

  const handleCategoriesChange = (categories) => {
    setFormData((prev) => ({ ...prev, categories }));
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type?.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, thumbnail: 'Please select an image file' }));
      toast.showError('Please select an image file');
      return;
    }

    // Validate size
    if (file.size > MAX_THUMB_BYTES) {
      setErrors((prev) => ({ ...prev, thumbnail: `Image must be less than ${MAX_THUMB_MB}MB` }));
      toast.showError(`Image must be less than ${MAX_THUMB_MB}MB`);
      return;
    }

    setThumbnailFile(file);
    setThumbnailId(null);
    setErrors((prev) => ({ ...prev, thumbnail: null }));

    const reader = new FileReader();
    reader.onloadend = () => setThumbnailPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleThumbnailSelect = async (selectedThumbnailId) => {
    try {
      setThumbnailId(selectedThumbnailId);
      setThumbnailFile(null);

      const thumb = await thumbnailService.getThumbnail(selectedThumbnailId);
      setThumbnailPreview(thumb?.url || thumb?.s3Url || null);

      setErrors((prev) => ({ ...prev, thumbnail: null }));
    } catch (err) {
      console.error('Failed to load thumbnail:', err);
      toast.showError('Failed to load thumbnail');
    }
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setThumbnailId(null);

    const fileInput = document.getElementById('thumbnailFile');
    if (fileInput) fileInput.value = '';
  };

  const validate = () => {
    const next = {};
    if (!formData.title?.trim()) next.title = 'Title is required';

    // Optionally validate episode number if present (must be positive int)
    if (formData.episodeNumber !== '' && Number(formData.episodeNumber) < 0) {
      next.episodeNumber = 'Episode number must be 0 or greater';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.showError('Please fix the highlighted fields');
      return false;
    }
    return true;
  };

  const uploadThumbnailIfNeeded = async (episodeId) => {
    if (!thumbnailFile) return;

    const formDataToSend = new FormData();
    formDataToSend.append('file', thumbnailFile);
    formDataToSend.append('episodeId', episodeId);
    formDataToSend.append('type', 'thumbnail');

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      await fetch('http://localhost:3002/api/v1/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });
    } catch (uploadErr) {
      console.warn('Thumbnail upload failed:', uploadErr);
      // Don’t block create; just inform softly.
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
        status: formData.status,
        description: formData.description,
        air_date: formData.airDate || null,
        categories: formData.categories,
        thumbnail_id: thumbnailId || null,
        show_id: formData.showId || null,
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
          <div className="ce-header__actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="ce-btn ce-btn--secondary"
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
              title={loading ? 'Creating…' : 'Create episode'}
            >
              {loading ? 'Creating…' : 'Create Episode'}
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
              Tip: you can create with just a <strong>Title</strong>. Everything else can be added later.
            </div>
          )}
        </div>

        <div className="ce-body ce-body--single" style={{ paddingTop: 0 }}>
          <div className="ce-card">
            <form id="create-episode-form" onSubmit={handleSubmit} className="ce-grid">
              {/* Title */}
              <div className="ce-field">
                <label htmlFor="title">
                  Title <span className="ce-required">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  className={`ce-input ${errors.title ? 'ce-input--error' : ''}`}
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter episode title"
                  disabled={loading}
                  required
                />
                {errors.title && <div className="ce-error">{errors.title}</div>}
                <div className="ce-hint">Make it searchable and clear (e.g., “Winter Lookbook: Ep 1”).</div>
              </div>

              {/* Row: Episode # + Status */}
              <div className="ce-grid ce-grid--2">
                <div className="ce-field">
                  <label htmlFor="episodeNumber">Episode Number (Optional)</label>
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
              </div>

              {/* Show Selection */}
              <div className="ce-field">
                <label htmlFor="showId">Show (Optional)</label>
                <select
                  id="showId"
                  name="showId"
                  className="ce-input"
                  value={formData.showId}
                  onChange={handleChange}
                  disabled={loading || loadingShows}
                >
                  <option value="">No Show / Standalone Episode</option>
                  {shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.icon || '📺'} {show.name}
                    </option>
                  ))}
                </select>
                <div className="ce-hint">Assign this episode to a show series for better organization.</div>
              </div>

              {/* Description */}
              <div className="ce-field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  className="ce-input ce-textarea"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter a description..."
                  disabled={loading}
                  rows={3}
                />
                <div className="ce-hint">Brief summary of the episode content.</div>
              </div>

              {/* Air Date */}
              <div className="ce-field">
                <label htmlFor="airDate">Air Date (Optional)</label>
                <input
                  id="airDate"
                  name="airDate"
                  type="date"
                  className="ce-input"
                  value={formData.airDate}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
                    className="ce-input"
                    value={formData.status}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Air Date */}
              <div className="ce-field">
                <label htmlFor="airDate">Air Date (Optional)</label>
                <input
                  id="airDate"
                  name="airDate"
                  type="date"
                  className="ce-input"
                  value={formData.airDate}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>

              {/* Description */}
              <div className="ce-field">
                <label htmlFor="description">Description (Optional)</label>
                <textarea
                  id="description"
                  name="description"
                  className="ce-input ce-textarea"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter episode description"
                  rows={5}
                  disabled={loading}
                />
              </div>

              {/* Tags */}
              <div className="ce-field">
                <label>Categories / Tags</label>
                <TagInput
                  tags={formData.categories}
                  onChange={handleCategoriesChange}
                  placeholder="Add categories (e.g., fashion, tutorial)"
                  disabled={loading}
                  maxTags={10}
                />
                <div className="ce-hint">Tags help with organization + search.</div>
              </div>

              {/* Thumbnail */}
              <div className="ce-field">
                <label htmlFor="thumbnailFile">Thumbnail Image</label>

                <div className="ce-thumbActions">
                  <button
                    type="button"
                    className="ce-btn ce-btn--primary"
                    onClick={() => setShowAssetPicker(true)}
                    disabled={loading}
                    title="Choose from gallery"
                  >
                    📁 Choose from Gallery
                  </button>

                  <label
                    className="ce-btn ce-btn--secondary"
                    htmlFor="thumbnailFile"
                    style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                    title="Upload new thumbnail"
                  >
                    ⬆️ Upload New
                  </label>

                  <input
                    type="file"
                    id="thumbnailFile"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    disabled={loading}
                    className="ce-thumbFileInput"
                  />
                </div>

                {errors.thumbnail && <div className="ce-error">{errors.thumbnail}</div>}

                {thumbnailPreview ? (
                  <div className="ce-thumbPreview">
                    <img src={thumbnailPreview} alt="Thumbnail preview" />
                    <div className="ce-thumbPreviewBar">
                      <button
                        type="button"
                        className="ce-btn ce-btn--secondary ce-btn--sm"
                        onClick={() => window.open('/composer/default', '_blank')}
                        disabled={loading}
                      >
                        Open Composer
                      </button>
                      <button
                        type="button"
                        className="ce-btn ce-btn--danger ce-btn--sm"
                        onClick={handleRemoveThumbnail}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ce-thumbEmpty">
                    <div className="ce-mutedSm">No thumbnail selected.</div>
                    <button
                      type="button"
                      className="ce-btn ce-btn--secondary ce-btn--sm"
                      onClick={() => window.open('/composer/default', '_blank')}
                      disabled={loading}
                    >
                      Use Thumbnail Composer
                    </button>
                  </div>
                )}

                <div className="ce-hint">
                  Upload an image file (JPG/PNG/etc.) — max {MAX_THUMB_MB}MB.
                </div>
              </div>

              {/* MOBILE FOOTER ACTIONS */}
              <div className="ce-footerActions">
                <button
                  type="button"
                  className="ce-btn ce-btn--secondary"
                  onClick={() => navigate('/episodes')}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ce-btn ce-btn--primary"
                  disabled={loading}
                >
                  {loading ? 'Creating…' : 'Create Episode'}
                </button>
              </div>
            </form>
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

export default CreateEpisode;
