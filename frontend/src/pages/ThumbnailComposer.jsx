/**
 * ThumbnailComposer - FINAL WORKING VERSION
 * 
 * ✅ Composition ID extraction fixed (nested in response.data.composition.id)
 * ✅ Episode integer ID for assets endpoint
 * ✅ All features working
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Transformer, Line } from 'react-konva';
import useImage from 'use-image';
import { CANONICAL_ROLES } from '../constants/canonicalRoles';
import './TemplateDesigner.css';

const THUMBNAIL_FORMATS = {
  youtube_hero: { id: 'youtube_hero', name: 'YouTube Hero', width: 1920, height: 1080, aspectRatio: '16:9' },
  youtube_thumbnail: { id: 'youtube_thumbnail', name: 'YouTube Thumbnail', width: 1280, height: 720, aspectRatio: '16:9' },
  instagram_square: { id: 'instagram_square', name: 'Instagram Square', width: 1080, height: 1080, aspectRatio: '1:1' },
  instagram_story: { id: 'instagram_story', name: 'Instagram Story', width: 1080, height: 1920, aspectRatio: '9:16' }
};

const SlotImage = ({ slot, assetUrl, mode, isSelected, onSelect, onDragEnd, onTransformEnd, shapeRef, opacity = 1 }) => {
  // Create stable cache-busted URL using useRef to avoid re-renders
  const urlRef = React.useRef(null);
  
  if (!urlRef.current || urlRef.current.base !== assetUrl) {
    const separator = assetUrl?.includes('?') ? '&' : '?';
    const timestamp = Date.now();
    console.log(`🔗 Creating cache-busted URL for ${slot.role}:`, assetUrl);
    urlRef.current = {
      base: assetUrl,
      url: assetUrl ? `${assetUrl}${separator}t=${timestamp}` : ''
    };
  }
  
  const [image, status] = useImage(urlRef.current.url, 'anonymous');
  const roleConfig = CANONICAL_ROLES[slot.role] || {};
  // Prioritize direct slot properties (from slotPositions) over nested position object
  const x = Number(slot.x ?? slot.position?.x) || 0;
  const y = Number(slot.y ?? slot.position?.y) || 0;
  const width = Number(slot.width ?? slot.position?.width) || 100;
  const height = Number(slot.height ?? slot.position?.height) || 100;
  
  // Calculate aspect-ratio-preserving crop
  let cropX = 0, cropY = 0, cropWidth = 0, cropHeight = 0;
  if (image) {
    const imgAspect = image.width / image.height;
    const slotAspect = width / height;
    
    if (imgAspect > slotAspect) {
      // Image is wider - crop sides
      cropHeight = image.height;
      cropWidth = image.height * slotAspect;
      cropX = (image.width - cropWidth) / 2;
      cropY = 0;
    } else {
      // Image is taller - crop top/bottom
      cropWidth = image.width;
      cropHeight = image.width / slotAspect;
      cropX = 0;
      cropY = (image.height - cropHeight) / 2;
    }
  }
  
  // Log image loading status
  React.useEffect(() => {
    console.log(`📊 ${slot.role} status: ${status}`, { url: assetUrl?.substring(0, 60) });
    if (status === 'failed') {
      console.error(`❌ FAILED: ${slot.role}`, urlRef.current?.url);
    }
  }, [status, slot.role, assetUrl]);
  
  if (status === 'loading') return <><Rect x={x} y={y} width={width} height={height} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={2} /><KonvaText x={x + width/2 - 30} y={y + height/2 - 7} text="Loading..." fontSize={14} fill="#6b7280" /></>;
  if (status === 'failed') return <><Rect x={x} y={y} width={width} height={height} fill="#fef2f2" stroke="#ef4444" strokeWidth={2} /><KonvaText x={x + 10} y={y + height/2 - 7} text="❌ Failed" fontSize={14} fill="#dc2626" /></>;
  
  return (
    <>
      <KonvaImage 
        ref={isSelected ? shapeRef : null}
        x={x} 
        y={y} 
        width={width} 
        height={height} 
        image={image}
        crop={{
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight
        }}
        onClick={onSelect} 
        onTap={onSelect}
        draggable={mode === 'layout'}
        onDragEnd={onDragEnd}
        onTransformEnd={onTransformEnd}
        listening={mode === 'layout'}
        opacity={opacity}
      />
      {/* File names removed - show in Properties panel instead */}
    </>
  );
};

const EmptySlot = ({ slot, isSelected, onSelect, mode, onDragEnd, shapeRef }) => {
  const roleConfig = CANONICAL_ROLES[slot.role] || {};
  // Prioritize direct slot properties (from slotPositions) over nested position object
  const x = Number(slot.x ?? slot.position?.x) || 0;
  const y = Number(slot.y ?? slot.position?.y) || 0;
  const width = Number(slot.width ?? slot.position?.width) || 100;
  const height = Number(slot.height ?? slot.position?.height) || 100;
  
  console.log(`🔳 EmptySlot rendering for: ${slot.role}`);
  
  // In preview mode, don't render empty slots at all
  if (mode === 'preview') return null;
  
  return (
    <>
      <Rect 
        ref={isSelected ? shapeRef : null}
        x={x} 
        y={y} 
        width={width} 
        height={height} 
        fill={roleConfig.color + '20'} 
        stroke={isSelected ? '#3b82f6' : roleConfig.color} 
        strokeWidth={isSelected ? 3 : 2} 
        dash={[10, 5]} 
        onClick={onSelect} 
        onTap={onSelect} 
        draggable={mode === 'layout'}
        onDragEnd={onDragEnd}
        listening={mode === 'layout'} 
      />
      <KonvaText 
        x={x + width/2 - 24} 
        y={y + height/2 - 54} 
        text={roleConfig.icon} 
        fontSize={48} 
        fill={roleConfig.color} 
        listening={false} 
      />
      <KonvaText 
        x={x + width/2} 
        y={y + height/2} 
        text={roleConfig.label} 
        fontSize={16} 
        fill="#374151" 
        align="center" 
        offsetX={roleConfig.label.length * 4} 
        listening={false} 
      />
      <KonvaText 
        x={x + width/2 - 70} 
        y={y + height/2 + 20} 
        text="(No asset)" 
        fontSize={12} 
        fill="#9ca3af" 
        listening={false} 
      />
      <KonvaText 
        x={x + width/2 - 60} 
        y={y + height/2 + 38} 
        text="Click to assign →" 
        fontSize={11} 
        fill="#3b82f6" 
        fontStyle="italic"
        listening={false} 
      />
    </>
  );
};

const ThumbnailComposer = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState(null);
  const [composition, setComposition] = useState(null);
  const [template, setTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetMap, setAssetMap] = useState({});
  const [selectedFormat, setSelectedFormat] = useState('youtube_hero');
  const [mode, setMode] = useState('layout');
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showGenerateMenu, setShowGenerateMenu] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [processingAsset, setProcessingAsset] = useState(null); // { assetId, type: 'bg_removal' | 'enhancement' }
  const [processingStatus, setProcessingStatus] = useState({}); // { [assetId]: { bg_removed, enhanced, status } }
  const [slotPositions, setSlotPositions] = useState({}); // { [role]: { x, y, width, height } }
  const [isDragging, setIsDragging] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0); // Force re-render on format change
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5 to 1.5
  const [selectedSlotIds, setSelectedSlotIds] = useState([]); // Multi-select support
  const [snapToGrid, setSnapToGrid] = useState(true); // Snap-to-grid toggle
  const [showGuides, setShowGuides] = useState(true); // Alignment guides toggle
  const [lockedSlots, setLockedSlots] = useState(new Set()); // Locked slots
  const [hiddenSlots, setHiddenSlots] = useState(new Set()); // Hidden slots
  const [history, setHistory] = useState([{}]); // Undo/redo history
  const [historyIndex, setHistoryIndex] = useState(0);
  const [clipboard, setClipboard] = useState(null); // Copy/paste support
  const [previewMode, setPreviewMode] = useState(false); // Hide UI for preview
  const [backgroundOpacity, setBackgroundOpacity] = useState(1); // Background opacity (0.5 to 1)
  const selectedShapeRef = React.useRef();
  const transformerRef = React.useRef();
  const stageRef = React.useRef();
  
  const currentFormat = THUMBNAIL_FORMATS[selectedFormat];
  const availableWidth = Math.max(window.innerWidth - 800, 400);
  const availableHeight = Math.max(window.innerHeight - 300, 300);
  const baseScale = Math.max(Math.min(availableWidth / currentFormat.width, availableHeight / currentFormat.height, 1), 0.3);
  const canvasScale = baseScale * zoomLevel;
  
  // Force canvas re-render when format changes
  useEffect(() => {
    setCanvasKey(prev => prev + 1);
    setSelectedSlotId(null); // Deselect on format change
    
    // Clear background position - it should always match canvas
    setSlotPositions(prev => {
      const { 'BG.MAIN': _, ...rest } = prev;
      return rest;
    });
    
    // Auto-save format selection to backend
    if (composition?.id) {
      saveFormatSelection(selectedFormat);
    }
  }, [selectedFormat]);
  
  useEffect(() => { loadEpisodeAndComposition(); }, [episodeId]);
  
  // Check processing status only for selected slot asset (performance optimization)
  useEffect(() => {
    if (selectedSlotId && template && assetMap[selectedSlotId]) {
      const asset = assets.find(a => {
        const assetUrl = a.s3_url_enhanced || a.s3_url_no_bg || a.s3_url_raw || a.s3_url || a.metadata?.thumbnail_url;
        return assetUrl === assetMap[selectedSlotId];
      });
      if (asset) {
        checkProcessingStatus(asset.id);
      }
    }
  }, [selectedSlotId, assetMap, assets, template]);
  
  // Update transformer when selection changes
  useEffect(() => {
    if (mode === 'layout' && selectedSlotId && transformerRef.current && selectedShapeRef.current) {
      const nodes = transformerRef.current.nodes();
      // Only update if the node actually changed
      if (nodes.length === 0 || nodes[0] !== selectedShapeRef.current) {
        transformerRef.current.nodes([selectedShapeRef.current]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      // Detach transformer if no selection or not in layout mode
      const nodes = transformerRef.current.nodes();
      if (nodes.length > 0) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedSlotId, mode]);
  
  useEffect(() => {
    if (composition?.status === 'PROCESSING' && !isPolling) {
      setIsPolling(true);
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/compositions/${composition.id}`);
          if (!res.ok) throw new Error('Poll failed');
          const response = await res.json();
          const data = response.data || response;
          if (data.status === 'COMPLETED' || data.status === 'FAILED') { 
            setComposition(data); 
            setIsPolling(false); 
            clearInterval(interval);
            if (data.status === 'COMPLETED') {
              alert('✅ Thumbnail generated successfully!');
            }
          }
        } catch (err) { clearInterval(interval); setIsPolling(false); }
      }, 2000);
      return () => { clearInterval(interval); setIsPolling(false); };
    }
  }, [composition?.status, composition?.id, isPolling]);
  
  const loadEpisodeAndComposition = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const episodeRes = await fetch(`/api/v1/episodes/${episodeId}`);
      if (!episodeRes.ok) throw new Error('Failed to load episode');
      const episodeResponse = await episodeRes.json();
      const episodeData = episodeResponse.data || episodeResponse;
      setEpisode(episodeData);
      
      console.log('🔍 Episode data:', episodeData);
      
      // ✅ Use episodeId from URL params (UUID) - compositions table uses UUID
      console.log('🔍 Fetching compositions for episode UUID:', episodeId);
      const compositionsRes = await fetch(`/api/v1/compositions/episode/${episodeId}`);
      console.log('🔍 Compositions response status:', compositionsRes.status);
      let existingComposition = null;
      
      if (compositionsRes.ok) {
        const compositionsResponse = await compositionsRes.json();
        console.log('🔍 Compositions response:', compositionsResponse);
        const compositionsData = compositionsResponse.data || compositionsResponse;
        const compositionsList = Array.isArray(compositionsData) ? compositionsData : [compositionsData];
        console.log('🔍 Compositions list:', compositionsList);
        // Find first non-failed composition, or just the first one if all failed
        existingComposition = compositionsList.find(c => c.status !== 'FAILED') || compositionsList[0];
        console.log('🔍 Selected composition:', existingComposition);
      }
      
      if (!existingComposition) {
        await loadAvailableTemplates();
        await loadAvailableAssets(episodeData);
        if (!silent) setLoading(false);
        return;
      }
      
      setComposition(existingComposition);
      
      // Restore saved slot positions from composition_config
      if (existingComposition.composition_config?.slotPositions) {
        setSlotPositions(existingComposition.composition_config.slotPositions);
        console.log('💾 Restored saved slot positions:', existingComposition.composition_config.slotPositions);
      }
      
      // Restore background opacity
      if (existingComposition.composition_config?.backgroundOpacity !== undefined) {
        setBackgroundOpacity(existingComposition.composition_config.backgroundOpacity);
        console.log('💾 Restored background opacity:', existingComposition.composition_config.backgroundOpacity);
      }
      
      // Restore selected format
      if (existingComposition.composition_config?.selectedFormat) {
        setSelectedFormat(existingComposition.composition_config.selectedFormat);
        console.log('💾 Restored selected format:', existingComposition.composition_config.selectedFormat);
      }
      
      const templateId = existingComposition.template_studio_id || existingComposition.template_id;
      if (templateId) {
        const templateRes = await fetch(`/api/v1/template-studio/${templateId}`);
        if (!templateRes.ok) throw new Error('Failed to load template');
        const templateResponse = await templateRes.json();
        const templateData = templateResponse.data || templateResponse;
        setTemplate(templateData);
        await buildAssetMap(existingComposition);
        await loadAvailableAssets(episodeData);
      } else {
        await loadAvailableTemplates();
        await loadAvailableAssets(episodeData);
      }
      if (!silent) setLoading(false);
    } catch (err) {
      setError(err.message);
      if (!silent) setLoading(false);
    }
  };
  
  const loadAvailableTemplates = async () => {
    try {
      const res = await fetch('/api/v1/template-studio');
      if (!res.ok) return;
      const response = await res.json();
      const data = response.data || response;
      const templatesList = Array.isArray(data) ? data : [data];
      const publishedTemplates = templatesList.filter(t => t.status === 'PUBLISHED' || t.status === 'LOCKED');
      setTemplates(publishedTemplates);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };
  
  const loadAvailableAssets = async (episodeData) => {
    try {
      // ✅ FIX: Use passed episode data or state
      const ep = episodeData || episode;
      if (!ep?.id) {
        console.log('⚠️ Cannot load assets: episode not loaded yet');
        return;
      }
      
      console.log('📦 Loading assets for episode ID:', ep.id);
      const res = await fetch(`/api/v1/episodes/${ep.id}/assets`);
      console.log('📦 Assets response status:', res.status);
      
      if (!res.ok) {
        console.log('⚠️ Assets endpoint returned:', res.status);
        return;
      }
      
      const response = await res.json();
      console.log('📦 Assets response:', response);
      const data = response.data || response;
      const assetsList = Array.isArray(data) ? data : [data];
      console.log('✅ Assets loaded:', assetsList.length);
      setAssets(assetsList);
    } catch (err) {
      console.error('❌ Error loading assets:', err);
    }
  };
  
  const handleTemplateSelect = async (selectedTemplateId) => {
    try {
      console.log('🎯 Template selection started:', selectedTemplateId);
      console.log('📋 Current composition:', composition);
      setIsCreating(true);
      
      if (!composition) {
        console.log('✨ Creating NEW composition...');
        const createRes = await fetch('/api/v1/compositions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            episode_id: episodeId,  // ✅ Use UUID from URL params
            template_studio_id: selectedTemplateId,
            assets: {},
            composition_config: {},
            selected_formats: [selectedFormat]
          })
        });
        
        if (!createRes.ok) {
          const errorText = await createRes.text();
          console.error('❌ Create failed:', createRes.status, errorText);
          throw new Error(`Failed to create composition (${createRes.status}): ${errorText}`);
        }
        
        console.log('✅ Composition created, reloading...');
        // ✅ Composition created - just reload, don't parse response
        await loadEpisodeAndComposition(true);
        console.log('✅ Reload complete');
        console.log('📋 New composition state:', composition);
        console.log('📐 New template state:', template);
        setShowTemplateSelector(false);
        setIsCreating(false);
        
      } else {
        // Composition exists - update its template
        console.log('🔄 Updating existing composition with template:', selectedTemplateId);
        const updateRes = await fetch(`/api/v1/compositions/${composition.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_studio_id: selectedTemplateId
          })
        });
        
        if (!updateRes.ok) {
          const errorText = await updateRes.text();
          console.error('❌ Update failed:', updateRes.status, errorText);
          throw new Error(`Failed to update composition (${updateRes.status}): ${errorText}`);
        }
        
        await loadEpisodeAndComposition(true);
        setShowTemplateSelector(false);
        setIsCreating(false);
      }
      
    } catch (err) {
      alert('Failed to select template: ' + err.message);
      setError(err.message);
      setIsCreating(false);
    }
  };
  
  const handleAssetAssignment = async (assetId) => {
    try {
      console.log('🎯 ASSET ASSIGNMENT STARTED');
      console.log('🎯 Selected slot ID:', selectedSlotId);
      console.log('🎯 Asset ID:', assetId);
      console.log('🎯 Composition:', composition);
      console.log('🎯 Composition ID:', composition?.id);
      
      if (!selectedSlotId || !composition) {
        console.error('❌ Missing required data:', { selectedSlotId, composition: !!composition });
        return;
      }
      
      const requestBody = {
        asset_id: assetId,
        role: selectedSlotId
      };
      console.log('📤 POST /api/v1/compositions/' + composition.id + '/assets');
      console.log('📤 Request body:', requestBody);
      
      const updateRes = await fetch(`/api/v1/compositions/${composition.id}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 Response status:', updateRes.status);
      
      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error('❌ Assignment failed:', errorText);
        throw new Error('Failed to assign asset');
      }
      
      const responseData = await updateRes.json();
      console.log('✅ Assignment response:', responseData);
      
      setShowAssetPicker(false);
      console.log('🔄 Reloading composition...');
      await loadEpisodeAndComposition(true);
      console.log('✅ Reload complete');
      
    } catch (err) {
      console.error('❌ Asset assignment error:', err);
      alert('Failed to assign asset: ' + err.message);
    }
  };
  
  const handleGenerate = async () => {
    try {
      if (!composition) return;
      
      setIsGenerating(true);
      
      const generateRes = await fetch(`/api/v1/compositions/${composition.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formats: [selectedFormat]
        })
      });
      
      if (!generateRes.ok) throw new Error('Failed to start generation');
      
      const generateResponse = await generateRes.json();
      const updatedComposition = generateResponse.data || generateResponse;
      setComposition(updatedComposition);
      setIsGenerating(false);
      
    } catch (err) {
      setIsGenerating(false);
      alert('Failed to generate thumbnail: ' + err.message);
    }
  };
  
  const handleGenerateAllFormats = async () => {
    if (!confirm('Generate thumbnails for all formats (YouTube Hero, YouTube Thumbnail, Instagram Square, Instagram Story)?')) return;
    
    try {
      if (!composition) return;
      
      setIsGenerating(true);
      const allFormats = Object.keys(THUMBNAIL_FORMATS);
      
      const generateRes = await fetch(`/api/v1/compositions/${composition.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formats: allFormats
        })
      });
      
      if (!generateRes.ok) throw new Error('Failed to start batch generation');
      
      const generateResponse = await generateRes.json();
      const updatedComposition = generateResponse.data || generateResponse;
      setComposition(updatedComposition);
      setIsGenerating(false);
      
      alert(`✅ Generating ${allFormats.length} formats! Check back in a moment.`);
      
    } catch (err) {
      setIsGenerating(false);
      alert('Failed to generate thumbnails: ' + err.message);
    }
  };
  
  const buildAssetMap = async (compData) => {
    try {
      console.log('🗺️ BUILDING ASSET MAP');
      console.log('🗺️ Composition ID:', compData?.id);
      
      const map = {};
      const compositionAssets = compData.composition_assets || compData.compositionAssets || [];
      
      console.log('🗺️ Found', compositionAssets.length, 'composition assets to process');
      
      for (const ca of compositionAssets) {
        if (ca.asset) {
          const role = ca.asset_role || ca.role;
          
          // ✅ PRIORITY ORDER: Enhanced → No BG → Raw → Fallback → Thumbnail (last resort)
          const assetUrl = 
            ca.asset.s3_url_enhanced ||           // Enhanced (best quality)
            ca.asset.s3_url_no_bg ||              // Background removed
            ca.asset.s3_url_raw ||                // Raw original (FULL RESOLUTION)
            ca.asset.s3_url ||                    // Fallback
            ca.asset.metadata?.thumbnail_url;     // Thumbnail (LOW RES - last resort)
          
          console.log('🗺️ Asset URL priority for', role, ':', {
            enhanced: !!ca.asset.s3_url_enhanced,
            no_bg: !!ca.asset.s3_url_no_bg,
            thumbnail: !!ca.asset.metadata?.thumbnail_url,
            selected: assetUrl?.substring(0, 50)
          });
          
          if (role && assetUrl) {
            map[role] = assetUrl;
            console.log(`✅ Mapped: ${role} → ${assetUrl.substring(0, 30)}...`);
          }
        }
      }
      
      console.log('✅ FINAL ASSET MAP:', Object.keys(map));
      setAssetMap(map);
    } catch (err) { 
      console.error('❌ Error building asset map:', err); 
    }
  };
  
  const handleRemoveBackground = async (assetId) => {
    try {
      console.log('🎨 Removing background for asset:', assetId);
      setProcessingAsset({ assetId, type: 'bg_removal' });
      
      const response = await fetch(`/api/v1/assets/${assetId}/remove-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to remove background: ${error}`);
      }
      
      const result = await response.json();
      console.log('✅ Background removed:', result);
      
      setProcessingStatus(prev => ({
        ...prev,
        [assetId]: { ...prev[assetId], bg_removed: true, status: 'bg_removed' }
      }));
      
      await loadEpisodeAndComposition(true);
      alert('✅ Background removed successfully!');
      
    } catch (error) {
      console.error('❌ Background removal error:', error);
      alert('Failed to remove background: ' + error.message);
    } finally {
      setProcessingAsset(null);
    }
  };
  
  const handleEnhanceImage = async (assetId, settings = {}) => {
    try {
      console.log('✨ Enhancing image for asset:', assetId);
      setProcessingAsset({ assetId, type: 'enhancement' });
      
      const response = await fetch(`/api/v1/assets/${assetId}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skin_smooth: settings.skinSmooth || 50,
          saturation: settings.saturation || 20,
          vibrance: settings.vibrance || 20,
          contrast: settings.contrast || 10,
          sharpen: settings.sharpen || 20
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to enhance image: ${error}`);
      }
      
      const result = await response.json();
      console.log('✅ Image enhanced:', result);
      
      setProcessingStatus(prev => ({
        ...prev,
        [assetId]: { ...prev[assetId], enhanced: true, status: 'enhanced' }
      }));
      
      await loadEpisodeAndComposition(true);
      alert('✅ Image enhanced successfully!');
      
    } catch (error) {
      console.error('❌ Enhancement error:', error);
      alert('Failed to enhance image: ' + error.message);
    } finally {
      setProcessingAsset(null);
    }
  };
  
  const checkProcessingStatus = async (assetId) => {
    try {
      const response = await fetch(`/api/v1/assets/${assetId}/processing-status`);
      if (!response.ok) return;
      
      const result = await response.json();
      const data = result.data || result;
      
      setProcessingStatus(prev => ({
        ...prev,
        [assetId]: {
          bg_removed: data.has_bg_removed,
          enhanced: data.has_enhanced,
          status: data.processing_status
        }
      }));
    } catch (error) {
      console.error('Error checking processing status:', error);
    }
  };
  
  const getMappedCount = () => Object.keys(assetMap).length;
  const getRequiredCount = () => template ? template.role_slots.filter(s => s.required).length : 0;
  const getRequiredMappedCount = () => template ? template.role_slots.filter(s => s.required && assetMap[s.role]).length : 0;
  const getUnmappedRoles = () => template ? template.role_slots.filter(s => !assetMap[s.role]).map(s => ({ role: s.role, required: s.required })) : [];
  
  // ===== ZOOM CONTROLS =====
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 1.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoomLevel(1);
  const handleFitToScreen = () => setZoomLevel(1);
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.5, Math.min(1.5, newScale / baseScale));
    setZoomLevel(clampedScale);
  };
  
  // ===== SNAP TO GRID =====
  const applySnapToGrid = (value) => snapToGrid ? Math.round(value / 10) * 10 : value;
  
  // ===== SMART GUIDES & SNAPPING =====
  const getGuideLines = () => {
    const width = currentFormat.width;
    const height = currentFormat.height;
    const snapThreshold = 15; // Pixels to snap
    
    return {
      // Rule of thirds (4 intersection points)
      vertical: [
        { position: width / 3, label: 'Left Third' },
        { position: width / 2, label: 'Center' },
        { position: (width * 2) / 3, label: 'Right Third' }
      ],
      horizontal: [
        { position: height / 3, label: 'Top Third' },
        { position: height / 2, label: 'Middle' },
        { position: (height * 2) / 3, label: 'Bottom Third' }
      ],
      // Platform safe zones (format-specific)
      safeZones: getSafeZones(selectedFormat, width, height),
      snapThreshold
    };
  };
  
  const getSafeZones = (format, width, height) => {
    // Format-specific safe zones
    if (format === 'youtube_hero' || format === 'youtube_thumbnail') {
      return [
        { type: 'avoid', x: 0, y: height - 80, w: 120, h: 80, label: 'Time stamp' },
        { type: 'avoid', x: width - 150, y: height - 100, w: 150, h: 100, label: 'More videos' },
        { type: 'avoid', x: 0, y: 0, w: 100, h: 100, label: 'Channel icon' }
      ];
    } else if (format === 'instagram_square' || format === 'instagram_story') {
      return [
        { type: 'avoid', x: 0, y: 0, w: 80, h: 80, label: 'Profile' },
        { type: 'avoid', x: width - 80, y: 0, w: 80, h: 80, label: 'Menu' },
        { type: 'safe', x: width * 0.1, y: height * 0.2, w: width * 0.8, h: height * 0.6, label: 'Focus area' }
      ];
    }
    return [];
  };
  
  const snapToGuides = (value, type, slotWidth = 0, slotHeight = 0) => {
    if (!showGuides) return value;
    
    const guides = getGuideLines();
    const threshold = guides.snapThreshold;
    
    if (type === 'x') {
      // Snap to vertical guides
      for (const guide of guides.vertical) {
        // Snap left edge
        if (Math.abs(value - guide.position) < threshold) {
          return guide.position;
        }
        // Snap center of slot
        if (Math.abs((value + slotWidth / 2) - guide.position) < threshold) {
          return guide.position - slotWidth / 2;
        }
        // Snap right edge
        if (Math.abs((value + slotWidth) - guide.position) < threshold) {
          return guide.position - slotWidth;
        }
      }
    } else if (type === 'y') {
      // Snap to horizontal guides
      for (const guide of guides.horizontal) {
        // Snap top edge
        if (Math.abs(value - guide.position) < threshold) {
          return guide.position;
        }
        // Snap center of slot
        if (Math.abs((value + slotHeight / 2) - guide.position) < threshold) {
          return guide.position - slotHeight / 2;
        }
        // Snap bottom edge
        if (Math.abs((value + slotHeight) - guide.position) < threshold) {
          return guide.position - slotHeight;
        }
      }
    }
    
    return value;
  };
  
  // ===== HISTORY / UNDO-REDO =====
  const saveHistory = (newPositions) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPositions);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSlotPositions(history[historyIndex - 1]);
    }
  };
  
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSlotPositions(history[historyIndex + 1]);
    }
  };
  
  // ===== LAYER CONTROLS =====
  const handleBringToFront = (slotRole) => {
    console.log(`⬆️ Bringing ${slotRole} to front`);
    // Would need to update template z_index in backend
  };
  
  const handleSendToBack = (slotRole) => {
    console.log(`⬇️ Sending ${slotRole} to back`);
    // Would need to update template z_index in backend
  };
  
  const toggleLockSlot = (slotRole) => {
    setLockedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotRole)) {
        newSet.delete(slotRole);
      } else {
        newSet.add(slotRole);
      }
      return newSet;
    });
  };
  
  const toggleHideSlot = (slotRole) => {
    setHiddenSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotRole)) {
        newSet.delete(slotRole);
      } else {
        newSet.add(slotRole);
      }
      return newSet;
    });
  };
  
  // ===== COPY/PASTE =====
  const handleCopy = () => {
    if (selectedSlotId && slotPositions[selectedSlotId]) {
      setClipboard(slotPositions[selectedSlotId]);
      console.log('📋 Copied slot position');
    }
  };
  
  const handlePaste = () => {
    if (selectedSlotId && clipboard) {
      const newPositions = {
        ...slotPositions,
        [selectedSlotId]: clipboard
      };
      setSlotPositions(newPositions);
      saveHistory(newPositions);
      console.log('📋 Pasted slot position');
    }
  };
  
  // ===== MULTI-SELECT =====
  const handleMultiSelect = (slotId, ctrlPressed) => {
    if (ctrlPressed) {
      setSelectedSlotIds(prev => 
        prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
      );
    } else {
      setSelectedSlotIds([slotId]);
      setSelectedSlotId(slotId);
    }
  };
  
  // ===== POSITION PERSISTENCE =====
  const saveFormatSelection = async (format) => {
    if (!composition?.id) return;
    
    try {
      await fetch(`/api/v1/compositions/${composition.id}/slot-positions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          selectedFormat: format,
          // Keep existing config
          slotPositions: slotPositions,
          backgroundOpacity: backgroundOpacity
        })
      });
      console.log('💾 Auto-saved format selection:', format);
    } catch (err) {
      console.error('Failed to save format selection:', err);
    }
  };
  
  // ===== PRESET SIZING =====
  const PRESET_SIZES = {
    instagram_feed: { width: 400, height: 400, label: 'Instagram Feed (1:1)' },
    instagram_story: { width: 338, height: 600, label: 'Instagram Story (9:16)' },
    instagram_reel: { width: 338, height: 600, label: 'Instagram Reel (9:16)' },
    youtube_lower_third: { width: 1200, height: 150, label: 'YouTube Lower Third' },
    tiktok: { width: 338, height: 600, label: 'TikTok (9:16)' },
    twitter_card: { width: 640, height: 360, label: 'Twitter Card (16:9)' },
    youtube_banner: { width: 1000, height: 200, label: 'YouTube Banner' },
    square_small: { width: 300, height: 300, label: 'Small Square' },
    square_large: { width: 600, height: 600, label: 'Large Square' }
  };
  
  const handleApplyPresetSize = (presetKey) => {
    if (!selectedSlotId || selectedSlotId === 'BG.MAIN') return;
    
    const preset = PRESET_SIZES[presetKey];
    if (!preset) {
      console.error('Preset not found:', presetKey);
      return;
    }
    
    const slot = template?.role_slots.find(s => s.role === selectedSlotId);
    if (!slot) {
      console.error('Slot not found:', selectedSlotId);
      return;
    }
    
    // Scale preset to fit canvas if needed
    const canvasWidth = currentFormat.width;
    const canvasHeight = currentFormat.height;
    let newWidth = preset.width;
    let newHeight = preset.height;
    
    console.log('📐 Applying preset:', { 
      preset: preset.label, 
      original: { width: newWidth, height: newHeight },
      canvas: { width: canvasWidth, height: canvasHeight }
    });
    
    // If preset is larger than canvas, scale it down
    if (newWidth > canvasWidth * 0.9 || newHeight > canvasHeight * 0.9) {
      const scale = Math.min(
        (canvasWidth * 0.9) / newWidth,
        (canvasHeight * 0.9) / newHeight
      );
      newWidth = Math.round(newWidth * scale);
      newHeight = Math.round(newHeight * scale);
      console.log('📐 Scaled down:', { width: newWidth, height: newHeight, scale });
    }
    
    // Get current position or fall back to template defaults
    const currentPos = slotPositions[selectedSlotId];
    const currentX = currentPos?.x ?? slot.position?.x ?? slot.x ?? 0;
    const currentY = currentPos?.y ?? slot.position?.y ?? slot.y ?? 0;
    const currentWidth = currentPos?.width ?? slot.position?.width ?? slot.width ?? 100;
    const currentHeight = currentPos?.height ?? slot.position?.height ?? slot.height ?? 100;
    
    console.log('📐 Current slot state:', { x: currentX, y: currentY, width: currentWidth, height: currentHeight });
    
    // Keep center point the same
    const centerX = currentX + currentWidth / 2;
    const centerY = currentY + currentHeight / 2;
    const newX = centerX - newWidth / 2;
    const newY = centerY - newHeight / 2;
    
    console.log('📐 New position (centered):', { x: newX, y: newY });
    
    const newPositions = {
      ...slotPositions,
      [selectedSlotId]: {
        x: Math.max(0, Math.min(newX, canvasWidth - newWidth)),
        y: Math.max(0, Math.min(newY, canvasHeight - newHeight)),
        width: newWidth,
        height: newHeight
      }
    };
    
    setSlotPositions(newPositions);
    saveHistory(newPositions);
    
    console.log('✅ Applied preset:', newPositions[selectedSlotId]);
  };
  
  const handleResetToDefault = () => {
    if (!selectedSlotId || selectedSlotId === 'BG.MAIN') return;
    
    const newPositions = { ...slotPositions };
    delete newPositions[selectedSlotId];
    
    setSlotPositions(newPositions);
    saveHistory(newPositions);
    
    console.log('🔄 Reset slot to template default:', selectedSlotId);
  };
  
  const handleRemoveAsset = async (slotRole) => {
    if (!composition?.id || !slotRole) {
      console.error('❌ Cannot remove asset - missing composition or slotRole:', { composition: composition?.id, slotRole });
      return;
    }
    
    if (!confirm(`Remove asset from ${slotRole}?`)) return;
    
    try {
      const url = `/api/v1/compositions/${composition.id}/assets/${slotRole}`;
      console.log('🗑️ Attempting to delete asset:', url);
      
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🗑️ Delete response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      console.log('🗑️ Delete response:', data);
      
      // Reload composition to refresh asset map
      console.log('🔄 Reloading composition...');
      await loadEpisodeAndComposition(true);
      
      console.log('✅ Asset removed successfully from slot:', slotRole);
      alert(`Asset removed from ${slotRole}`);
    } catch (err) {
      console.error('❌ Failed to remove asset:', err);
      alert('Failed to remove asset: ' + err.message);
    }
  };
  
  const handleSavePositions = async () => {
    if (!composition) return;
    
    try {
      // Exclude background from saved positions - it always matches canvas
      const { 'BG.MAIN': _, ...positionsToSave } = slotPositions;
      
      const res = await fetch(`/api/v1/compositions/${composition.id}/slot-positions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slotPositions: positionsToSave,
          backgroundOpacity: backgroundOpacity,
          selectedFormat: selectedFormat
        })
      });
      
      if (!res.ok) throw new Error('Failed to save positions');
      alert('✅ Slot positions saved!');
    } catch (err) {
      console.error('Save positions error:', err);
      alert('❌ Failed to save positions');
    }
  };
  
  const handleResetPositions = () => {
    if (confirm('Reset all slot positions to template defaults?')) {
      setSlotPositions({});
      saveHistory({});
      alert('✅ Positions reset!');
    }
  };
  
  // ===== KEYBOARD SHORTCUTS =====
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // F key - Toggle Focus Mode
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFocusMode(prev => !prev);
        return;
      }
      
      // Escape - Exit Focus Mode
      if (e.key === 'Escape' && focusMode) {
        e.preventDefault();
        setFocusMode(false);
        return;
      }
      
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const nudgeAmount = shift ? 10 : 1;
      
      // Arrow keys - nudge selected slot
      if (selectedSlotId && mode === 'layout' && !lockedSlots.has(selectedSlotId)) {
        const currentPos = slotPositions[selectedSlotId] || {};
        const slot = template?.role_slots.find(s => s.role === selectedSlotId);
        if (!slot) return;
        
        let newX = currentPos.x ?? slot.position?.x ?? slot.x;
        let newY = currentPos.y ?? slot.position?.y ?? slot.y;
        
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          newX -= nudgeAmount;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          newX += nudgeAmount;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          newY -= nudgeAmount;
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          newY += nudgeAmount;
        }
        
        if (e.key.startsWith('Arrow')) {
          const newPositions = {
            ...slotPositions,
            [selectedSlotId]: { ...currentPos, x: newX, y: newY }
          };
          setSlotPositions(newPositions);
          saveHistory(newPositions);
        }
      }
      
      // Delete key - clear slot
      if (e.key === 'Delete' && selectedSlotId) {
        e.preventDefault();
        handleRemoveAsset(selectedSlotId);
      }
      
      // Ctrl+Z / Cmd+Z - Undo
      if (ctrlOrCmd && e.key === 'z' && !shift) {
        e.preventDefault();
        handleUndo();
      }
      
      // Ctrl+Y / Cmd+Shift+Z - Redo
      if ((ctrlOrCmd && e.key === 'y') || (ctrlOrCmd && shift && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
      
      // Ctrl+C / Cmd+C - Copy
      if (ctrlOrCmd && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      }
      
      // Ctrl+V / Cmd+V - Paste
      if (ctrlOrCmd && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSlotId, slotPositions, mode, template, lockedSlots, historyIndex, history]);
  
  const handleSlotSelect = (slotId, e) => { 
    if (mode === 'layout') {
      const ctrlPressed = e?.evt?.ctrlKey || e?.evt?.metaKey;
      if (ctrlPressed) {
        handleMultiSelect(slotId, true);
      } else {
        setSelectedSlotId(selectedSlotId === slotId ? null : slotId);
        setSelectedSlotIds([slotId]);
      }
    }
  };
  
  const handleSlotDragEnd = (slotRole, e) => {
    if (mode !== 'layout' || lockedSlots.has(slotRole)) return;
    
    // Background always matches canvas - prevent dragging
    if (slotRole === 'BG.MAIN') return;
    
    const node = e.target;
    let newX = node.x();
    let newY = node.y();
    
    // Apply smart guide snapping first (takes priority)
    newX = snapToGuides(newX, 'x', node.width(), node.height());
    newY = snapToGuides(newY, 'y', node.width(), node.height());
    
    // Then apply grid snapping if enabled
    if (snapToGrid) {
      newX = Math.round(newX / 10) * 10;
      newY = Math.round(newY / 10) * 10;
    }
    
    node.x(newX);
    node.y(newY);
    
    const newPositions = {
      ...slotPositions,
      [slotRole]: {
        ...slotPositions[slotRole],
        x: newX,
        y: newY
      }
    };
    
    setSlotPositions(newPositions);
    saveHistory(newPositions);
    
    console.log(`🎯 Slot ${slotRole} dragged to:`, { x: newX, y: newY });
  };
  
  const handleSlotTransformEnd = (slotRole, e) => {
    if (mode !== 'layout' || lockedSlots.has(slotRole)) return;
    
    // Background always matches canvas - prevent manual resize
    if (slotRole === 'BG.MAIN') return;
    
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // Reset scale and apply to width/height instead
    node.scaleX(1);
    node.scaleY(1);
    
    const newWidth = Math.max(50, node.width() * scaleX);
    const newHeight = Math.max(50, node.height() * scaleY);
    
    const newPositions = {
      ...slotPositions,
      [slotRole]: {
        x: node.x(),
        y: node.y(),
        width: newWidth,
        height: newHeight
      }
    };
    
    setSlotPositions(newPositions);
    saveHistory(newPositions);
    
    console.log(`📏 Slot ${slotRole} resized:`, { width: newWidth, height: newHeight });
  };
  
  const handleModeChange = (newMode) => {
    console.log(`🎨 Mode change: ${mode} → ${newMode}`);
    setMode(newMode);
    if (newMode === 'preview') {
      setSelectedSlotId(null); // Deselect in preview mode
    }
  };
  
  
  const renderCanvas = () => {
    if (!template) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280', background: 'white', borderRadius: '8px', maxWidth: '500px' }}>
          <h3 style={{ marginBottom: '1rem' }}>No Template Selected</h3>
          <p style={{ marginBottom: '2rem', color: '#9ca3af' }}>Choose a template to start composing your thumbnail.</p>
          {templates.length > 0 ? (
            <button className="btn btn-primary" onClick={() => setShowTemplateSelector(true)} style={{ marginRight: '1rem' }}>📐 Select Template</button>
          ) : (
            <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>No published templates available</p>
          )}
          <button className="btn btn-secondary" onClick={() => navigate(`/episodes/${episodeId}`)}>← Back to Episode</button>
        </div>
      );
    }
    
    return (
      <Stage 
        ref={stageRef}
        key={canvasKey}
        width={currentFormat.width * canvasScale} 
        height={currentFormat.height * canvasScale} 
        scale={{ x: canvasScale, y: canvasScale }} 
        style={{ 
          background: 'white', 
          boxShadow: mode === 'preview' ? 'none' : '0 4px 6px rgba(0,0,0,0.1)', 
          borderRadius: mode === 'preview' ? '0' : '8px',
          transition: 'all 0.2s ease'
        }}
        onWheel={handleWheel}
        onClick={(e) => {
          // Click on empty canvas to deselect (only in layout mode)
          if (mode === 'layout' && e.target === e.target.getStage()) {
            setSelectedSlotId(null);
            setSelectedSlotIds([]);
          }
        }}
      >
        <Layer>
          {/* Background slot - render first, ALWAYS full canvas */}
          {template.role_slots.filter(s => s.role === 'BG.MAIN' && !hiddenSlots.has(s.role)).map(slot => {
            const assetUrl = assetMap[slot.role];
            const isSelected = selectedSlotId === slot.role;
            
            // Background ALWAYS matches canvas dimensions exactly
            const bgSlot = {
              ...slot,
              x: 0,
              y: 0,
              width: currentFormat.width,
              height: currentFormat.height
            };
            
            return assetUrl ? (
              <SlotImage 
                key={slot.role} 
                slot={bgSlot} 
                assetUrl={assetUrl} 
                mode="preview" // Background always in preview mode (no drag/resize)
                isSelected={isSelected} 
                onSelect={(e) => handleSlotSelect(slot.role, e)}
                onDragEnd={() => {}} // No-op for background
                onTransformEnd={() => {}} // No-op for background
                shapeRef={null} // No transformer for background
                opacity={backgroundOpacity} // Apply opacity control
              />
            ) : (
              <EmptySlot 
                key={slot.role} 
                slot={bgSlot} 
                isSelected={isSelected} 
                onSelect={(e) => handleSlotSelect(slot.role, e)}
                mode="preview" // Background always in preview mode
                onDragEnd={() => {}} // No-op for background
                shapeRef={null} // No transformer for background
              />
            );
          })}
          
          {/* Other slots - render by z-index */}
          {template.role_slots
            .filter(s => s.role !== 'BG.MAIN' && !hiddenSlots.has(s.role))
            .sort((a, b) => (a.z_index || 0) - (b.z_index || 0))
            .map(slot => {
              const assetUrl = assetMap[slot.role];
              const isSelected = selectedSlotId === slot.role;
              const isLocked = lockedSlots.has(slot.role);
              const position = slotPositions[slot.role];
              
              // Use slotPositions if available, otherwise fall back to template
              const adjustedSlot = {
                ...slot,
                x: position?.x ?? slot.position?.x ?? slot.x ?? 0,
                y: position?.y ?? slot.position?.y ?? slot.y ?? 0,
                width: position?.width ?? slot.position?.width ?? slot.width ?? 100,
                height: position?.height ?? slot.position?.height ?? slot.height ?? 100
              };
              
              return assetUrl ? (
                <SlotImage 
                  key={slot.role} 
                  slot={adjustedSlot} 
                  assetUrl={assetUrl} 
                  mode={isLocked ? 'preview' : mode}
                  isSelected={isSelected} 
                  onSelect={(e) => handleSlotSelect(slot.role, e)}
                  onDragEnd={(e) => handleSlotDragEnd(slot.role, e)}
                  onTransformEnd={(e) => handleSlotTransformEnd(slot.role, e)}
                  shapeRef={isSelected ? selectedShapeRef : null}
                />
              ) : (
                <EmptySlot 
                  key={slot.role} 
                  slot={adjustedSlot} 
                  isSelected={isSelected} 
                  onSelect={(e) => handleSlotSelect(slot.role, e)}
                  mode={isLocked ? 'preview' : mode}
                  onDragEnd={(e) => handleSlotDragEnd(slot.role, e)}
                  shapeRef={isSelected ? selectedShapeRef : null}
                />
              );
            })
          }
          
          {/* Transformer for resize handles - only in layout mode */}
          {mode === 'layout' && selectedSlotId && (
            <Transformer
              ref={transformerRef}
              keepRatio={true}
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right'
              ]}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit resize to minimum 50x50
                if (newBox.width < 50 || newBox.height < 50) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          )}
          
          {/* Smart Guide Lines - Rule of Thirds & Safe Zones */}
          {mode === 'layout' && showGuides && (() => {
            const guides = getGuideLines();
            const width = currentFormat.width;
            const height = currentFormat.height;
            
            return (
              <>
                {/* Vertical guide lines (rule of thirds) */}
                {guides.vertical.map((guide, i) => (
                  <Line
                    key={`v-${i}`}
                    points={[guide.position, 0, guide.position, height]}
                    stroke={guide.label === 'Center' ? '#3b82f6' : '#10b981'}
                    strokeWidth={guide.label === 'Center' ? 2 : 1}
                    dash={[10, 5]}
                    opacity={0.5}
                    listening={false}
                  />
                ))}
                
                {/* Horizontal guide lines (rule of thirds) */}
                {guides.horizontal.map((guide, i) => (
                  <Line
                    key={`h-${i}`}
                    points={[0, guide.position, width, guide.position]}
                    stroke={guide.label === 'Middle' ? '#3b82f6' : '#10b981'}
                    strokeWidth={guide.label === 'Middle' ? 2 : 1}
                    dash={[10, 5]}
                    opacity={0.5}
                    listening={false}
                  />
                ))}
                
                {/* Safe zones (format-specific) */}
                {guides.safeZones.map((zone, i) => (
                  <Rect
                    key={`zone-${i}`}
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.h}
                    stroke={zone.type === 'avoid' ? '#ef4444' : '#10b981'}
                    strokeWidth={2}
                    dash={[5, 5]}
                    opacity={0.3}
                    listening={false}
                  />
                ))}
              </>
            );
          })()}
        </Layer>
      </Stage>
    );
  };
  
  if (loading) return (<div className="template-designer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto 1rem' }}></div><p>Loading...</p></div></div>);
  if (error) return (<div className="template-designer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ textAlign: 'center' }}><h2 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Error</h2><p style={{ marginBottom: '1rem' }}>{error}</p><button className="btn btn-primary" onClick={loadEpisodeAndComposition}>Retry</button></div></div>);
  
  const unmappedRoles = getUnmappedRoles();
  const mappedCount = getMappedCount();
  const requiredCount = getRequiredCount();
  const requiredMappedCount = getRequiredMappedCount();
  const totalSlots = template?.role_slots.length || 0;
  const canGenerate = requiredMappedCount === requiredCount;
  
  return (
    <div className="template-designer">
      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !isCreating && setShowTemplateSelector(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>Select Template</h2>
            {isCreating ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" style={{ margin: '0 auto 1rem' }}></div><p>Creating composition...</p></div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {templates.map(t => (
                    <div key={t.id} style={{ border: '2px solid #e5e7eb', borderRadius: '8px', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleTemplateSelect(t.id)} onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{t.name}</h3>
                        <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: '#f3f4f6', borderRadius: '9999px', fontWeight: 500 }}>{t.canvas_format}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{t.role_slots?.length || 0} slots • Version {t.version}</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setShowTemplateSelector(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Asset Picker Modal */}
      {showAssetPicker && selectedSlotId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAssetPicker(false)}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1rem' }}>Select Asset for {CANONICAL_ROLES[selectedSlotId]?.label}</h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Choose an asset to assign to this slot</p>
            {assets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                <p>No assets available for this episode.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAssetPicker(false)}>Close</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {assets.map(asset => {
                    const thumbnailUrl = asset.metadata?.thumbnail_url || asset.s3_url_raw || asset.s3_url;
                    return (
                      <div key={asset.id} style={{ border: '2px solid #e5e7eb', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleAssetAssignment(asset.id)} onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={asset.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem' }} />
                        ) : (
                          <div style={{ width: '100%', height: '120px', background: '#f3f4f6', borderRadius: '4px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No preview</div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name || 'Unnamed'}</p>
                        <p style={{ margin: 0, fontSize: '0.625rem', color: '#9ca3af' }}>{asset.asset_type}</p>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setShowAssetPicker(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="designer-header">
        <div className="header-left">
          <button className="btn btn-secondary" onClick={() => navigate(`/episodes/${episodeId}`)}>← Back</button>
          <div>
            <h1>Thumbnail Composer</h1>
            <div className="header-breadcrumb">
              <span>{episode?.title || 'Episode'}</span>
              {template && <><span>•</span><span>{template.name}</span></>}
              {composition?.status && <><span>•</span><span className={`badge badge-${composition.status.toLowerCase()}`}>{composition.status}</span></>}
            </div>
          </div>
        </div>
        <div className="header-actions">
          {template && (
            <button className="btn btn-secondary" onClick={() => setShowTemplateSelector(true)} disabled={isPolling || isGenerating} style={{ marginRight: '0.5rem' }}>
              🔄 Change Template
            </button>
          )}
          
          {/* Zoom Controls */}
          {template && (
            <div className="btn-group" style={{ marginRight: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleZoomOut} disabled={zoomLevel <= 0.5} title="Zoom Out" style={{ padding: '0.375rem 0.625rem', fontSize: '0.875rem' }}>−</button>
              <button className="btn btn-secondary" onClick={handleZoomReset} title="Reset Zoom" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', minWidth: '55px' }}>{Math.round(zoomLevel * 100)}%</button>
              <button className="btn btn-secondary" onClick={handleZoomIn} disabled={zoomLevel >= 1.5} title="Zoom In" style={{ padding: '0.375rem 0.625rem', fontSize: '0.875rem' }}>+</button>
            </div>
          )}
          
          {/* Undo/Redo Controls */}
          {template && mode === 'layout' && (
            <div className="btn-group" style={{ marginRight: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)" style={{ padding: '0.375rem 0.625rem' }}>↶</button>
              <button className="btn btn-secondary" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)" style={{ padding: '0.375rem 0.625rem' }}>↷</button>
            </div>
          )}
          
          {/* Snap to Grid Toggle */}
          {template && mode === 'layout' && (
            <button 
              className={`btn ${snapToGrid ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setSnapToGrid(!snapToGrid)} 
              title="Snap to Grid (10px)"
              style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            >
              {snapToGrid ? '☑' : '☐'} Grid
            </button>
          )}
          
          {/* Guide Lines Toggle */}
          {template && mode === 'layout' && (
            <button 
              className={`btn ${showGuides ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setShowGuides(!showGuides)} 
              title="Show composition guides (Rule of Thirds, Safe Zones)"
              style={{ marginRight: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            >
              {showGuides ? '☑' : '☐'} Guides
            </button>
          )}
          
          <div className="btn-group">
            <button className={`btn ${mode === 'layout' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleModeChange('layout')} disabled={isPolling || !template || isGenerating} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>Layout</button>
            <button className={`btn ${mode === 'preview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleModeChange('preview')} disabled={isPolling || !template || isGenerating} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>Preview</button>
          </div>
          
          {/* Generate Split Button */}
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleGenerate} 
              disabled={!canGenerate || isPolling || isGenerating}
              style={{ 
                padding: '0.5rem 1.25rem', 
                fontSize: '0.875rem', 
                fontWeight: 600,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0
              }}
            >
              {isPolling ? '⏳ Generating...' : isGenerating ? '⏳ Starting...' : '🎨 Generate'}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowGenerateMenu(!showGenerateMenu)}
              disabled={!canGenerate || isPolling || isGenerating}
              style={{ 
                padding: '0.5rem 0.625rem', 
                borderLeft: '1px solid rgba(255,255,255,0.3)',
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0
              }}
              title="More options"
            >
              ▾
            </button>
            
            {/* Dropdown Menu */}
            {showGenerateMenu && (
              <>
                <div 
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 998
                  }}
                  onClick={() => setShowGenerateMenu(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.25rem',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  minWidth: '200px',
                  zIndex: 999
                }}>
                  <div style={{ padding: '0.25rem' }}>
                    <button
                      onClick={() => {
                        handleGenerate();
                        setShowGenerateMenu(false);
                      }}
                      disabled={!canGenerate || isPolling || isGenerating}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.625rem 0.875rem',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <span>🎨</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>Current Format</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{currentFormat.name}</div>
                      </div>
                    </button>
                    
                    <div style={{ height: '1px', background: '#e5e7eb', margin: '0.25rem 0' }} />
                    
                    <button
                      onClick={() => {
                        handleGenerateAllFormats();
                        setShowGenerateMenu(false);
                      }}
                      disabled={!canGenerate || isPolling || isGenerating}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.625rem 0.875rem',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#1f2937',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <span>🚀</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>All Formats</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Generate all at once</div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="designer-body" style={{ position: 'relative' }}>
        {/* Focus Mode Indicator */}
        {focusMode && (
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 1000,
            background: 'rgba(59, 130, 246, 0.95)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <span>🎯</span>
            <span>Focus Mode</span>
            <span style={{ opacity: 0.8, fontSize: '0.75rem', marginLeft: '0.5rem' }}>Press ESC to exit</span>
          </div>
        )}
        
        {!focusMode && (
        <div className="designer-sidebar left-sidebar">
          <div className="sidebar-section">
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '0.75rem' }}>Output Format</h3>
            <select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)} className="form-select" disabled={isPolling || isGenerating} style={{ fontSize: '0.875rem' }}>
              {Object.entries(THUMBNAIL_FORMATS).map(([key, format]) => <option key={key} value={key}>{format.name} ({format.width}×{format.height})</option>)}
            </select>
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div>Aspect: {currentFormat.aspectRatio}</div>
              <div>Scale: {Math.round(canvasScale * 100)}%</div>
            </div>
          </div>
          
          {/* Background Opacity Control */}
          {template && assetMap['BG.MAIN'] && (
            <div className="sidebar-section">
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '0.75rem' }}>Background</h3>
              <div style={{ padding: '0.75rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                  <span>Opacity</span>
                  <strong style={{ color: '#1f2937' }}>{Math.round(backgroundOpacity * 100)}%</strong>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  value={backgroundOpacity * 100}
                  onChange={(e) => setBackgroundOpacity(e.target.value / 100)}
                  style={{ width: '100%', cursor: 'pointer' }}
                  disabled={isPolling || isGenerating}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Composition Guides Info */}
          {template && mode === 'layout' && showGuides && (
            <div className="sidebar-section">
              <h3>🎯 Composition Guides</h3>
              <div style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #10b981' }}>
                <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: '20px', height: '2px', background: '#10b981', borderRadius: '2px' }}></div>
                    <span><strong>Rule of Thirds</strong></span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#065f46', marginLeft: '1.75rem' }}>
                    Green dashed lines show sweet spots for faces & subjects
                  </div>
                </div>
                
                <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ width: '20px', height: '2px', background: '#3b82f6', borderRadius: '2px' }}></div>
                    <span><strong>Center Lines</strong></span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', marginLeft: '1.75rem' }}>
                    Blue lines mark horizontal & vertical center
                  </div>
                </div>
                
                {(selectedFormat === 'youtube_hero' || selectedFormat === 'youtube_thumbnail') && (
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ width: '20px', height: '12px', border: '2px dashed #ef4444', borderRadius: '2px' }}></div>
                      <span><strong>YouTube Safe Zones</strong></span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#991b1b', marginLeft: '1.75rem' }}>
                      Avoid corners (time, channel icon, more videos)
                    </div>
                  </div>
                )}
                
                {(selectedFormat === 'instagram_square' || selectedFormat === 'instagram_story') && (
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ width: '20px', height: '12px', border: '2px dashed #10b981', borderRadius: '2px' }}></div>
                      <span><strong>Instagram Focus Area</strong></span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#065f46', marginLeft: '1.75rem' }}>
                      Center-weighted, avoid top corners
                    </div>
                  </div>
                )}
                
                <div style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.5rem', 
                  background: '#fffbeb', 
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#92400e'
                }}>
                  💡 Drag elements near guides - they'll snap automatically!
                </div>
              </div>
            </div>
          )}
          
          {!template && templates.length > 0 && (
            <div className="sidebar-section">
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowTemplateSelector(true)}>📐 Select Template</button>
            </div>
          )}
          {template && (
            <div className="sidebar-section">
              <h3>📊 Asset Status</h3>
              
              {/* Overview Stats */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span>Slots Filled:</span>
                  <strong style={{ color: mappedCount > 0 ? '#059669' : '#6b7280' }}>{mappedCount}/{totalSlots}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span>Required Filled:</span>
                  <strong style={{ color: canGenerate ? '#059669' : '#dc2626' }}>{requiredMappedCount}/{requiredCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                  <span>Available Assets:</span>
                  <strong style={{ color: '#3b82f6' }}>{assets.length}</strong>
                </div>
              </div>
              
              {/* Missing Slots Warning */}
              {unmappedRoles.length > 0 && (
                <div style={{ border: '1px solid #fbbf24', background: '#fef3c7', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#92400e', marginBottom: '0.75rem' }}>
                    ⚠️ Empty Slots ({unmappedRoles.length})
                  </h4>
                  <div>{unmappedRoles.map(({ role, required }) => { 
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
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedSlotId(role);
                          setShowAssetPicker(true);
                        }}
                        title="Click to assign asset"
                      >
                        <span style={{ color: config.color, fontSize: '1.25rem' }}>{config.icon}</span>
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
                  })}</div>
                  <div style={{ 
                    marginTop: '0.75rem', 
                    padding: '0.5rem', 
                    background: '#fffbeb', 
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#92400e'
                  }}>
                    💡 Click any slot to assign an asset
                  </div>
                </div>
              )}
              
              {/* Filled Slots Summary */}
              {mappedCount > 0 && (
                <div style={{ border: '1px solid #d1fae5', background: '#d1fae5', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#065f46', marginBottom: '0.75rem' }}>
                    ✅ Assigned Slots ({mappedCount})
                  </h4>
                  <div>{template.role_slots.filter(s => assetMap[s.role]).map(slot => { 
                    const config = CANONICAL_ROLES[slot.role] || {}; 
                    return (
                      <div 
                        key={slot.role} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          padding: '0.5rem', 
                          marginBottom: '0.5rem', 
                          background: 'white', 
                          borderRadius: '6px', 
                          borderLeft: `3px solid ${config.color}`, 
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedSlotId(slot.role)}
                        title="Click to view/edit"
                      >
                        <span style={{ color: config.color, fontSize: '1.25rem' }}>{config.icon}</span>
                        <span style={{ flex: 1 }}>{config.label}</span>
                        <span style={{ fontSize: '0.75rem', color: '#059669' }}>●</span>
                      </div>
                    );
                  })}</div>
                </div>
              )}
              
              {canGenerate && (
                <div style={{ padding: '0.75rem', background: '#d1fae5', border: '1px solid #059669', borderRadius: '6px', color: '#065f46', fontSize: '0.875rem', textAlign: 'center' }}>
                  ✅ Ready to generate!
                </div>
              )}
            </div>
          )}
          
          {/* Slot Visibility Controls */}
          {template && mode === 'layout' && (
            <div className="sidebar-section">
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '0.75rem' }}>👁️ Slot Visibility</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {template.role_slots.filter(s => s.role !== 'BG.MAIN').map(slot => {
                  const config = CANONICAL_ROLES[slot.role] || {};
                  const isHidden = hiddenSlots.has(slot.role);
                  const hasAsset = !!assetMap[slot.role];
                  
                  return (
                    <button
                      key={slot.role}
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'flex-start',
                        background: isHidden ? '#f3f4f6' : 'white',
                        opacity: isHidden ? 0.6 : 1,
                        textDecoration: isHidden ? 'line-through' : 'none'
                      }}
                      onClick={() => toggleHideSlot(slot.role)}
                      title={isHidden ? 'Click to show' : 'Click to hide'}
                    >
                      <span style={{ fontSize: '1rem' }}>{isHidden ? '👁️‍🗨️' : '👁️'}</span>
                      <span style={{ fontSize: '1rem' }}>{config.icon}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{config.label}</span>
                      {hasAsset && <span style={{ fontSize: '0.625rem', color: '#059669' }}>●</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.75rem', 
                color: '#6b7280', 
                textAlign: 'center' 
              }}>
                💡 Hidden slots won't appear in generated thumbnails
              </div>
            </div>
          )}
          
          {/* Position Management */}
          {template && mode === 'layout' && (
            <div className="sidebar-section">
              <h3>💾 Position Management</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  onClick={handleSavePositions}
                  disabled={Object.keys(slotPositions).length === 0}
                >
                  💾 Save Positions
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%' }}
                  onClick={handleResetPositions}
                  disabled={Object.keys(slotPositions).length === 0}
                >
                  🔄 Reset to Defaults
                </button>
                <div style={{ 
                  marginTop: '0.5rem', 
                  padding: '0.5rem', 
                  background: '#fffbeb', 
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#92400e'
                }}>
                  💡 <strong>Tips:</strong>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                    <li>Arrow keys: Nudge 1px</li>
                    <li>Shift+Arrow: Nudge 10px</li>
                    <li>Ctrl+C/V: Copy/Paste</li>
                    <li>Delete: Clear slot</li>
                    <li>Ctrl+Z/Y: Undo/Redo</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
        <div className="designer-canvas">
          {mode === 'layout' && (
            <div className="canvas-controls">
              <div className="canvas-info">
                <span>Canvas: {currentFormat.width}×{currentFormat.height}</span>
                <span>•</span>
                <span>Scale: {Math.round(canvasScale * 100)}%</span>
                {template && <><span>•</span><span>Slots: {totalSlots}</span></>}
              </div>
            </div>
          )}
          {mode === 'preview' && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '0.5rem 1rem',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: 600,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              👁️ Preview Mode - Final Output
            </div>
          )}
          <div className="canvas-wrapper" style={{
            background: mode === 'preview' ? '#18181b' : '#f3f4f6',
            transition: 'background 0.2s ease'
          }}>{renderCanvas()}</div>
        </div>
        {!focusMode && (
        <div className="designer-sidebar right-sidebar" style={{
          width: '280px',
          background: '#fafafa',
          borderLeft: '1px solid #e5e7eb',
          padding: '1rem',
          overflowY: 'auto'
        }}>
          {selectedSlotId && template ? (
            <div>
              <h3 style={{ 
                fontSize: '0.8125rem', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                color: '#6b7280',
                marginBottom: '1rem'
              }}>Properties</h3>
              {(() => { 
                const slot = template.role_slots.find(s => s.role === selectedSlotId); 
                const config = CANONICAL_ROLES[selectedSlotId] || {}; 
                const hasAsset = !!assetMap[selectedSlotId];
                
                // Get current position/size from slotPositions or template defaults
                const position = slotPositions[selectedSlotId];
                const x = position?.x ?? slot?.position?.x ?? slot?.x ?? 0; 
                const y = position?.y ?? slot?.position?.y ?? slot?.y ?? 0; 
                const width = position?.width ?? slot?.position?.width ?? slot?.width ?? 0; 
                const height = position?.height ?? slot?.position?.height ?? slot?.height ?? 0;
                
                // Find the actual asset object
                const assignedAsset = hasAsset ? assets.find(a => {
                  const assetUrl = a.s3_url_enhanced || a.s3_url_no_bg || a.s3_url_raw || a.s3_url || a.metadata?.thumbnail_url;
                  return assetUrl === assetMap[selectedSlotId];
                }) : null;
                
                const assetProcessingStatus = assignedAsset ? processingStatus[assignedAsset.id] : null;
                const isProcessing = processingAsset?.assetId === assignedAsset?.id;
                
                return (
                  <div className="properties-panel">
                    <div className="property-group">
                      <label>Role:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: config.color, fontSize: '1.25rem' }}>{config.icon}</span>
                        <span>{config.label}</span>
                      </div>
                    </div>
                    
                    {/* Empty Slot Call-to-Action */}
                    {!hasAsset && selectedSlotId !== 'BG.MAIN' && (
                      <div style={{ 
                        marginTop: '0.75rem',
                        padding: '1rem', 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
                        <div style={{ color: 'white', fontWeight: 600, marginBottom: '0.75rem' }}>
                          This slot is empty
                        </div>
                        <button 
                          className="btn btn-primary" 
                          style={{ 
                            width: '100%',
                            background: 'white',
                            color: '#667eea',
                            fontWeight: 700,
                            border: 'none'
                          }}
                          onClick={() => setShowAssetPicker(true)}
                        >
                          ➕ Assign Asset
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ 
                            width: '100%',
                            marginTop: '0.5rem',
                            background: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}
                          onClick={() => toggleHideSlot(selectedSlotId)}
                        >
                          👁️‍🗨️ Hide This Slot
                        </button>
                      </div>
                    )}
                    
                    {/* Background Lock Notice */}
                    {selectedSlotId === 'BG.MAIN' && (
                      <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.75rem', 
                        background: '#dbeafe', 
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        color: '#1e40af'
                      }}>
                        🔒 <strong>Background is locked to canvas</strong><br/>
                        <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                          Auto-resizes to match {currentFormat.width}×{currentFormat.height}
                        </span>
                      </div>
                    )}
                    
                    {/* Layer Controls */}
                    {mode === 'layout' && selectedSlotId !== 'BG.MAIN' && (
                      <div className="property-group" style={{ 
                        marginTop: '0.5rem', 
                        padding: '0.75rem', 
                        background: '#f3f4f6', 
                        borderRadius: '6px' 
                      }}>
                        <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>🎛️ Layer Controls</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ width: '100%', fontSize: '0.875rem', padding: '0.5rem' }}
                            onClick={() => toggleLockSlot(selectedSlotId)}
                          >
                            {lockedSlots.has(selectedSlotId) ? '🔓 Unlock' : '🔒 Lock'}
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ width: '100%', fontSize: '0.875rem', padding: '0.5rem' }}
                            onClick={() => toggleHideSlot(selectedSlotId)}
                          >
                            {hiddenSlots.has(selectedSlotId) ? '👁️ Show' : '👁️‍🗨️ Hide'}
                          </button>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                              onClick={() => handleCopy()}
                              title="Copy Position (Ctrl+C)"
                            >
                              📋 Copy
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                              onClick={() => handlePaste()}
                              disabled={!clipboard}
                              title="Paste Position (Ctrl+V)"
                            >
                              📋 Paste
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="property-group">
                      <label>Status:</label>
                      <span className={`badge ${hasAsset ? 'badge-success' : 'badge-error'}`}>
                        {hasAsset ? '✓ Assigned' : '✗ Missing'}
                      </span>
                    </div>
                    
                    {/* Remove Asset Button */}
                    {hasAsset && selectedSlotId !== 'BG.MAIN' && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ 
                          width: '100%', 
                          marginTop: '0.5rem',
                          color: '#dc2626',
                          borderColor: '#dc2626'
                        }}
                        onClick={() => handleRemoveAsset(selectedSlotId)}
                      >
                        🗑️ Remove Asset
                      </button>
                    )}
                    
                    <div className="property-group">
                      <label>Position:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>X: {x}px</div>
                        <div>Y: {y}px</div>
                      </div>
                    </div>
                    
                    <div className="property-group">
                      <label>Size:</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>W: {width}px</div>
                        <div>H: {height}px</div>
                      </div>
                    </div>
                    
                    {/* Preset Size Controls - not for background */}
                    {selectedSlotId !== 'BG.MAIN' && mode === 'layout' && (
                      <div className="property-group" style={{ 
                        marginTop: '0.75rem',
                        padding: '0.75rem', 
                        background: '#f0fdf4', 
                        borderRadius: '8px',
                        border: '1px solid #10b981'
                      }}>
                        <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', fontSize: '0.875rem' }}>
                          📐 Quick Resize
                        </label>
                        
                        {/* Quick preset buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', flex: 1 }}
                            onClick={() => handleApplyPresetSize('instagram_feed')}
                          >
                            IG Feed
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', flex: 1 }}
                            onClick={() => handleApplyPresetSize('instagram_story')}
                          >
                            Story
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', flex: 1 }}
                            onClick={() => handleApplyPresetSize('youtube_lower_third')}
                          >
                            YT
                          </button>
                        </div>
                        
                        {/* More presets dropdown */}
                        <select 
                          className="form-select" 
                          style={{ fontSize: '0.875rem' }}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleApplyPresetSize(e.target.value);
                              e.target.value = ''; // Reset dropdown
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>More Presets...</option>
                          <option value="instagram_reel">Instagram Reel (9:16)</option>
                          <option value="tiktok">TikTok (9:16)</option>
                          <option value="twitter_card">Twitter Card (16:9)</option>
                          <option value="youtube_banner">YouTube Banner</option>
                          <option value="square_small">Small Square</option>
                          <option value="square_large">Large Square</option>
                        </select>
                        
                        {/* Reset to template default */}
                        <button 
                          className="btn btn-secondary" 
                          style={{ width: '100%', fontSize: '0.75rem', padding: '0.375rem', marginTop: '0.5rem' }}
                          onClick={() => handleResetToDefault()}
                        >
                          🔄 Reset to Default
                        </button>
                      </div>
                    )}
                    
                    {hasAsset && (
                      <>
                        <div className="property-group">
                          <label>Asset URL:</label>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', wordBreak: 'break-all' }}>
                            {assetMap[selectedSlotId].substring(0,40)}...
                          </div>
                        </div>
                        
                        {/* Image Processing Section */}
                        {assignedAsset && config.category === 'CHAR' && (
                          <div className="property-group" style={{ 
                            marginTop: '1rem', 
                            padding: '1rem', 
                            background: '#f9fafb', 
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <label style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>
                              🎨 Image Processing
                            </label>
                            
                            {/* Processing Status Indicators */}
                            {assetProcessingStatus && (
                              <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                                {assetProcessingStatus.bg_removed && (
                                  <div style={{ color: '#059669', marginBottom: '0.25rem' }}>
                                    ✅ Background Removed
                                  </div>
                                )}
                                {assetProcessingStatus.enhanced && (
                                  <div style={{ color: '#059669', marginBottom: '0.25rem' }}>
                                    ✨ Image Enhanced
                                  </div>
                                )}
                                {!assetProcessingStatus.bg_removed && !assetProcessingStatus.enhanced && (
                                  <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>
                                    No processing applied
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Processing Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ 
                                  width: '100%',
                                  fontSize: '0.875rem',
                                  padding: '0.5rem'
                                }} 
                                onClick={() => handleRemoveBackground(assignedAsset.id)}
                                disabled={isProcessing || isPolling || isGenerating}
                              >
                                {isProcessing && processingAsset.type === 'bg_removal' ? (
                                  <>⏳ Removing...</>
                                ) : assetProcessingStatus?.bg_removed ? (
                                  <>🔄 Re-process Background</>
                                ) : (
                                  <>🎨 Remove Background</>
                                )}
                              </button>
                              
                              <button 
                                className="btn btn-secondary" 
                                style={{ 
                                  width: '100%',
                                  fontSize: '0.875rem',
                                  padding: '0.5rem'
                                }} 
                                onClick={() => handleEnhanceImage(assignedAsset.id)}
                                disabled={isProcessing || isPolling || isGenerating}
                              >
                                {isProcessing && processingAsset.type === 'enhancement' ? (
                                  <>⏳ Enhancing...</>
                                ) : assetProcessingStatus?.enhanced ? (
                                  <>🔄 Re-enhance Image</>
                                ) : (
                                  <>✨ Enhance Image</>
                                )}
                              </button>
                            </div>
                            
                            {/* Help Text */}
                            <div style={{ 
                              marginTop: '0.75rem', 
                              padding: '0.5rem', 
                              background: '#fffbeb', 
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              color: '#92400e'
                            }}>
                              💡 <strong>Tip:</strong> Remove background first, then enhance for best results
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Change/Assign Asset Button */}
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', marginTop: '1rem' }} 
                      onClick={() => setShowAssetPicker(true)}
                      disabled={isPolling || isGenerating || isProcessing}
                    >
                      {hasAsset ? '🔄 Change Asset' : '➕ Assign Asset'}
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👈</div>
              <p>Click a slot to view properties</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default ThumbnailComposer;
