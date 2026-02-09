// INTEGRATION TEMPLATE for RawFootageUpload.jsx
// This shows exactly how to integrate the AnalysisDashboard and analysis functionality

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AnalysisDashboard from './AnalysisDashboard';

export default function RawFootageUpload({ episodeId, showId }) {
  // === EXISTING STATE ===
  const [footage, setFootage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // === NEW STATE FOR ANALYSIS ===
  const [selectedFootage, setSelectedFootage] = useState(null);
  const [editMap, setEditMap] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    loadFootage();
  }, [episodeId]);

  const loadFootage = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/v1/episodes/${episodeId}/raw-footage`);
      setFootage(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load footage:', error);
    } finally {
      setLoading(false);
    }
  };

  // === NEW ANALYSIS FUNCTIONS ===

  /**
   * Trigger AI analysis for selected footage
   */
  const handleAnalyze = async (footageId) => {
    try {
      setAnalyzing(true);
      
      // Make API call to trigger analysis
      const response = await axios.post(`/api/v1/raw-footage/${footageId}/analyze`);
      
      console.log('Analysis queued:', response.data);
      
      // Show success message
      alert('✅ AI analysis started! Check back in 2-5 minutes.');
      
      // Start polling for results
      startPolling(footageId);
      
    } catch (error) {
      console.error('Failed to start analysis:', error);
      alert('Failed to start analysis: ' + (error.response?.data?.error || error.message));
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Poll for analysis results every 10 seconds
   */
  const startPolling = (footageId) => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Set new polling interval
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/v1/raw-footage/${footageId}/edit-map`);
        const map = response.data.data;
        
        console.log('Edit map status:', map.processing_status);
        
        if (map.processing_status === 'completed') {
          // Analysis complete!
          clearInterval(interval);
          setEditMap(map);
          alert('✅ Analysis complete! Results loaded.');
          
        } else if (map.processing_status === 'failed') {
          // Analysis failed
          clearInterval(interval);
          alert('❌ Analysis failed: ' + (map.error_message || 'Unknown error'));
          
        } else {
          // Still processing
          console.log(`Processing: ${map.processing_status}`);
        }
        
      } catch (error) {
        // Not found yet, keep polling
        console.log('Waiting for analysis to start...');
      }
    }, 10000); // Poll every 10 seconds

    setPollingInterval(interval);
  };

  /**
   * Stop polling and clear edit map
   */
  const handleCloseDashboard = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setSelectedFootage(null);
    setEditMap(null);
  };

  /**
   * Refresh analysis status
   */
  const handleRefreshAnalysis = async () => {
    if (!selectedFootage) return;
    
    try {
      const response = await axios.get(`/api/v1/raw-footage/${selectedFootage.id}/edit-map`);
      setEditMap(response.data.data);
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  // === EXISTING UPLOAD HANDLER ===
  const handleUpload = async (file) => {
    // ... existing upload logic ...
  };

  // === RENDER ===
  if (loading) {
    return <div className="ed-state"><div className="ed-spinner"></div>Loading...</div>;
  }

  return (
    <div className="ed-stack">
      {/* Header */}
      <div className="ed-card">
        <div className="ed-cardhead">
          <h2 className="ed-cardtitle">📹 Raw Footage</h2>
          <button 
            type="button" 
            className="ed-btn ed-btn-primary"
            onClick={() => document.getElementById('file-input').click()}
            disabled={uploading}
          >
            + Upload Footage
          </button>
          <input 
            id="file-input" 
            type="file" 
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(e.target.files[0])}
            accept="video/*"
          />
        </div>
      </div>

      {/* Footage List */}
      <div className="ed-card">
        <div className="ed-list">
          {footage.map((item) => (
            <div key={item.id} className="ed-list-item" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{item.file_name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    {(item.file_size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                {/* Analyze Button */}
                <button
                  onClick={() => {
                    setSelectedFootage(item);
                    handleAnalyze(item.id);
                  }}
                  disabled={analyzing}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  {analyzing && selectedFootage?.id === item.id ? '🔄 Analyzing...' : '🤖 Analyze'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Dashboard Modal */}
      {selectedFootage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            width: '100%'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              position: 'sticky',
              top: 0,
              backgroundColor: 'white'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                📊 Analysis Results: {selectedFootage.file_name}
              </h2>
              <button
                onClick={handleCloseDashboard}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>

            {/* Dashboard Content */}
            <div style={{ padding: '24px' }}>
              <AnalysisDashboard
                rawFootageId={selectedFootage.id}
                editMap={editMap}
                onRefresh={handleRefreshAnalysis}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
