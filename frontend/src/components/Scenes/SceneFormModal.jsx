import React, { useState, useEffect } from 'react';
import './SceneFormModal.css';

const SceneFormModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  scene = null, 
  episodeId,
  loading = false 
}) => {
  const [formData, setFormData] = useState({
    episodeId: episodeId || '',
    title: '',
    description: '',
    sceneType: 'main',
    location: '',
    mood: 'neutral',
    startTimecode: '',
    endTimecode: '',
    durationSeconds: '',
    productionStatus: 'draft',
    scriptNotes: '',
    characters: []
  });

  const [characterInput, setCharacterInput] = useState('');
  const [errors, setErrors] = useState({});

  // Pre-fill form when editing
  useEffect(() => {
    if (scene) {
      setFormData({
        episodeId: scene.episodeId || episodeId,
        title: scene.title || '',
        description: scene.description || '',
        sceneType: scene.sceneType || 'main',
        location: scene.location || '',
        mood: scene.mood || 'neutral',
        startTimecode: scene.startTimecode || '',
        endTimecode: scene.endTimecode || '',
        durationSeconds: scene.durationSeconds || '',
        productionStatus: scene.productionStatus || 'draft',
        scriptNotes: scene.scriptNotes || '',
        characters: scene.characters || []
      });
    }
  }, [scene, episodeId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAddCharacter = () => {
    if (characterInput.trim() && !formData.characters.includes(characterInput.trim())) {
      setFormData(prev => ({
        ...prev,
        characters: [...prev.characters, characterInput.trim()]
      }));
      setCharacterInput('');
    }
  };

  const handleRemoveCharacter = (character) => {
    setFormData(prev => ({
      ...prev,
      characters: prev.characters.filter(c => c !== character)
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.episodeId) {
      newErrors.episodeId = 'Episode ID is required';
    }

    // Timecode validation (HH:MM:SS or HH:MM:SS:FF)
    const timecodeRegex = /^([0-9]{2}:){2}[0-9]{2}(:[0-9]{2})?$/;
    if (formData.startTimecode && !timecodeRegex.test(formData.startTimecode)) {
      newErrors.startTimecode = 'Invalid format (use HH:MM:SS or HH:MM:SS:FF)';
    }
    if (formData.endTimecode && !timecodeRegex.test(formData.endTimecode)) {
      newErrors.endTimecode = 'Invalid format (use HH:MM:SS or HH:MM:SS:FF)';
    }

    // Duration validation
    if (formData.durationSeconds && (isNaN(formData.durationSeconds) || formData.durationSeconds < 0)) {
      newErrors.durationSeconds = 'Duration must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    // Clean up data before submission
    const cleanData = {
      ...formData,
      durationSeconds: formData.durationSeconds ? parseInt(formData.durationSeconds) : null,
      startTimecode: formData.startTimecode || null,
      endTimecode: formData.endTimecode || null,
      location: formData.location || null,
      scriptNotes: formData.scriptNotes || null
    };

    onSubmit(cleanData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{scene ? 'Edit Scene' : 'Create New Scene'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="scene-form">
          {/* Title (Required) */}
          <div className="form-group">
            <label htmlFor="title">
              Scene Title <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={errors.title ? 'error' : ''}
              placeholder="Enter scene title..."
              maxLength={255}
            />
            {errors.title && <span className="error-message">{errors.title}</span>}
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what happens in this scene..."
              rows={4}
            />
          </div>

          {/* Scene Type & Mood */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sceneType">Scene Type</label>
              <select
                id="sceneType"
                name="sceneType"
                value={formData.sceneType}
                onChange={handleChange}
              >
                <option value="intro">🎬 Intro</option>
                <option value="main">📽️ Main Content</option>
                <option value="transition">🔄 Transition</option>
                <option value="outro">👋 Outro</option>
                <option value="montage">🎞️ Montage</option>
                <option value="broll">📹 B-Roll</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="mood">Mood</label>
              <select
                id="mood"
                name="mood"
                value={formData.mood}
                onChange={handleChange}
              >
                <option value="upbeat">😊 Upbeat</option>
                <option value="serious">😐 Serious</option>
                <option value="comedic">😄 Comedic</option>
                <option value="dramatic">😱 Dramatic</option>
                <option value="suspenseful">😰 Suspenseful</option>
                <option value="neutral">😶 Neutral</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Studio A, Office, Park"
            />
          </div>

          {/* Timecodes */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startTimecode">
                Start Timecode
                <span className="hint">(HH:MM:SS:FF)</span>
              </label>
              <input
                type="text"
                id="startTimecode"
                name="startTimecode"
                value={formData.startTimecode}
                onChange={handleChange}
                placeholder="00:00:00:00"
                className={errors.startTimecode ? 'error' : ''}
              />
              {errors.startTimecode && <span className="error-message">{errors.startTimecode}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="endTimecode">
                End Timecode
                <span className="hint">(HH:MM:SS:FF)</span>
              </label>
              <input
                type="text"
                id="endTimecode"
                name="endTimecode"
                value={formData.endTimecode}
                onChange={handleChange}
                placeholder="00:00:00:00"
                className={errors.endTimecode ? 'error' : ''}
              />
              {errors.endTimecode && <span className="error-message">{errors.endTimecode}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="durationSeconds">
                Duration (seconds)
              </label>
              <input
                type="number"
                id="durationSeconds"
                name="durationSeconds"
                value={formData.durationSeconds}
                onChange={handleChange}
                placeholder="120"
                min="0"
                className={errors.durationSeconds ? 'error' : ''}
              />
              {errors.durationSeconds && <span className="error-message">{errors.durationSeconds}</span>}
            </div>
          </div>

          {/* Characters */}
          <div className="form-group">
            <label>Characters</label>
            <div className="character-input-group">
              <input
                type="text"
                value={characterInput}
                onChange={(e) => setCharacterInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCharacter())}
                placeholder="Add character name..."
              />
              <button 
                type="button" 
                onClick={handleAddCharacter}
                className="add-character-btn"
              >
                Add
              </button>
            </div>
            {formData.characters.length > 0 && (
              <div className="character-tags">
                {formData.characters.map(char => (
                  <span key={char} className="character-tag">
                    {char}
                    <button
                      type="button"
                      onClick={() => handleRemoveCharacter(char)}
                      className="remove-char-btn"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Production Status */}
          <div className="form-group">
            <label htmlFor="productionStatus">Production Status</label>
            <select
              id="productionStatus"
              name="productionStatus"
              value={formData.productionStatus}
              onChange={handleChange}
            >
              <option value="draft">Draft</option>
              <option value="storyboarded">Storyboarded</option>
              <option value="recorded">Recorded</option>
              <option value="edited">Edited</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          {/* Script Notes */}
          <div className="form-group">
            <label htmlFor="scriptNotes">Script Notes</label>
            <textarea
              id="scriptNotes"
              name="scriptNotes"
              value={formData.scriptNotes}
              onChange={handleChange}
              placeholder="Additional notes, directions, or technical requirements..."
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button 
              type="button" 
              onClick={onClose} 
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : (scene ? 'Update Scene' : 'Create Scene')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SceneFormModal;
