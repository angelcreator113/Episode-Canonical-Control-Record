/**
 * ThumbnailComposer - CORRECTED VERSION
 * 
 * All blocking issues fixed:
 * 1. ✅ Formats inline (no external file needed)
 * 2. ✅ Uses TemplateDesigner.css (no new CSS file needed)
 * 3. ✅ Route: /composer/:episodeId
 * 4. ✅ Loads existing composition (doesn't create)
 * 5. ✅ Handles response.data structure correctly
 * 6. ✅ Uses correct API endpoint: /api/v1/compositions/episode/:episodeId
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';
import { CANONICAL_ROLES } from '../constants/canonicalRoles';
import './TemplateDesigner.css'; // ✅ FIX 2: Reuse existing CSS

// ✅ FIX 1: Formats defined inline
const THUMBNAIL_FORMATS = {
  youtube_hero: {
    id: 'youtube_hero',
    name: 'YouTube Hero',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9'
  },
  youtube_thumbnail: {
    id: 'youtube_thumbnail',
    name: 'YouTube Thumbnail',
    width: 1280,
    height: 720,
    aspectRatio: '16:9'
  },
  instagram_square: {
    id: 'instagram_square',
    name: 'Instagram Square',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1'
  },
  instagram_story: {
    id: 'instagram_story',
    name: 'Instagram Story',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16'
  }
};

// SlotImage Component - Renders actual images
const SlotImage = ({ slot, assetUrl, mode, isSelected, onSelect }) => {
  const [image, status] = useImage(assetUrl, 'anonymous');
  const roleConfig = CANONICAL_ROLES[slot.role] || {};
  
  if (status === 'loading') {
    return (
      <>
        <Rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth={2}
        />
        <KonvaText
          x={slot.x + slot.width/2 - 30}
          y={slot.y + slot.height/2 - 7}
          text="Loading..."
          fontSize={14}
          fill="#6b7280"
        />
      </>
    );
  }
  
  if (status === 'failed') {
    return (
      <>
        <Rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          fill="#fef2f2"
          stroke="#ef4444"
          strokeWidth={2}
        />
        <KonvaText
          x={slot.x + 10}
          y={slot.y + slot.height/2 - 7}
          text="❌ Failed to load"
          fontSize={14}
          fill="#dc2626"
        />
      </>
    );
  }
  
  return (
    <>
      <KonvaImage
        x={slot.x}
        y={slot.y}
        width={slot.width}
        height={slot.height}
        image={image}
        onClick={onSelect}
        onTap={onSelect}
        listening={mode === 'layout'}
      />
      
      {mode === 'layout' && isSelected && (
        <Rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          stroke="#3b82f6"
          strokeWidth={3}
          listening={false}
        />
      )}
      
      {mode === 'layout' && (
        <>
          <Rect
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={25}
            fill="rgba(0,0,0,0.7)"
            listening={false}
          />
          <KonvaText
            x={slot.x + 5}
            y={slot.y + 5}
            text={`${roleConfig.icon} ${roleConfig.label}`}
            fontSize={14}
            fill="white"
            fontStyle="bold"
            listening={false}
          />
        </>
      )}
    </>
  );
};

// EmptySlot Component
const EmptySlot = ({ slot, isSelected, onSelect, mode }) => {
  const roleConfig = CANONICAL_ROLES[slot.role] || {};
  
  return (
    <>
      <Rect
        x={slot.x}
        y={slot.y}
        width={slot.width}
        height={slot.height}
        fill={roleConfig.color + '20'}
        stroke={isSelected ? '#3b82f6' : roleConfig.color}
        strokeWidth={isSelected ? 3 : 2}
        dash={[10, 5]}
        onClick={onSelect}
        onTap={onSelect}
        listening={mode === 'layout'}
      />
      
      <KonvaText
        x={slot.x + slot.width/2 - 24}
        y={slot.y + slot.height/2 - 54}
        text={roleConfig.icon}
        fontSize={48}
        fill={roleConfig.color}
        listening={false}
      />
      
      <KonvaText
        x={slot.x + slot.width/2}
        y={slot.y + slot.height/2}
        text={roleConfig.label}
        fontSize={16}
        fill="#374151"
        align="center"
        offsetX={roleConfig.label.length * 4}
        listening={false}
      />
      
      <KonvaText
        x={slot.x + slot.width/2 - 70}
        y={slot.y + slot.height/2 + 20}
        text="(No asset assigned)"
        fontSize={12}
        fill="#9ca3af"
        listening={false}
      />
    </>
  );
};

const ThumbnailComposer = () => {
  const { episodeId } = useParams(); // ✅ FIX 3: Route uses episodeId
  const navigate = useNavigate();
  
  // State
  const [episode, setEpisode] = useState(null);
  const [composition, setComposition] = useState(null);
  const [template, setTemplate] = useState(null);
  const [assetMap, setAssetMap] = useState({});
  const [selectedFormat, setSelectedFormat] = useState('youtube_hero');
  const [mode, setMode] = useState('layout');
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const currentFormat = THUMBNAIL_FORMATS[selectedFormat] || THUMBNAIL_FORMATS.youtube_hero;
  
  const canvasScale = Math.min(
    (window.innerWidth - 600) / currentFormat.width,
    (window.innerHeight - 200) / currentFormat.height,
    1
  );
  
  // Load episode and composition
  useEffect(() => {
    loadEpisodeAndComposition();
  }, [episodeId]);
  
  // ✅ Poll for PROCESSING status
  useEffect(() => {
    if (composition?.status === 'PROCESSING' && !isPolling) {
      setIsPolling(true);
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/compositions/${composition.id}`);
          if (!res.ok) throw new Error('Failed to poll composition');
          const response = await res.json();
          
          // ✅ FIX 5: Handle response.data structure
          const data = response.data || response;
          
          console.log('📊 Polling status:', data.status);
          
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            setComposition(data);
            setIsPolling(false);
            clearInterval(interval);
            
            if (data.status === 'COMPLETED') {
              console.log('✅ Composition completed!');
            } else {
              console.error('❌ Composition failed:', data.error);
              setError(data.error || 'Composition failed');
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
          clearInterval(interval);
          setIsPolling(false);
        }
      }, 2000);
      
      return () => {
        clearInterval(interval);
        setIsPolling(false);
      };
    }
  }, [composition?.status, composition?.id, isPolling]);
  
  const loadEpisodeAndComposition = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load episode
      console.log('📺 Loading episode:', episodeId);
      const episodeRes = await fetch(`/api/v1/episodes/${episodeId}`);
      if (!episodeRes.ok) throw new Error('Failed to load episode');
      const episodeResponse = await episodeRes.json();
      
      // ✅ FIX 5: Handle response.data structure
      const episodeData = episodeResponse.data || episodeResponse;
      setEpisode(episodeData);
      console.log('✅ Episode loaded:', episodeData.title);
      
      // ✅ FIX 6: Use correct API endpoint
      console.log('🔍 Checking for existing composition...');
      const compositionsRes = await fetch(`/api/v1/compositions/episode/${episodeId}`);
      
      if (!compositionsRes.ok) {
        console.log('⚠️ No compositions found for this episode');
        setLoading(false);
        return;
      }
      
      const compositionsResponse = await compositionsRes.json();
      // ✅ FIX 5: Handle response.data structure
      const compositionsData = compositionsResponse.data || compositionsResponse;
      const compositionsList = Array.isArray(compositionsData) ? compositionsData : [compositionsData];
      
      const existing = compositionsList.find(c => c.status !== 'FAILED');
      
      if (!existing) {
        console.log('⚠️ No existing composition found');
        setLoading(false);
        return;
      }
      
      console.log('✅ Found existing composition:', existing.id);
      setComposition(existing);
      
      // Load template (with fallback)
      const templateId = existing.template_studio_id || existing.template_id;
      
      if (templateId) {
        console.log('🎨 Loading template:', templateId);
        const templateRes = await fetch(`/api/v1/template-studio/${templateId}`);
        if (!templateRes.ok) throw new Error('Failed to load template');
        const templateResponse = await templateRes.json();
        
        // ✅ FIX 5: Handle response.data structure
        const templateData = templateResponse.data || templateResponse;
        setTemplate(templateData);
        console.log('✅ Template loaded:', templateData.name);
        
        // Build asset map
        await buildAssetMap(existing);
      } else {
        console.log('⚠️ No template assigned yet');
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error('❌ Error loading composition:', err);
      setError(err.message);
      setLoading(false);
    }
  };
  
  // Build asset map from composition_assets
  const buildAssetMap = async (compData) => {
    try {
      console.log('🗺️ Building asset map...');
      const map = {};
      
      const compositionAssets = compData.composition_assets || [];
      console.log('📦 Composition assets:', compositionAssets.length);
      
      for (const ca of compositionAssets) {
        if (ca.asset) {
          // Priority: thumbnail_url → s3_url_raw → s3_url
          const assetUrl = ca.asset.metadata?.thumbnail_url 
                        || ca.asset.s3_url_raw 
                        || ca.asset.s3_url;
          
          if (assetUrl) {
            // Use asset_role (database column name)
            const role = ca.asset_role || ca.role;
            map[role] = assetUrl;
            console.log(`✅ Mapped ${role}:`, assetUrl.substring(0, 50) + '...');
          } else {
            const role = ca.asset_role || ca.role;
            console.warn(`⚠️ Asset for ${role} has no URL`);
          }
        }
      }
      
      console.log('✅ Asset map built:', Object.keys(map).length, 'assets');
      setAssetMap(map);
      
    } catch (err) {
      console.error('Error building asset map:', err);
    }
  };
  
  // Get asset counts
  const getMappedCount = () => Object.keys(assetMap).length;
  
  const getRequiredCount = () => {
    if (!template) return 0;
    return template.role_slots.filter(s => s.required).length;
  };
  
  const getRequiredMappedCount = () => {
    if (!template) return 0;
    return template.role_slots
      .filter(s => s.required && assetMap[s.role])
      .length;
  };
  
  const getUnmappedRoles = () => {
    if (!template) return [];
    return template.role_slots
      .filter(s => !assetMap[s.role])
      .map(s => ({ role: s.role, required: s.required }));
  };
  
  // Handle slot selection
  const handleSlotSelect = (slotId) => {
    if (mode === 'layout') {
      setSelectedSlotId(selectedSlotId === slotId ? null : slotId);
    }
  };
  
  // Render canvas with images
  const renderCanvas = () => {
    if (!template) {
      return (
        <div style={{ 
          padding: '3rem', 
          textAlign: 'center', 
          color: '#6b7280',
          background: 'white',
          borderRadius: '8px'
        }}>
          <h3>No Template Selected</h3>
          <p>This composition doesn't have a template assigned yet.</p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate(`/episodes/${episodeId}`)}
            style={{ marginTop: '1rem' }}
          >
            Back to Episode
          </button>
        </div>
      );
    }
    
    return (
      <Stage 
        width={currentFormat.width * canvasScale} 
        height={currentFormat.height * canvasScale}
        scale={{ x: canvasScale, y: canvasScale }}
        style={{ 
          background: 'white',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px'
        }}
      >
        <Layer>
          {/* Background slot first */}
          {template.role_slots
            .filter(slot => slot.role === 'BG.MAIN')
            .map(slot => {
              const assetUrl = assetMap[slot.role];
              const isSelected = selectedSlotId === slot.role;
              
              return assetUrl ? (
                <SlotImage
                  key={slot.role}
                  slot={slot}
                  assetUrl={assetUrl}
                  mode={mode}
                  isSelected={isSelected}
                  onSelect={() => handleSlotSelect(slot.role)}
                />
              ) : (
                <EmptySlot
                  key={slot.role}
                  slot={slot}
                  isSelected={isSelected}
                  onSelect={() => handleSlotSelect(slot.role)}
                  mode={mode}
                />
              );
            })}
          
          {/* All other slots by layer order */}
          {template.role_slots
            .filter(slot => slot.role !== 'BG.MAIN')
            .sort((a, b) => a.layer - b.layer)
            .map(slot => {
              const assetUrl = assetMap[slot.role];
              const isSelected = selectedSlotId === slot.role;
              
              return assetUrl ? (
                <SlotImage
                  key={slot.role}
                  slot={slot}
                  assetUrl={assetUrl}
                  mode={mode}
                  isSelected={isSelected}
                  onSelect={() => handleSlotSelect(slot.role)}
                />
              ) : (
                <EmptySlot
                  key={slot.role}
                  slot={slot}
                  isSelected={isSelected}
                  onSelect={() => handleSlotSelect(slot.role)}
                  mode={mode}
                />
              );
            })}
        </Layer>
      </Stage>
    );
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="template-designer" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100vh'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p>Loading composition...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="template-designer" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100vh'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Error Loading Composition</h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{error}</p>
          <button 
            className="btn btn-primary" 
            onClick={loadEpisodeAndComposition}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  const unmappedRoles = getUnmappedRoles();
  const mappedCount = getMappedCount();
  const requiredCount = getRequiredCount();
  const requiredMappedCount = getRequiredMappedCount();
  const totalSlots = template?.role_slots.length || 0;
  const canGenerate = requiredMappedCount === requiredCount;
  
  return (
    <div className="template-designer">
      {/* Header */}
      <div className="designer-toolbar">
        <div className="toolbar-left">
          <button 
            className="btn-back"
            onClick={() => navigate(`/episodes/${episodeId}`)}
          >
            ← Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Thumbnail Composer</h2>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              <span>{episode?.title || 'Episode'}</span>
              {template && (
                <>
                  <span> • </span>
                  <span>{template.name}</span>
                </>
              )}
              {composition?.status && (
                <>
                  <span> • </span>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    background: composition.status === 'COMPLETED' ? '#d1fae5' : '#fef3c7',
                    color: composition.status === 'COMPLETED' ? '#065f46' : '#92400e',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {composition.status}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="toolbar-right">
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={mode === 'layout' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setMode('layout')}
              disabled={isPolling}
            >
              📐 Layout
            </button>
            <button
              className={mode === 'preview' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setMode('preview')}
              disabled={isPolling}
            >
              👁️ Preview
            </button>
          </div>
          
          <button 
            className="btn-primary" 
            disabled={!canGenerate || isPolling}
          >
            {isPolling ? '⏳ Generating...' : '🎨 Generate Thumbnail'}
          </button>
        </div>
      </div>
      
      {/* Main Layout */}
      <div className="designer-content">
        {/* Left Sidebar */}
        <div className="role-palette">
          <div className="palette-header">
            <h3>📐 Output Format</h3>
          </div>
          
          <div className="palette-content">
            <select 
              value={selectedFormat} 
              onChange={(e) => setSelectedFormat(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                marginBottom: '1rem'
              }}
              disabled={isPolling}
            >
              {Object.entries(THUMBNAIL_FORMATS).map(([key, format]) => (
                <option key={key} value={key}>
                  {format.name} {format.width}×{format.height}
                </option>
              ))}
            </select>
            
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
              <div>Aspect Ratio: {currentFormat.aspectRatio}</div>
              <div>Scale: {Math.round(canvasScale * 100)}%</div>
            </div>
            
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>📊 Asset Status</h3>
            <div style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '0.5rem',
                fontSize: '0.875rem'
              }}>
                <span>Total Mapped:</span>
                <strong>{mappedCount}/{totalSlots}</strong>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: '0.875rem'
              }}>
                <span>Required:</span>
                <strong style={{ color: canGenerate ? '#059669' : '#dc2626' }}>
                  {requiredMappedCount}/{requiredCount}
                </strong>
              </div>
            </div>
            
            {unmappedRoles.length > 0 && (
              <div style={{
                border: '1px solid #fbbf24',
                background: '#fef3c7',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: 600, 
                  color: '#92400e',
                  marginBottom: '0.75rem',
                  margin: 0
                }}>
                  ⚠️ Missing Assets ({unmappedRoles.length})
                </h4>
                <div style={{ marginTop: '0.75rem' }}>
                  {unmappedRoles.map(({ role, required }) => {
                    const config = CANONICAL_ROLES[role] || {};
                    return (
                      <div 
                        key={role}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem',
                          marginBottom: '0.5rem',
                          background: 'white',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${required ? '#dc2626' : '#6b7280'}`,
                          fontSize: '0.875rem'
                        }}
                      >
                        <span style={{ color: config.color, fontSize: '1.25rem' }}>
                          {config.icon}
                        </span>
                        <span style={{ flex: 1 }}>{config.label}</span>
                        {required && (
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            Required
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {canGenerate && (
              <div style={{
                padding: '0.75rem',
                background: '#d1fae5',
                border: '1px solid #059669',
                borderRadius: '6px',
                color: '#065f46',
                fontSize: '0.875rem',
                textAlign: 'center'
              }}>
                ✅ All required assets assigned!
              </div>
            )}
          </div>
        </div>
        
        {/* Canvas Area */}
        <div className="canvas-area">
          <div className="canvas-header">
            <span>Canvas: {currentFormat.width}×{currentFormat.height}</span>
            <span>•</span>
            <span>Scale: {Math.round(canvasScale * 100)}%</span>
            {template && (
              <>
                <span>•</span>
                <span>Slots: {totalSlots}</span>
              </>
            )}
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            padding: '2rem',
            background: '#e5e7eb'
          }}>
            {renderCanvas()}
          </div>
        </div>
        
        {/* Right Sidebar - Properties */}
        <div className="slot-properties">
          <div className="properties-header">
            <h3>🔧 Properties</h3>
          </div>
          
          {selectedSlotId ? (
            <div style={{ padding: '1rem' }}>
              {(() => {
                const slot = template?.role_slots.find(s => s.role === selectedSlotId);
                const config = CANONICAL_ROLES[selectedSlotId] || {};
                const hasAsset = !!assetMap[selectedSlotId];
                
                return (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Role:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: config.color, fontSize: '1.25rem' }}>
                          {config.icon}
                        </span>
                        <span>{config.label}</span>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Status:</label>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: hasAsset ? '#d1fae5' : '#fee2e2',
                        color: hasAsset ? '#065f46' : '#991b1b',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}>
                        {hasAsset ? '✓ Asset Assigned' : '✗ No Asset'}
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Position:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>X: {slot?.x}px</div>
                        <div style={{ fontSize: '0.875rem' }}>Y: {slot?.y}px</div>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Size:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>W: {slot?.width}px</div>
                        <div style={{ fontSize: '0.875rem' }}>H: {slot?.height}px</div>
                      </div>
                    </div>
                    
                    {hasAsset && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Asset URL:</label>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#6b7280',
                          wordBreak: 'break-all',
                          background: '#f9fafb',
                          padding: '0.5rem',
                          borderRadius: '4px'
                        }}>
                          {assetMap[selectedSlotId].substring(0, 50)}...
                        </div>
                      </div>
                    )}
                    
                    <button 
                      className="btn-secondary"
                      style={{ width: '100%' }}
                      disabled={isPolling}
                    >
                      🔄 Change Asset
                    </button>
                  </>
                );
              })()}
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              textAlign: 'center',
              padding: '2rem'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👈</div>
              <p>Click a slot to view properties</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThumbnailComposer;
