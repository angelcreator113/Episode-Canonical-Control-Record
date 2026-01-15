import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showService } from '../services/showService';
import '../styles/ShowForm.css';

const ShowForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    genre: '',
    network: '',
    creator_name: '',
    episode_count: 0,
    season_count: 0,
    premiere_date: '',
    status: 'active',
    is_active: true,
    metadata: {},
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEditing) {
      loadShow();
    }
  }, [id, isEditing]);

  const loadShow = async () => {
    try {
      setLoading(true);
      const show = await showService.getShowById(id);
      setFormData(show);
      setError(null);
    } catch (err) {
      setError('Failed to load show: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      if (!formData.name.trim()) {
        setError('Show name is required');
        return;
      }

      if (isEditing) {
        await showService.updateShow(id, formData);
        alert('Show updated successfully!');
      } else {
        await showService.createShow(formData);
        alert('Show created successfully!');
      }

      navigate('/shows');
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/shows');
  };

  if (loading && isEditing) {
    return <div className="show-form-container"><p>Loading...</p></div>;
  }

  return (
    <div className="show-form-container">
      <div className="show-form">
        <h2>{isEditing ? 'Edit Show' : 'Create New Show'}</h2>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Show Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter show name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Enter show description"
              rows="4"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="genre">Genre</label>
              <input
                type="text"
                id="genre"
                name="genre"
                value={formData.genre || ''}
                onChange={handleChange}
                placeholder="e.g., Drama, Comedy, Documentary"
              />
            </div>

            <div className="form-group">
              <label htmlFor="network">Network</label>
              <input
                type="text"
                id="network"
                name="network"
                value={formData.network || ''}
                onChange={handleChange}
                placeholder="e.g., Netflix, HBO"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="episode_count">Episode Count</label>
              <input
                type="number"
                id="episode_count"
                name="episode_count"
                value={formData.episode_count || 0}
                onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="season_count">Season Count</label>
              <input
                type="number"
                id="season_count"
                name="season_count"
                value={formData.season_count || 0}
                onChange={handleChange}
                min="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="creator_name">Creator Name</label>
              <input
                type="text"
                id="creator_name"
                name="creator_name"
                value={formData.creator_name || ''}
                onChange={handleChange}
                placeholder="Enter creator name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="premiere_date">Premiere Date</label>
              <input
                type="date"
                id="premiere_date"
                name="premiere_date"
                value={formData.premiere_date ? formData.premiere_date.split('T')[0] : ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status || 'active'}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="coming-soon">Coming Soon</option>
                <option value="concluded">Concluded</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active || false}
                  onChange={handleChange}
                />
                Is Active
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditing ? 'Update Show' : 'Create Show')}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShowForm;
