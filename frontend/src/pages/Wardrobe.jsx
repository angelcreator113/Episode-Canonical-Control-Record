/**
 * Unified Wardrobe System
 * Single page with tabs: Items | Outfit Sets | Analytics
 * Cohesive design, shared components, unified visual language
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WardrobeBrowser from './WardrobeBrowser';
import OutfitSets from './OutfitSets';
import WardrobeAnalytics from './WardrobeAnalytics';
import './Wardrobe.css';

const Wardrobe = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'items';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const getPrimaryAction = () => {
    switch (activeTab) {
      case 'items':
        return { label: '+ Add Item', onClick: () => navigate('/wardrobe-library/upload') };
      case 'outfits':
        return { label: '+ Create Outfit', onClick: () => {} }; // Handled by OutfitSets
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();

  return (
    <div className="wardrobe-unified">
      {/* Header */}
      <div className="wardrobe-header">
        <button 
          onClick={() => navigate(-1)} 
          className="btn-back"
        >
          ← Back
        </button>
        <div className="wardrobe-title-group">
          <h1 className="wardrobe-title">👗 Wardrobe</h1>
          <p className="wardrobe-subtitle">Manage items, outfits, and insights</p>
        </div>
        {primaryAction && (
          <button 
            className="btn-primary-action"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="wardrobe-tabs">
        <button
          className={`wardrobe-tab ${activeTab === 'items' ? 'active' : ''}`}
          onClick={() => handleTabChange('items')}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-label">Items</span>
        </button>
        <button
          className={`wardrobe-tab ${activeTab === 'outfits' ? 'active' : ''}`}
          onClick={() => handleTabChange('outfits')}
        >
          <span className="tab-icon">👔</span>
          <span className="tab-label">Outfit Sets</span>
        </button>
        <button
          className={`wardrobe-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => handleTabChange('analytics')}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">Analytics</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="wardrobe-content">
        {activeTab === 'items' && <WardrobeBrowser mode="gallery" unified={true} />}
        {activeTab === 'outfits' && <OutfitSets unified={true} />}
        {activeTab === 'analytics' && <WardrobeAnalytics unified={true} />}
      </div>
    </div>
  );
};

export default Wardrobe;
