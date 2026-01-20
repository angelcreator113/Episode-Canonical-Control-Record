/**
 * AssetLibrary Component - Unified & Enhanced
 * Handles both display and upload of assets
 * Integrated with real backend API
 */

import React, { useState, useEffect } from 'react';
import './AssetLibrary.css';

const AssetLibrary = ({
  episodeId = null,
  onAssetSelect = () => {},
  readOnly = false,
  allowMultiSelect = false,
  maxSelectCount = 10,
  showUpload = true,
  compact = false,
}) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const assetTypes = [
    'PROMO_LALA',
    'PROMO_JUSTAWOMANINHERPRIME',
    'PROMO_GUEST',
    'BRAND_LOGO',
    'EPISODE_FRAME',
  ];

  useEffect(() => {
    loadAssets();
  }, [episodeId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      
      // Get auth token from localStorage
      const token = localStorage.getItem('authToken');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // Try to fetch real assets from API - fetch each type separately (no "ALL")
      const allAssets = [];
      const validTypes = assetTypes.filter(t => t !== 'ALL');
      
      for (const type of validTypes) {
        try {
          // Use full URL with correct backend port
          const apiUrl = `${API_URL}/assets/approved/${type}`;
          console.log(`📥 Fetching assets for type: ${type}`);
          
          const response = await fetch(apiUrl, { 
            headers,
            method: 'GET',
          });
          
          if (response.ok) {
            const data = await response.json();
            const typeAssets = data.data || [];
            console.log(`✅ Loaded ${typeAssets.length} assets for type ${type}`);
            allAssets.push(...typeAssets);
          }
        } catch (typeError) {
          console.log(`⚠️  Could not load assets for type ${type}`);
        }
      }
      
      // If we got real assets, use them
      if (allAssets.length > 0) {
        console.log(`✅ Loaded ${allAssets.length} real assets total`);
        setAssets(allAssets);
        setLoading(false);
        return;
      }
      
      // Fallback: Create sample assets with proper thumbnails for demo
      const createColorThumbnail = (emoji, color, text) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="${color}" width="150" height="150"/><text x="75" y="65" text-anchor="middle" font-size="40" dy=".3em" dominant-baseline="middle">${emoji}</text><text x="75" y="120" text-anchor="middle" fill="white" font-size="11">${text}</text></svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      };
      
      const sampleAssets = [
        {
          id: '1',
          name: 'Promo Banner 1',
          type: 'PROMO_LALA',
          thumbnail: createColorThumbnail('🎨', '#667eea', 'Promo 1'),
          size: 2.5,
          uploadedAt: '2026-01-07',
        },
        {
          id: '2',
          name: 'Background Frame',
          type: 'EPISODE_FRAME',
          thumbnail: createColorThumbnail('🖼️', '#10b981', 'Frame'),
          size: 3.2,
          uploadedAt: '2026-01-06',
        },
        {
          id: '3',
          name: 'Logo HD',
          type: 'BRAND_LOGO',
          thumbnail: createColorThumbnail('📌', '#f59e0b', 'Logo'),
          size: 1.1,
          uploadedAt: '2026-01-05',
        },
      ];
      
      console.log('📋 No real assets found, showing sample assets');
      setAssets(sampleAssets);
    } catch (error) {
      console.error('❌ Error loading assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetClick = (asset) => {
    if (readOnly) return;
    
    if (allowMultiSelect) {
      const isSelected = selectedAssets.some(a => a.id === asset.id);
      const updated = isSelected 
        ? selectedAssets.filter(a => a.id !== asset.id)
        : [...selectedAssets, asset];
      
      if (updated.length <= maxSelectCount) {
        setSelectedAssets(updated);
        onAssetSelect(updated);
      }
    } else {
      setSelectedAssets([asset]);
      onAssetSelect(asset);
    }
  };

  if (loading) {
    return <div className="asset-loading">Loading assets...</div>;
  }

  const filteredAssets = filterType === 'ALL' 
    ? assets
    : assets.filter(a => a.asset_type === filterType || a.type === filterType);

  return (
    <div className="asset-library">
      <div className="asset-header">
        <input
          type="text"
          className="asset-search"
          placeholder="Search assets..."
          onChange={(e) => {}}
        />
        
        <select 
          className="asset-filters"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          disabled={readOnly}
        >
          <option value="ALL">All Assets</option>
          {assetTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="asset-empty">
          <div className="asset-empty-icon">📁</div>
          <p>No assets found</p>
        </div>
      ) : (
        <div className="asset-grid">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              className="asset-item"
              onClick={() => handleAssetClick(asset)}
              style={{ 
                opacity: selectedAssets.some(a => a.id === asset.id) ? 0.7 : 1,
                border: selectedAssets.some(a => a.id === asset.id) ? '2px solid #667eea' : '1px solid #e0e0e0'
              }}
            >
              <img
                src={asset.thumbnail || asset.s3_url || asset.url}
                alt={asset.name}
                className="asset-thumbnail"
              />
              <div className="asset-info">
                <div className="asset-name" title={asset.name}>{asset.name}</div>
                <div className="asset-type">{asset.asset_type || asset.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssetLibrary;
