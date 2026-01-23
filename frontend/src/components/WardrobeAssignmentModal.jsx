/**
 * Wardrobe Assignment Modal
 * Assign wardrobe item to an episode
 */

import React, { useState, useEffect } from 'react';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import './WardrobeAssignmentModal.css';

const WardrobeAssignmentModal = ({ item, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [scenes, setScenes] = useState([]);
  
  const [formData, setFormData] = useState({
    episode_id: '',
    scene_id: '',
    character: item.character || '',
    occasion: item.occasion || '',
    season: item.season || '',
    notes: ''
  });
  
  useEffect(() => {
    loadEpisodes();
  }, []);
  
  useEffect(() => {
    if (formData.episode_id) {
      loadScenes(formData.episode_id);
    } else {
      setScenes([]);
    }
  }, [formData.episode_id]);
  
  const loadEpisodes = async () => {
    try {
      const response = await fetch(`${API_URL}/episodes`);
      if (response.ok) {
        const data = await response.json();
        setEpisodes(data.data || []);
      }
    } catch (err) {
      console.error('Error loading episodes:', err);
    }
  };
  
  const loadScenes = async (episodeId) => {
    try {
      const response = await fetch(`${API_URL}/episodes/${episodeId}/scenes`);
      if (response.ok) {
        const data = await response.json();
        setScenes(data.data || []);
      }
    } catch (err) {
      console.error('Error loading scenes:', err);
      setScenes([]);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.episode_id) {
      setError('Please select an episode');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const assignmentData = {
        episode_id: formData.episode_id,
        ...(formData.scene_id && { scene_id: formData.scene_id }),
        ...(formData.character && { character: formData.character }),
        ...(formData.occasion && { occasion: formData.occasion }),
        ...(formData.season && { season: formData.season }),
        ...(formData.notes && { notes: formData.notes })
      };
      
      await wardrobeLibraryService.assignToEpisode(item.id, assignmentData);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Error assigning item:', err);
      setError(err.message || 'Failed to assign item');
      setLoading(false);
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="assignment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Assign to Episode</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <div className="item-preview">
              <img 
                src={item.image_url || '/placeholder-wardrobe.png'} 
                alt={item.name}
              />
              <div className="preview-info">
                <h3>{item.name}</h3>
                {item.item_type && <span className="item-type">{item.item_type}</span>}
              </div>
            </div>
            
            <div className="form-group">
              <label>Episode *</label>
              <select 
                name="episode_id"
                value={formData.episode_id}
                onChange={handleInputChange}
                required
              >
                <option value="">Select episode...</option>
                {episodes.map(episode => (
                  <option key={episode.id} value={episode.id}>
                    {episode.title || `Episode ${episode.episode_number}`}
                  </option>
                ))}
              </select>
            </div>
            
            {scenes.length > 0 && (
              <div className="form-group">
                <label>Scene (Optional)</label>
                <select 
                  name="scene_id"
                  value={formData.scene_id}
                  onChange={handleInputChange}
                >
                  <option value="">No specific scene</option>
                  {scenes.map(scene => (
                    <option key={scene.id} value={scene.id}>
                      {scene.name || `Scene ${scene.scene_number}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="form-section">
              <h3>Override Metadata</h3>
              <p className="help-text">
                Override item metadata for this specific episode assignment
              </p>
              
              <div className="form-group">
                <label>Character</label>
                <input 
                  type="text"
                  name="character"
                  value={formData.character}
                  onChange={handleInputChange}
                  placeholder="Character name"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Occasion</label>
                  <select 
                    name="occasion"
                    value={formData.occasion}
                    onChange={handleInputChange}
                  >
                    <option value="">Select...</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="business">Business</option>
                    <option value="party">Party</option>
                    <option value="athletic">Athletic</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Season</label>
                  <select 
                    name="season"
                    value={formData.season}
                    onChange={handleInputChange}
                  >
                    <option value="">Select...</option>
                    <option value="spring">Spring</option>
                    <option value="summer">Summer</option>
                    <option value="fall">Fall</option>
                    <option value="winter">Winter</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Any additional notes for this assignment..."
                  rows="3"
                />
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            
            <button 
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" /> Assigning...
                </>
              ) : (
                'Assign to Episode'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WardrobeAssignmentModal;
