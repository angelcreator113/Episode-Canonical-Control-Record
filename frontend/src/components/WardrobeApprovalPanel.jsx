/**
 * Wardrobe Approval Panel
 * Manage approval workflow for wardrobe items
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import './WardrobeApprovalPanel.css';

const WardrobeApprovalPanel = ({ episodeId }) => {
  const [activeTab, setActiveTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningItem, setActioningItem] = useState(null);
  const [notes, setNotes] = useState('');
  
  useEffect(() => {
    loadItems();
  }, [episodeId, activeTab]);
  
  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `${API_URL}/wardrobe-approval/${episodeId}?status=${activeTab}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load wardrobe items');
      }
      
      const data = await response.json();
      setItems(data.data || []);
    } catch (err) {
      console.error('Error loading items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (wardrobeId) => {
    try {
      setActioningItem(wardrobeId);
      
      await wardrobeLibraryService.approveItem(episodeId, wardrobeId, {
        notes: notes
      });
      
      setNotes('');
      await loadItems();
    } catch (err) {
      console.error('Error approving item:', err);
      setError(err.message);
    } finally {
      setActioningItem(null);
    }
  };
  
  const handleReject = async (wardrobeId) => {
    if (!notes.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    
    try {
      setActioningItem(wardrobeId);
      
      await wardrobeLibraryService.rejectItem(episodeId, wardrobeId, {
        reason: notes
      });
      
      setNotes('');
      await loadItems();
    } catch (err) {
      console.error('Error rejecting item:', err);
      setError(err.message);
    } finally {
      setActioningItem(null);
    }
  };
  
  const getImageUrl = (item) => {
    if (item?.image_url) {
      return item.image_url.startsWith('http') 
        ? item.image_url 
        : `${API_URL}${item.image_url}`;
    }
    return '/placeholder-wardrobe.png';
  };
  
  const tabs = [
    { key: 'pending', label: 'Pending', count: items.filter(i => !i.approval_status).length },
    { key: 'approved', label: 'Approved', count: items.filter(i => i.approval_status === 'approved').length },
    { key: 'rejected', label: 'Rejected', count: items.filter(i => i.approval_status === 'rejected').length }
  ];
  
  return (
    <div className="wardrobe-approval-panel">
      <div className="panel-header">
        <h2>Wardrobe Approval</h2>
      </div>
      
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count > 0 && <span className="badge">{tab.count}</span>}
          </button>
        ))}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="panel-content">
        {loading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p>No {activeTab} items</p>
          </div>
        ) : (
          <div className="items-list">
            {items.map(item => (
              <div key={item.id} className="approval-item">
                <div className="item-image">
                  <img 
                    src={getImageUrl(item)} 
                    alt={item.name}
                    onError={(e) => {
                      e.target.src = '/placeholder-wardrobe.png';
                    }}
                  />
                </div>
                
                <div className="item-info">
                  <h3>{item.name}</h3>
                  {item.description && (
                    <p className="description">{item.description}</p>
                  )}
                  
                  <div className="item-meta">
                    {item.item_type && <span className="meta-tag">{item.item_type}</span>}
                    {item.character && <span className="meta-tag">👤 {item.character}</span>}
                    {item.occasion && <span className="meta-tag">🎭 {item.occasion}</span>}
                  </div>
                  
                  {item.approval_status === 'approved' && (
                    <div className="approval-info">
                      <span className="status approved">✓ Approved</span>
                      {item.approved_by && (
                        <span className="approved-by">by {item.approved_by}</span>
                      )}
                      {item.approved_at && (
                        <span className="approved-date">
                          {new Date(item.approved_at).toLocaleDateString()}
                        </span>
                      )}
                      {item.approval_notes && (
                        <p className="notes">Notes: {item.approval_notes}</p>
                      )}
                    </div>
                  )}
                  
                  {item.approval_status === 'rejected' && (
                    <div className="approval-info">
                      <span className="status rejected">✗ Rejected</span>
                      {item.rejected_by && (
                        <span className="rejected-by">by {item.rejected_by}</span>
                      )}
                      {item.rejected_at && (
                        <span className="rejected-date">
                          {new Date(item.rejected_at).toLocaleDateString()}
                        </span>
                      )}
                      {item.rejection_reason && (
                        <p className="notes reason">Reason: {item.rejection_reason}</p>
                      )}
                    </div>
                  )}
                </div>
                
                {activeTab === 'pending' && (
                  <div className="item-actions">
                    <textarea
                      placeholder="Add notes or reason..."
                      value={actioningItem === item.id ? notes : ''}
                      onChange={(e) => {
                        setActioningItem(item.id);
                        setNotes(e.target.value);
                      }}
                      rows="2"
                    />
                    
                    <div className="action-buttons">
                      <button
                        className="btn btn-success"
                        onClick={() => handleApprove(item.wardrobe_id)}
                        disabled={actioningItem && actioningItem !== item.id}
                      >
                        Approve
                      </button>
                      
                      <button
                        className="btn btn-danger"
                        onClick={() => handleReject(item.wardrobe_id)}
                        disabled={actioningItem && actioningItem !== item.id}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WardrobeApprovalPanel;
