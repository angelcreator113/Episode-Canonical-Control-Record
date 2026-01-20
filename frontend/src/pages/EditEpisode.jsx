/**
 * Edit Episode Page - Tabbed + Calm UI
 * Shared styling with CreateEpisode via EpisodeForm.css (scoped)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ToastContainer';
import episodeService from '../services/episodeService';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { validators } from '../utils/validators';
import { STATUS_OPTIONS } from '../utils/constants';
import '../styles/EpisodeForm.css';


const EditEpisode = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('basics');

  const [formData, setFormData] = useState({
    title: '',
    episodeNumber: '',
    status: 'draft',
    description: '',
    airDate: '',
    categories: [],
    categoryInput: '',
    showId: '',
  });

  const [shows, setShows] = useState([]);
  const [loadingShows, setLoadingShows] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({});

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

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      window.location.href = '/login';
      return;
    }

    if (!episodeId) {
      setError('Invalid episode ID');
      setTimeout(() => navigate('/episodes', { replace: true }), 1000);
      return;
    }

    const fetchEpisode = async () => {
      try {
        setLoading(true);
        const episode = await episodeService.getEpisode(episodeId);

        const newFormData = {
          title: episode.title || '',
          episodeNumber: episode.episode_number || '',
          status: episode.status || 'draft',
          description: episode.description || '',
          airDate: episode.air_date ? episode.air_date.split('T')[0] : '',
          categories: Array.isArray(episode.categories) ? episode.categories : [],
          categoryInput: '',
          showId: episode.show_id || '',
        };

        setFormData(newFormData);
      } catch (err) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to load episode';
        setError(errorMessage);
        toast.showError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchEpisode();
  }, [episodeId, isAuthenticated, authLoading, navigate, toast]);

  const validateForm = () => {
    const newErrors = {};

    const titleError = validators.required(formData.title, 'Title');
    if (titleError) newErrors.title = titleError;

    const numberError = validators.episodeNumber(formData.episodeNumber);
    if (numberError) newErrors.episodeNumber = numberError;

    const airDateError = validators.airDate(formData.airDate);
    if (airDateError) newErrors.airDate = airDateError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'title':
        return validators.required(value, 'Title');
      case 'episodeNumber':
        return validators.episodeNumber(value);
      case 'airDate':
        return validators.airDate(value);
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      const fieldError = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: fieldError }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const fieldError = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: fieldError }));
  };

  const handleAddCategory = () => {
    const trimmed = formData.categoryInput.trim();
    if (!trimmed) return;

    if (formData.categories.includes(trimmed)) {
      toast.showWarning('This category already exists');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      categories: [...prev.categories, trimmed],
      categoryInput: '',
    }));
  };

  const handleRemoveCategory = (index) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
    }));
  };

  const handleCategoryKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  };

  const checklist = useMemo(() => {
    const items = [
      { label: 'Title', done: !!formData.title?.trim() },
      { label: 'Episode #', done: !!String(formData.episodeNumber || '').trim() },
      { label: 'Status', done: !!formData.status },
      { label: 'Air date (optional)', done: true },
      { label: 'Description (optional)', done: true },
      { label: 'Tags (optional)', done: true },
    ];
    const doneCount = items.filter((i) => i.done).length;
    return { items, doneCount, total: items.length };
  }, [formData.title, formData.episodeNumber, formData.status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      toast.showError('Please fix the errors in the form');
      setActiveTab('basics');
      return;
    }

    try {
      setSubmitting(true);
      const submitData = {
        title: formData.title,
        episode_number: formData.episodeNumber,
        status: formData.status,
        description: formData.description,
        air_date: formData.airDate,
        categories: formData.categories,
        show_id: formData.showId || null,
      };

      await episodeService.updateEpisode(episodeId, submitData);
      toast.showSuccess('Episode updated successfully!');

      setTimeout(() => navigate(`/episodes/${episodeId}`), 500);
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || err.message || 'Failed to update episode';
      setError(errorMessage);
      toast.showError(errorMessage);
    } finally {
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
              <button
                onClick={() => navigate('/episodes')}
                className="ce-btn ce-btn--secondary"
              >
                Back to Episodes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const episodeName = formData.title?.trim() || 'Untitled episode';

  return (
    <div className="episode-form-page ce-page">
      {/* Header */}
      <div className="ce-header">
        <div className="ce-header__inner">
          <button className="ce-link" onClick={() => navigate(`/episodes/${episodeId}`)}>
            ← Back
          </button>

          <div className="ce-header__title">
            <h1>Edit Episode</h1>
            <div className="ce-subline">
              <span className="ce-pill">{episodeName}</span>
              <span className="ce-dot">•</span>
              <span className="ce-mutedSm">
                Episode {formData.episodeNumber || '—'}
              </span>
              <span className="ce-dot">•</span>
              <span className="ce-pill ce-pill--soft">
                {String(formData.status || 'draft').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="ce-header__actions">
            <button
              type="button"
              className="ce-btn ce-btn--secondary"
              onClick={() => navigate(`/episodes/${episodeId}`)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ce-btn ce-btn--primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ce-tabs">
        <div className="ce-tabs__inner">
          <button
            className={`ce-tab ${activeTab === 'basics' ? 'active' : ''}`}
            onClick={() => setActiveTab('basics')}
            type="button"
          >
            Basics
          </button>
          <button
            className={`ce-tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
            type="button"
          >
            Content
          </button>
          <button
            className={`ce-tab ${activeTab === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveTab('tags')}
            type="button"
          >
            Tags
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="ce-body">
          {/* Main */}
          <div className="ce-card">
            {error && (
              <div className="ce-alert">
                <ErrorMessage message={error} onDismiss={() => setError(null)} />
              </div>
            )}

            {activeTab === 'basics' && (
              <div className="ce-grid">
                <div className="ce-grid ce-grid--2">
                  <div className="ce-field">
                    <label htmlFor="title">
                      Title <span className="ce-required">*</span>
                    </label>
                    <input
                      className={`ce-input ${errors.title ? 'ce-input--error' : ''}`}
                      type="text"
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Enter episode title"
                      disabled={submitting}
                    />
                    {errors.title && <div className="ce-error">{errors.title}</div>}
                  </div>

                  <div className="ce-field">
                    <label htmlFor="episodeNumber">
                      Episode Number <span className="ce-required">*</span>
                    </label>
                    <input
                      className={`ce-input ${
                        errors.episodeNumber ? 'ce-input--error' : ''
                      }`}
                      type="number"
                      id="episodeNumber"
                      name="episodeNumber"
                      value={formData.episodeNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g., 1"
                      disabled={submitting}
                    />
                    {errors.episodeNumber && (
                      <div className="ce-error">{errors.episodeNumber}</div>
                    )}
                  </div>
                </div>

                <div className="ce-grid ce-grid--2">
                  <div className="ce-field">
                    <label htmlFor="status">Status</label>
                    <select
                      className="ce-input"
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      disabled={submitting}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ce-field">
                    <label htmlFor="airDate">Air Date</label>
                    <input
                      className={`ce-input ${errors.airDate ? 'ce-input--error' : ''}`}
                      type="date"
                      id="airDate"
                      name="airDate"
                      value={formData.airDate}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      disabled={submitting}
                    />
                    {errors.airDate && <div className="ce-error">{errors.airDate}</div>}
                  </div>
                </div>

                {/* Show Selection */}
                <div className="ce-field">
                  <label htmlFor="showId">Show</label>
                  <select
                    className="ce-input"
                    id="showId"
                    name="showId"
                    value={formData.showId}
                    onChange={handleChange}
                    disabled={submitting || loadingShows}
                  >
                    <option value="">No Show / Standalone Episode</option>
                    {shows.map((show) => (
                      <option key={show.id} value={show.id}>
                        {show.icon || '📺'} {show.name}
                      </option>
                    ))}
                  </select>
                  <div className="ce-hint">Assign this episode to a show series.</div>
                </div>
              </div>
            )}

            {activeTab === 'content' && (
              <div className="ce-grid">
                <div className="ce-field">
                  <label htmlFor="description">Description</label>
                  <textarea
                    className="ce-input ce-textarea"
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter episode description"
                    rows={8}
                    disabled={submitting}
                  />
                  <div className="ce-hint">
                    Keep it short: what happens, key outfits, key products, key moments.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tags' && (
              <div className="ce-grid">
                <div className="ce-field">
                  <label htmlFor="categoryInput">Categories / Tags</label>

                  <div className="ce-tagRow">
                    <input
                      className="ce-input"
                      type="text"
                      id="categoryInput"
                      name="categoryInput"
                      value={formData.categoryInput}
                      onChange={handleChange}
                      onKeyPress={handleCategoryKeyPress}
                      placeholder="Type a tag and press Enter"
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="ce-btn ce-btn--secondary ce-btn--sm"
                      disabled={!formData.categoryInput.trim() || submitting}
                    >
                      Add
                    </button>
                  </div>

                  {formData.categories.length > 0 ? (
                    <div className="ce-tags">
                      {formData.categories.map((category, index) => (
                        <span key={index} className="ce-tag">
                          {category}
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(index)}
                            className="ce-tagX"
                            title="Remove tag"
                            disabled={submitting}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="ce-emptySmall">No tags yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* bottom actions (mobile-friendly) */}
            <div className="ce-footerActions">
              <button
                type="button"
                className="ce-btn ce-btn--secondary"
                onClick={() => navigate(`/episodes/${episodeId}`)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ce-btn ce-btn--primary"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="ce-card ce-side">
            <div className="ce-sideTitle">Checklist</div>
            <div className="ce-progress">
              <div className="ce-progressTop">
                <span className="ce-mutedSm">Complete</span>
                <span className="ce-pill">
                  {checklist.doneCount}/{checklist.total}
                </span>
              </div>
              <div className="ce-progressBar">
                <div
                  className="ce-progressFill"
                  style={{
                    width: `${Math.round((checklist.doneCount / checklist.total) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="ce-checklist">
              {checklist.items.map((item, idx) => (
                <div key={idx} className="ce-checkItem">
                  <span className={`ce-checkDot ${item.done ? 'done' : ''}`} />
                  <span className="ce-checkLabel">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="ce-sideHint">
              Tip: if you get lost, click tabs at the top. Keep "Basics" short and correct.
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditEpisode;
