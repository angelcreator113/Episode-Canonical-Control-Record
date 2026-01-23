/**
 * Wardrobe Library Detail
 * Detailed view of a single wardrobe item
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from '../components/LoadingSpinner';
import WardrobeAssignmentModal from '../components/WardrobeAssignmentModal';
import './WardrobeLibraryDetail.css';

const WardrobeLibraryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usageHistory, setUsageHistory] = useState([]);
  const [crossShowUsage, setCrossShowUsage] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  
  useEffect(() => {
    loadItemData();
  }, [id]);
  
  useEffect(() => {
    if (item) {
      // Track view
      wardrobeLibraryService.trackView(id);
    }
  }, [item, id]);
  
  const loadItemData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load item details
      const itemData = await wardrobeLibraryService.getLibraryItem(id);
      setItem(itemData);
      setEditData(itemData);
      
      // Load usage history
      try {
        const usage = await wardrobeLibraryService.getUsageHistory(id);
        setUsageHistory(usage || []);
      } catch (err) {
        console.warn('Could not load usage history:', err);
      }
      
      // Load cross-show usage
      try {
        const crossShow = await wardrobeLibraryService.getCrossShowUsage(id);
        setCrossShowUsage(crossShow || []);
      } catch (err) {
        console.warn('Could not load cross-show usage:', err);
      }
    } catch (err) {
      console.error('Error loading item:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(item);
  };
  
  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      const updated = await wardrobeLibraryService.updateLibraryItem(id, editData);
      setItem(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating item:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async () => {
    try {
      setLoading(true);
      await wardrobeLibraryService.deleteLibraryItem(id);
      navigate('/wardrobe-library');
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err.message);
      setShowDeleteConfirm(false);
      setLoading(false);
    }
  };
  
  const handleAssignSuccess = () => {
    setShowAssignModal(false);
    loadItemData(); // Reload to get updated usage stats
  };
  
  const getImageUrl = (item) => {
    if (item?.image_url) {
      return item.image_url.startsWith('http') 
        ? item.image_url 
        : `${API_URL}${item.image_url}`;
    }
    return '/placeholder-wardrobe.png';
  };
  
  if (loading && !item) {
    return <LoadingSpinner />;
  }
  
  if (error && !item) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>Error Loading Item</h2>
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/wardrobe-library')}
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }
  
  if (!item) {
    return null;
  }
  
  return (
    <div className="wardrobe-library-detail">
      <div className="detail-header">
        <button 
          className="btn btn-back"
          onClick={() => navigate('/wardrobe-library')}
        >
          ← Back to Library
        </button>
        
        <div className="header-actions">
          {!isEditing ? (
            <>
              <button 
                className="btn btn-secondary"
                onClick={handleEdit}
              >
                Edit
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn btn-secondary"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSaveEdit}
              >
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="detail-content">
        <div className="detail-main">
          <div className="image-container">
            <img 
              src={getImageUrl(item)} 
              alt={item.name}
              onError={(e) => {
                e.target.src = '/placeholder-wardrobe.png';
              }}
            />
            {item.type === 'set' && (
              <span className="item-badge">Outfit Set</span>
            )}
          </div>
          
          <div className="item-info">
            {!isEditing ? (
              <>
                <h1>{item.name}</h1>
                {item.description && (
                  <p className="description">{item.description}</p>
                )}
              </>
            ) : (
              <>
                <input 
                  type="text"
                  className="edit-input edit-title"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                />
                <textarea 
                  className="edit-input edit-description"
                  value={editData.description || ''}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  placeholder="Description..."
                />
              </>
            )}
            
            <div className="metadata-grid">
              <div className="metadata-item">
                <label>Type</label>
                <span>{item.type === 'set' ? 'Outfit Set' : 'Individual Item'}</span>
              </div>
              
              {item.item_type && (
                <div className="metadata-item">
                  <label>Item Type</label>
                  <span>{item.item_type}</span>
                </div>
              )}
              
              {item.color && (
                <div className="metadata-item">
                  <label>Color</label>
                  <span>{item.color}</span>
                </div>
              )}
              
              {item.season && (
                <div className="metadata-item">
                  <label>Season</label>
                  <span>{item.season}</span>
                </div>
              )}
              
              {item.occasion && (
                <div className="metadata-item">
                  <label>Occasion</label>
                  <span>{item.occasion}</span>
                </div>
              )}
              
              {item.character && (
                <div className="metadata-item">
                  <label>Character</label>
                  <span>{item.character}</span>
                </div>
              )}
              
              {item.tags && item.tags.length > 0 && (
                <div className="metadata-item full-width">
                  <label>Tags</label>
                  <div className="tags-list">
                    {item.tags.map((tag, idx) => (
                      <span key={idx} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {(item.website_url || item.price || item.vendor) && (
              <div className="commerce-section">
                <h3>Commerce Info</h3>
                {item.website_url && (
                  <div className="commerce-item">
                    <label>Website</label>
                    <a href={item.website_url} target="_blank" rel="noopener noreferrer">
                      {item.website_url}
                    </a>
                  </div>
                )}
                {item.price && (
                  <div className="commerce-item">
                    <label>Price</label>
                    <span>${parseFloat(item.price).toFixed(2)}</span>
                  </div>
                )}
                {item.vendor && (
                  <div className="commerce-item">
                    <label>Vendor</label>
                    <span>{item.vendor}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="action-buttons">
              <button 
                className="btn btn-primary btn-large"
                onClick={() => setShowAssignModal(true)}
              >
                Assign to Episode
              </button>
            </div>
          </div>
        </div>
        
        <div className="detail-sidebar">
          <div className="stats-card">
            <h3>Usage Statistics</h3>
            <div className="stat-item">
              <span className="stat-label">Total Uses</span>
              <span className="stat-value">{item.usage_count || 0}</span>
            </div>
            {item.last_used_at && (
              <div className="stat-item">
                <span className="stat-label">Last Used</span>
                <span className="stat-value">
                  {new Date(item.last_used_at).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="stat-item">
              <span className="stat-label">Added</span>
              <span className="stat-value">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          {crossShowUsage.length > 0 && (
            <div className="cross-show-card">
              <h3>Used in Shows</h3>
              <ul className="show-list">
                {crossShowUsage.map((show, idx) => (
                  <li key={idx}>
                    <span className="show-name">{show.show_name}</span>
                    <span className="show-count">{show.usage_count} times</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {usageHistory.length > 0 && (
            <div className="usage-history-card">
              <h3>Usage History</h3>
              <div className="usage-table">
                <table>
                  <thead>
                    <tr>
                      <th>Episode</th>
                      <th>Scene</th>
                      <th>Character</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageHistory.map((usage, idx) => (
                      <tr key={idx}>
                        <td>{usage.episode_title || `Episode ${usage.episode_id}`}</td>
                        <td>{usage.scene_name || '-'}</td>
                        <td>{usage.character || '-'}</td>
                        <td>{new Date(usage.used_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showAssignModal && (
        <WardrobeAssignmentModal 
          item={item}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleAssignSuccess}
        />
      )}
      
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Confirm Delete</h2>
            <p>Are you sure you want to delete "{item.name}"? This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WardrobeLibraryDetail;
