import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Stage, Layer, Rect, Text as KonvaText, Transformer, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { CANONICAL_ROLES } from '../constants/canonicalRoles';
import './TemplateDesigner.css';

/**
 * TemplateDesigner - Visual Canvas for Designing Thumbnail Templates
 * 
 * Features:
 * - Drag roles from palette onto canvas
 * - Resize with corner handles
 * - Layer order controls
 * - Save template with role slot positions
 * - Multi-format support (YouTube, Instagram, etc)
 */

// Format dimension presets
const THUMBNAIL_FORMATS = {
  YOUTUBE: {
    id: 'YOUTUBE',
    name: 'YouTube Hero',
    platform: 'YouTube',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    icon: '📺'
  },
  INSTAGRAM_FEED: {
    id: 'INSTAGRAM_FEED',
    name: 'Instagram Feed',
    platform: 'Instagram',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    icon: '📱'
  },
  INSTAGRAM_STORY: {
    id: 'INSTAGRAM_STORY',
    name: 'Instagram Story',
    platform: 'Instagram',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    icon: '📲'
  },
  FACEBOOK: {
    id: 'FACEBOOK',
    name: 'Facebook Post',
    platform: 'Facebook',
    width: 1200,
    height: 630,
    aspectRatio: '1.91:1',
    icon: '👥'
  },
};

function TemplateDesigner() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Template metadata
  const [templateName, setTemplateName] = useState('Untitled Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateStudioId, setTemplateStudioId] = useState(null);
  const [currentFormat, setCurrentFormat] = useState('YOUTUBE');
  const [canvasWidth, setCanvasWidth] = useState(1920);
  const [canvasHeight, setCanvasHeight] = useState(1080);
  
  // Canvas state
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [manualZoom, setManualZoom] = useState(1);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('layout'); // 'layout' or 'preview'
  
  // Episode preview state
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);
  const [episodeAssets, setEpisodeAssets] = useState([]);
  const [assetsByRole, setAssetsByRole] = useState({});
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  
  // Composition output state
  const [compositionId, setCompositionId] = useState(null);
  const [compositionOutputs, setCompositionOutputs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingIntervalRef = useRef(null);
  
  // Canvas refs
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);
  
  // Load template if editing
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  }, [templateId]);
  
  // Calculate canvas scale to fit container (only on mount and resize)
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 40; // padding
        const containerHeight = containerRef.current.offsetHeight - 80; // padding + info bar
        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;
        const fitScale = Math.min(scaleX, scaleY, 1);
        setCanvasScale(fitScale * manualZoom);
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [canvasWidth, canvasHeight]); // Removed manualZoom from deps
  
  // Recalculate scale when manual zoom changes
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth - 40;
      const containerHeight = containerRef.current.offsetHeight - 80;
      const scaleX = containerWidth / canvasWidth;
      const scaleY = containerHeight / canvasHeight;
      const fitScale = Math.min(scaleX, scaleY, 1);
      setCanvasScale(fitScale * manualZoom);
    }
  }, [manualZoom, canvasWidth, canvasHeight]);
  
  // Debug: Track viewMode changes
  useEffect(() => {
    console.log('🎭 viewMode changed to:', viewMode, {
      assetCount: Object.keys(assetsByRole).length,
      slotCount: slots.length,
      selectedSlot: selectedSlotId
    });
  }, [viewMode]);
  
  // Load episodes for preview
  useEffect(() => {
    loadEpisodes();
  }, []);
  
  // Load composition from query parameter
  useEffect(() => {
    const compositionId = searchParams.get('composition');
    if (compositionId) {
      loadComposition(compositionId);
    }
  }, [searchParams]);
  
  // Load episode assets when episode is selected
  useEffect(() => {
    if (selectedEpisodeId) {
      loadEpisodeAssets(selectedEpisodeId);
    }
  }, [selectedEpisodeId]);
  
  const loadEpisodes = async () => {
    try {
      const response = await fetch('/api/v1/episodes?limit=50');
      const data = await response.json();
      if (data.status === 'SUCCESS') {
        setEpisodes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load episodes:', err);
    }
  };
  
  const loadEpisodeAssets = async (episodeId) => {
    try {
      console.log('🔄 Loading assets for episode:', episodeId);
      const response = await fetch(`/api/v1/episodes/${episodeId}/assets`);
      const data = await response.json();
      
      if (data.status === 'SUCCESS') {
        const assets = data.data || [];
        console.log('📦 Loaded assets:', assets.length);
        console.table(assets.map(a => ({
          name: a.name,
          role: a.asset_role,
          s3_raw: a.s3_url_raw?.substring(0, 50) + '...',
          s3_processed: a.s3_url_processed?.substring(0, 50) + '...'
        })));
        setEpisodeAssets(assets);
        
        // Map assets to roles
        const roleMap = {};
        assets.forEach(asset => {
          if (asset.asset_role) {
            const url = asset.thumbnail_url || asset.s3_url_processed || asset.s3_url_raw;
            console.log(`🎯 Mapping: ${asset.asset_role} → ${url}`);
            roleMap[asset.asset_role] = url;
          } else {
            console.warn('⚠️ Asset has no asset_role:', asset.name);
          }
        });
        console.log('🗺️ Final roleMap:', roleMap);
        setAssetsByRole(roleMap);
        if (Object.keys(roleMap).length > 0) {
          setViewMode('preview');
          setStatus(`✅ Loaded ${Object.keys(roleMap).length} assets - Preview Mode Active`);
        } else {
          setStatus(`⚠️ No assets with roles found`);
        }
      }
    } catch (err) {
      console.error('❌ Failed to load episode assets:', err);
    }
  };
  
  const loadTemplate = async (id) => {
    try {
      const response = await fetch(`/api/v1/template-studio/${id}`);
      const data = await response.json();
      
      if (data.status === 'SUCCESS' && data.data) {
        const template = data.data;
        setTemplateName(template.name);
        setTemplateDescription(template.description || '');
        setCanvasWidth(template.canvas_config?.width || 1920);
        setCanvasHeight(template.canvas_config?.height || 1080);
        
        // Convert role_slots to internal format
        // ✅ FIX: Extract position from nested structure and validate numeric values
        const loadedSlots = (template.role_slots || []).map((slot, idx) => {
          // Handle both flat structure (x, y) and nested structure (position.x, position.y)
          const x = Number(slot.x || slot.position?.x) || 100 + (idx * 50);
          const y = Number(slot.y || slot.position?.y) || 100 + (idx * 50);
          const width = Number(slot.width || slot.position?.width) || 400;
          const height = Number(slot.height || slot.position?.height) || 600;
          const rotation = Number(slot.rotation || slot.transform?.rotation) || 0;
          const layer = Number(slot.layer || slot.z_index) || idx;
          
          return {
            id: `slot-${Date.now()}-${idx}`,
            role: slot.role,
            x,
            y,
            width,
            height,
            rotation,
            layer,
            required: (template.required_roles || []).includes(slot.role),
            processing: slot.processing || {
              removeBackground: false,
              smoothSkin: false,
              autoEnhance: false
            }
          };
        });
        
        setSlots(loadedSlots);
      }
    } catch (err) {
      console.error('Failed to load template:', err);
      setStatus('❌ Failed to load template');
    }
  };
  
  const loadComposition = async (compositionId) => {
    try {
      console.log('🔄 Loading composition:', compositionId);
      const response = await fetch(`/api/v1/compositions/${compositionId}`);
      const data = await response.json();
      
      if (data.status === 'SUCCESS' && data.data) {
        const composition = data.data;
        console.log('📦 Loaded composition:', composition);
        
        setCompositionId(compositionId);
        
        // Check outputs status
        const outputs = composition.outputs || [];
        setCompositionOutputs(outputs);
        const processing = outputs.some(o => o.status === 'PROCESSING');
        setIsProcessing(processing);
        
        if (processing) {
          console.log('⏳ Composition outputs are PROCESSING, starting poll...');
          startPolling(compositionId);
        }
        
        // Map composition_assets by role for preview
        const compositionAssets = composition.composition_assets || [];
        console.log('📦 Composition has', compositionAssets.length, 'composition_assets');
        
        const assetRoleMap = {};
        compositionAssets.forEach(ca => {
          if (ca.asset_role && ca.asset) {
            const asset = ca.asset;
            const url = asset.metadata?.thumbnail_url || asset.thumbnail_url || asset.s3_url_processed || asset.s3_url_raw;
            console.log(`🎯 Composition Asset Mapping: ${ca.asset_role} → ${url}`);
            assetRoleMap[ca.asset_role] = url;
          }
        });
        console.log('🗺️ Composition asset map:', assetRoleMap);
        setAssetsByRole(assetRoleMap);
        
        // Now load the template to get slot layout
        if (composition.template_id) {
          console.log('🔄 Loading template:', composition.template_id);
          await loadTemplateForComposition(composition.template_id);
        } else if (composition.template_studio_id) {
          console.log('🔄 Loading template studio:', composition.template_studio_id);
          await loadTemplateStudioForComposition(composition.template_studio_id);
        } else {
          console.warn('⚠️ Composition has no template_id or template_studio_id');
          setStatus('⚠️ Composition loaded but no template found');
        }
        
        // Set the episode to load its assets (for additional preview)
        if (composition.episode_id) {
          setSelectedEpisodeId(composition.episode_id);
          if (processing) {
            setStatus('⏳ Rendering... Assets mapped');
          } else {
            setStatus(`✅ ${Object.keys(assetRoleMap).length} assets mapped`);
          }
        } else {
          setStatus(processing ? '⏳ Rendering...' : '✅ Composition loaded');
        }
      }
    } catch (err) {
      console.error('❌ Failed to load composition:', err);
      setStatus('❌ Failed to load composition');
    }
  };
  
  const loadTemplateForComposition = async (templateId) => {
    try {
      // Legacy template API - may have layout_config
      const response = await fetch(`/api/v1/thumbnail-templates/${templateId}`);
      const data = await response.json();
      
      if (data.status === 'SUCCESS' && data.data) {
        const template = data.data;
        console.log('📐 Loaded legacy template:', template);
        
        // Extract slots from layout_config
        const layoutConfig = template.layout_config || {};
        const extractedSlots = [];
        
        Object.entries(layoutConfig).forEach(([roleKey, config], idx) => {
          if (config && typeof config === 'object') {
            extractedSlots.push({
              id: `slot-${roleKey}-${idx}`,
              role: roleKey.toUpperCase().replace(/\./g, '_'),
              x: config.x || 100 + (idx * 50),
              y: config.y || 100 + (idx * 50),
              width: config.width || 400,
              height: config.height || 300,
              rotation: 0,
              layer: config.z || idx,
              required: false,
              processing: {
                removeBackground: false,
                smoothSkin: false,
                autoEnhance: false
              }
            });
          }
        });
        
        console.log(`✅ Extracted ${extractedSlots.length} slots from template layout_config`);
        setSlots(extractedSlots);
        setTemplateName(template.name || 'Composition Template');
      }
    } catch (err) {
      console.error('❌ Failed to load template:', err);
    }
  };
  
  const loadTemplateStudioForComposition = async (studioId) => {
    try {
      const response = await fetch(`/api/v1/template-studio/${studioId}`);
      const data = await response.json();
      
      if (data.status === 'SUCCESS' && data.data) {
        const template = data.data;
        console.log('📐 Loaded template studio:', template);
        
        setTemplateName(template.name || 'Template Studio');
        setTemplateDescription(template.description || '');
        setCanvasWidth(template.canvas_config?.width || 1920);
        setCanvasHeight(template.canvas_config?.height || 1080);
        
        // Extract slots from role_slots
        if (template.role_slots && Array.isArray(template.role_slots)) {
          const loadedSlots = template.role_slots.map((slot, idx) => {
            const x = Number(slot.x || slot.position?.x) || 100 + (idx * 50);
            const y = Number(slot.y || slot.position?.y) || 100 + (idx * 50);
            const width = Number(slot.width || slot.position?.width) || 400;
            const height = Number(slot.height || slot.position?.height) || 300;
            
            return {
              id: `slot-${Date.now()}-${idx}`,
              role: slot.role,
              x,
              y,
              width,
              height,
              rotation: Number(slot.rotation) || 0,
              layer: Number(slot.layer) || idx,
              required: (template.required_roles || []).includes(slot.role),
              processing: slot.processing || {
                removeBackground: false,
                smoothSkin: false,
                autoEnhance: false
              }
            };
          });
          
          console.log(`✅ Loaded ${loadedSlots.length} slots from template studio`);
          setSlots(loadedSlots);
        }
      }
    } catch (err) {
      console.error('❌ Failed to load template studio:', err);
    }
  };
  
  const startPolling = (compId) => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Poll every 3 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/compositions/${compId}`);
        const data = await response.json();
        
        if (data.status === 'SUCCESS' && data.data) {
          const outputs = data.data.outputs || [];
          setCompositionOutputs(outputs);
          
          const stillProcessing = outputs.some(o => o.status === 'PROCESSING');
          setIsProcessing(stillProcessing);
          
          if (!stillProcessing) {
            console.log('✅ Composition render complete!');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            
            const completedCount = outputs.filter(o => o.status === 'COMPLETED').length;
            setStatus(`✅ ${completedCount} thumbnail${completedCount !== 1 ? 's' : ''} rendered`);
          } else {
            console.log('⏳ Still processing...');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };
  
  const handleViewModeToggle = () => {
    const newMode = viewMode === 'layout' ? 'preview' : 'layout';
    console.log('🔄 View mode toggle:', {
      from: viewMode,
      to: newMode,
      hasAssets: Object.keys(assetsByRole).length > 0,
      assetRoles: Object.keys(assetsByRole),
      selectedSlot: selectedSlotId,
      totalSlots: slots.length
    });
    setViewMode(newMode);
    setStatus(newMode === 'preview' ? '👁️ Preview Mode - Showing Assets' : '📐 Layout Mode - Editing Slots');
  };
  
  const handleFormatChange = (formatKey) => {
    const format = THUMBNAIL_FORMATS[formatKey];
    if (!format) return;
    
    console.log('📱 Format change:', {
      from: currentFormat,
      to: formatKey,
      dimensions: `${format.width}x${format.height}`
    });
    
    setCurrentFormat(formatKey);
    setCanvasWidth(format.width);
    setCanvasHeight(format.height);
    setStatus(`📐 Switched to ${format.name} (${format.width}x${format.height})`);
  };
  
  const handleAddSlot = (role) => {
    const roleConfig = CANONICAL_ROLES[role];
    const newSlot = {
      id: `slot-${Date.now()}`,
      role,
      x: 100,
      y: 100,
      width: roleConfig.defaultSize.width,
      height: roleConfig.defaultSize.height,
      rotation: 0,
      layer: slots.length,
      required: roleConfig.required,
      processing: {
        removeBackground: false,
        smoothSkin: false,
        autoEnhance: false
      }
    };
    
    setSlots([...slots, newSlot]);
    setSelectedSlotId(newSlot.id);
    setStatus(`✅ Added ${roleConfig.label}`);
  };
  
  const handleSlotDragEnd = (slotId, e) => {
    const newX = Math.round(e.target.x());
    const newY = Math.round(e.target.y());
    console.log(`📍 Drag end for ${slotId}: (${newX}, ${newY})`);
    
    const updatedSlots = slots.map(slot => {
      if (slot.id === slotId) {
        return {
          ...slot,
          x: newX,
          y: newY
        };
      }
      return slot;
    });
    setSlots(updatedSlots);
    setStatus('✓ Position updated');
  };
  
  const handleSlotTransformEnd = (slotId, node) => {
    const newWidth = Math.round(node.width() * node.scaleX());
    const newHeight = Math.round(node.height() * node.scaleY());
    const newX = Math.round(node.x());
    const newY = Math.round(node.y());
    const newRotation = Math.round(node.rotation());
    
    console.log(`🔄 Transform end for ${slotId}:`, {
      position: `(${newX}, ${newY})`,
      size: `${newWidth}x${newHeight}`,
      rotation: newRotation
    });
    
    const updatedSlots = slots.map(slot => {
      if (slot.id === slotId) {
        return {
          ...slot,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          rotation: newRotation
        };
      }
      return slot;
    });
    setSlots(updatedSlots);
    setStatus('✓ Size/rotation updated');
  };
  
  const handleSlotClick = (slotId) => {
    console.log('🎯 Slot clicked:', slotId);
    setSelectedSlotId(slotId);
    const slot = slots.find(s => s.id === slotId);
    if (slot) {
      const roleConfig = CANONICAL_ROLES[slot.role];
      setStatus(`✓ Selected: ${roleConfig?.label || slot.role}`);
    }
  };
  
  const handleDeleteSlot = (slotId) => {
    setSlots(slots.filter(s => s.id !== slotId));
    if (selectedSlotId === slotId) {
      setSelectedSlotId(null);
    }
  };
  
  const handleLayerUp = (slotId) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot || slot.layer >= slots.length - 1) return;
    
    const updatedSlots = slots.map(s => {
      if (s.id === slotId) return { ...s, layer: s.layer + 1 };
      if (s.layer === slot.layer + 1) return { ...s, layer: s.layer - 1 };
      return s;
    });
    setSlots(updatedSlots);
  };
  
  const handleLayerDown = (slotId) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot || slot.layer <= 0) return;
    
    const updatedSlots = slots.map(s => {
      if (s.id === slotId) return { ...s, layer: s.layer - 1 };
      if (s.layer === slot.layer - 1) return { ...s, layer: s.layer + 1 };
      return s;
    });
    setSlots(updatedSlots);
  };
  
  const handleUpdateSlotProperty = (slotId, property, value) => {
    const updatedSlots = slots.map(slot => {
      if (slot.id === slotId) {
        if (property.startsWith('processing.')) {
          const processingKey = property.split('.')[1];
          return {
            ...slot,
            processing: {
              ...slot.processing,
              [processingKey]: value
            }
          };
        }
        return { ...slot, [property]: value };
      }
      return slot;
    });
    setSlots(updatedSlots);
  };
  
  const handleSave = async (publish = false) => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    
    if (slots.length === 0) {
      alert('Please add at least one role slot to the template');
      return;
    }
    
    setSaving(true);
    setStatus(publish ? '⏳ Publishing template...' : '⏳ Saving template...');
    
    try {
      // Build template payload
      const payload = {
        name: templateName,
        description: templateDescription,
        canvas_config: {
          width: canvasWidth,
          height: canvasHeight,
          background: '#ffffff'
        },
        role_slots: slots.map(slot => ({
          role: slot.role,
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
          rotation: slot.rotation,
          layer: slot.layer,
          processing: slot.processing
        })),
        required_roles: slots.filter(s => s.required).map(s => s.role),
        optional_roles: slots.filter(s => !s.required).map(s => s.role),
        formats_supported: ['YOUTUBE', 'INSTAGRAM_FEED', 'FACEBOOK', 'TWITTER']
      };
      
      // Create or update
      const url = templateId 
        ? `/api/v1/template-studio/${templateId}`
        : '/api/v1/template-studio';
      
      const method = templateId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save template');
      }
      
      const savedTemplateId = data.data.id;
      
      // If publishing, call publish endpoint
      if (publish) {
        const publishResponse = await fetch(`/api/v1/template-studio/${savedTemplateId}/publish`, {
          method: 'POST'
        });
        
        if (!publishResponse.ok) {
          throw new Error('Saved but failed to publish');
        }
        
        setStatus('✅ Template published successfully!');
      } else {
        setStatus('✅ Template saved as draft!');
      }
      
      // Redirect after 1 second
      setTimeout(() => {
        navigate('/template-studio');
      }, 1500);
      
    } catch (err) {
      console.error('Save error:', err);
      setStatus(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const handleZoomIn = () => setManualZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setManualZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleZoomReset = () => setManualZoom(1);
  const handleFitToScreen = () => {
    setManualZoom(1); // Reset to 100%, useEffect will handle the rest
  };
  
  const selectedSlot = slots.find(s => s.id === selectedSlotId);
  const sortedSlots = [...slots].sort((a, b) => a.layer - b.layer);
  
  // Filter roles by search
  const filteredRoles = Object.entries(CANONICAL_ROLES).filter(([role, config]) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      config.label.toLowerCase().includes(query) ||
      role.toLowerCase().includes(query) ||
      config.category.toLowerCase().includes(query)
    );
  });
  
  // Group roles by category
  const rolesByCategory = {};
  filteredRoles.forEach(([role, config]) => {
    if (!rolesByCategory[config.category]) {
      rolesByCategory[config.category] = [];
    }
    rolesByCategory[config.category].push([role, config]);
  });
  
  return (
    <div className="template-designer">
      {/* Top Toolbar */}
      <div className="designer-toolbar">
        <div className="toolbar-left">
          <button onClick={() => navigate('/template-studio')} className="btn-back">
            ← Back
          </button>
          <div className="template-name-input">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template Name"
              className="template-name-field"
            />
          </div>
        </div>
        <div className="toolbar-right">
          <div className="format-selector">
            <label htmlFor="format-select">📱 Format:</label>
            <select 
              id="format-select"
              value={currentFormat} 
              onChange={(e) => handleFormatChange(e.target.value)}
              className="format-dropdown"
            >
              {Object.entries(THUMBNAIL_FORMATS).map(([key, format]) => (
                <option key={key} value={key}>
                  {format.icon} {format.name} ({format.width}×{format.height})
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={(e) => {
              e.preventDefault();
              const debugInfo = {
                'Canvas': { width: canvasWidth, height: canvasHeight, scale: canvasScale, manualZoom },
                'Selection': { selectedSlotId, selectedSlot: selectedSlot ? { ...selectedSlot } : null },
                'Slots': slots.length,
                'View Mode': viewMode,
                'Selected Episode': selectedEpisodeId,
                'Episode Assets': episodeAssets.length,
                'Assets by Role Keys': Object.keys(assetsByRole),
                'Slots Detail': slots.map(s => ({
                  id: s.id,
                  role: s.role,
                  position: `${s.x},${s.y}`,
                  dimensions: `${s.width}x${s.height}`,
                  layer: s.layer,
                  hasAssetUrl: !!assetsByRole[s.role],
                  assetUrl: assetsByRole[s.role]?.substring(0, 80)
                }))
              };
              console.log('\n=== 🐛 DEBUG STATE ===');
              console.log(JSON.stringify(debugInfo, null, 2));
              console.log('\n=== SLOTS TABLE ===');
              console.table(slots);
              console.log('\n=== ASSETS BY ROLE ===');
              console.table(assetsByRole);
            }}
            className="btn-secondary"
            title="Log debug info to console"
          >
            🐛 Debug
          </button>
          <button 
            onClick={() => setShowPreviewPanel(!showPreviewPanel)} 
            className={`btn-preview ${showPreviewPanel ? 'active' : ''}`}
            title="Toggle episode preview"
          >
            {showPreviewPanel ? '🖼️ Hide' : '🖼️ Preview'}
          </button>
          <button onClick={() => handleSave(false)} disabled={saving} className="btn-save">
            💾 Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="btn-publish">
            📤 Publish
          </button>
        </div>
      </div>
      
      {/* Status Bar */}
      {status && (
        <div className={`status-bar ${status.includes('❌') ? 'error' : 'success'}`}>
          {status}
        </div>
      )}
      
      {/* Mode Indicator */}
      <div className={`mode-indicator ${viewMode} ${isProcessing ? 'processing' : ''}`}>
        <span className="mode-icon">{viewMode === 'preview' ? '👁️' : '📐'}</span>
        <span className="mode-label">
          {isProcessing && '⏳ Rendering... | '}
          {viewMode === 'preview' ? 'Preview Mode - Showing Assets' : 'Layout Mode - Template Slots'}
          <span className="format-badge">
            {THUMBNAIL_FORMATS[currentFormat]?.icon} {THUMBNAIL_FORMATS[currentFormat]?.name}
          </span>
        </span>
        {viewMode === 'preview' && Object.keys(assetsByRole).length > 0 && (
          <span className="mode-details">
            {Object.keys(assetsByRole).length} asset{Object.keys(assetsByRole).length !== 1 ? 's' : ''} loaded
          </span>
        )}
        <div className="scale-info">
          <span title="Auto-fit scale to container">Fit: {Math.round((canvasScale / manualZoom) * 100)}%</span>
          {manualZoom !== 1 && (
            <span title="Manual zoom adjustment"> × Zoom: {Math.round(manualZoom * 100)}%</span>
          )}
        </div>
        <button 
          className="mode-toggle-btn" 
          onClick={handleViewModeToggle}
          disabled={isProcessing && viewMode === 'layout'}
          title={
            isProcessing && viewMode === 'layout' 
              ? 'Preview disabled while rendering...' 
              : viewMode === 'layout' ? 'Switch to Preview Mode' : 'Switch to Layout Mode'
          }
        >
          {viewMode === 'layout' ? '👁️ Preview' : '📐 Layout'}
        </button>
      </div>
      
      {/* Main Content */}
      <div className="designer-content">
        {/* Left Sidebar - Role Palette */}
        <div className="role-palette">
          <div className="palette-header">
            <h3>📦 Role Palette</h3>
            <input
              type="text"
              placeholder="🔍 Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="role-search"
            />
          </div>
          
          <div className="palette-content">
            {Object.entries(rolesByCategory).map(([category, roles]) => (
              <div key={category} className="role-category">
                <div className="category-header">{category}</div>
                <div className="role-list">
                  {roles.map(([role, config]) => (
                    <div
                      key={role}
                      className="role-item"
                      onClick={() => handleAddSlot(role)}
                      title={`Click to add ${config.label}`}
                    >
                      <span className="role-icon" style={{ color: config.color }}>
                        {config.icon}
                      </span>
                      <span className="role-label">{config.label}</span>
                      {config.required && <span className="required-dot">●</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Center - Canvas */}
        <div className="canvas-container" ref={containerRef}>
          <div className="canvas-info">
            <div className="canvas-info-left">
              <span>{canvasWidth} × {canvasHeight}px</span>
              <span>View Scale: {Math.round(canvasScale * 100)}%</span>
              <span>Zoom: {Math.round(manualZoom * 100)}%</span>
              <span>Slots: {slots.length}</span>
              {selectedSlot && (
                <span style={{ color: '#f59e0b', fontWeight: 'bold', background: 'rgba(245, 158, 11, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  ✏️ Editing: {CANONICAL_ROLES[selectedSlot.role]?.label}
                </span>
              )}
              {selectedEpisodeId && (
                <span style={{ color: '#667eea', fontWeight: 'bold' }}>
                  📺 {episodes.find(e => e.id === selectedEpisodeId)?.title || 'Episode'}
                </span>
              )}
              {selectedEpisodeId && Object.keys(assetsByRole).length > 0 && (
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                  ✓ {Object.keys(assetsByRole).length} assets loaded
                </span>
              )}
            </div>
            <div className="canvas-zoom-controls">
              <button onClick={handleZoomOut} className="zoom-btn" title="Zoom Out">−</button>
              <button onClick={handleZoomReset} className="zoom-btn" title="Reset Zoom (100%)">
                {Math.round(manualZoom * 100)}%
              </button>
              <button onClick={handleZoomIn} className="zoom-btn" title="Zoom In">+</button>
              <button onClick={handleFitToScreen} className="zoom-btn-fit" title="Fit to Screen">⛶ Fit</button>
            </div>
          </div>
          
          <div className="canvas-wrapper">
            <Stage
              ref={stageRef}
              width={canvasWidth}
              height={canvasHeight}
              scaleX={canvasScale}
              scaleY={canvasScale}
              width={canvasWidth}
              height={canvasHeight}
              ref={stageRef}
              onClick={(e) => {
                if (e.target === e.target.getStage()) {
                  setSelectedSlotId(null);
                }
              }}
            >
              <Layer>
                {/* Background */}
                <Rect
                  x={0}
                  y={0}
                  width={canvasWidth}
                  height={canvasHeight}
                  fill="#f3f4f6"
                />
                
                {/* Role Slots */}
                {sortedSlots.map((slot) => {
                  const roleConfig = CANONICAL_ROLES[slot.role];
                  const assetUrl = viewMode === 'preview' ? assetsByRole[slot.role] : null;
                  return (
                    <SlotShape
                      key={slot.id}
                      slot={slot}
                      roleConfig={roleConfig}
                      assetUrl={assetUrl}
                      viewMode={viewMode}
                      isSelected={slot.id === selectedSlotId}
                      onSelect={() => handleSlotClick(slot.id)}
                      onDragEnd={(e) => handleSlotDragEnd(slot.id, e)}
                      onTransformEnd={(node) => handleSlotTransformEnd(slot.id, node)}
                      transformerRef={transformerRef}
                    />
                  );
                })}
              </Layer>
            </Stage>
          </div>
        </div>
        
        {/* Right Sidebar - Properties */}
        <div className="slot-properties">
          <div className="properties-header">
            <h3>⚙️ Properties</h3>
          </div>
          
          {!selectedSlot ? (
            <div className="no-selection">
              <div className="canvas-info">
                <h4>📐 Canvas Settings</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Format:</span>
                    <span className="info-value">
                      {THUMBNAIL_FORMATS[currentFormat]?.icon} {THUMBNAIL_FORMATS[currentFormat]?.name}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Dimensions:</span>
                    <span className="info-value">{canvasWidth} × {canvasHeight}px</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Aspect Ratio:</span>
                    <span className="info-value">{THUMBNAIL_FORMATS[currentFormat]?.aspectRatio || (canvasWidth / canvasHeight).toFixed(2) + ':1'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Total Slots:</span>
                    <span className="info-value">{slots.length}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Mode:</span>
                    <span className="info-value">{viewMode === 'preview' ? '👁️ Preview' : '📐 Layout'}</span>
                  </div>
                </div>
                
                {viewMode === 'layout' && (
                  <div className="layout-hints">
                    <h4>💡 Getting Started</h4>
                    <ul className="hint-list">
                      <li>Select format (YouTube, Instagram, etc.) from toolbar</li>
                      <li>Click roles from the left palette to add slots</li>
                      <li>Click a slot on canvas to edit its properties</li>
                      <li>Drag and resize slots to position them</li>
                      <li>Switch to Preview mode to see real assets</li>
                    </ul>
                  </div>
                )}
                
                {viewMode === 'preview' && (
                  <div className="asset-bindings">
                    <h4>🔗 Asset Bindings</h4>
                    {slots.length === 0 ? (
                      <p className="hint-text">No slots added yet</p>
                    ) : (
                      <div className="bindings-list">
                        {slots.map(slot => {
                          const roleConfig = CANONICAL_ROLES[slot.role];
                          const assetUrl = assetsByRole[slot.role];
                          return (
                            <div key={slot.id} className={`binding-item ${assetUrl ? 'bound' : 'unbound'}`}>
                              <span className="binding-role">
                                {roleConfig?.icon} {roleConfig?.label}
                              </span>
                              <span className="binding-status">
                                {assetUrl ? (
                                  <span className="status-bound">✓ Bound</span>
                                ) : (
                                  <span className="status-unbound">○ No Asset</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="quick-tips">
                  <h4>💡 Quick Tips</h4>
                  <ul>
                    <li>Drag roles from the left palette onto the canvas</li>
                    <li>Click a slot to select and edit its properties</li>
                    <li>Use corner handles to resize slots</li>
                    <li>Toggle Preview mode to see actual assets</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="properties-content" key={selectedSlotId}>
              <div className="property-section">
                <h4>{CANONICAL_ROLES[selectedSlot.role]?.icon} {CANONICAL_ROLES[selectedSlot.role]?.label}</h4>
                <div className="property-badge">Role: {selectedSlot.role}</div>
                <div className="property-badge" style={{ background: '#e0e7ff', color: '#4338ca', marginTop: '0.5rem' }}>
                  ID: {selectedSlot.id}
                </div>
                
                {/* Asset Binding Info */}
                {viewMode === 'preview' && (
                  <div className={`asset-binding-info ${assetsByRole[selectedSlot.role] ? 'has-asset' : 'no-asset'}`}>
                    {assetsByRole[selectedSlot.role] ? (
                      <>
                        <div className="binding-status-badge success">✓ Asset Bound</div>
                        <div className="asset-preview-thumb">
                          <img 
                            src={assetsByRole[selectedSlot.role]} 
                            alt={selectedSlot.role}
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        </div>
                        <div className="asset-url-display">
                          {assetsByRole[selectedSlot.role].split('/').pop()}
                        </div>
                      </>
                    ) : (
                      <div className="binding-status-badge warning">○ No Asset Assigned</div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="property-section">
                <label>Position & Size</label>
                <div className="property-grid">
                  <div className="property-field">
                    <span>X:</span>
                    <input
                      type="number"
                      value={selectedSlot.x}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'x', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="property-field">
                    <span>Y:</span>
                    <input
                      type="number"
                      value={selectedSlot.y}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'y', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="property-field">
                    <span>Width:</span>
                    <input
                      type="number"
                      value={selectedSlot.width}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'width', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="property-field">
                    <span>Height:</span>
                    <input
                      type="number"
                      value={selectedSlot.height}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'height', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="property-section">
                <label>Layer & Options</label>
                <div className="property-buttons">
                  <button onClick={() => handleLayerUp(selectedSlot.id)} disabled={selectedSlot.layer >= slots.length - 1}>
                    ⬆️ Layer Up
                  </button>
                  <button onClick={() => handleLayerDown(selectedSlot.id)} disabled={selectedSlot.layer <= 0}>
                    ⬇️ Layer Down
                  </button>
                </div>
                <div className="property-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedSlot.required}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'required', e.target.checked)}
                    />
                    Required Role
                  </label>
                </div>
              </div>
              
              {/* Processing Options */}
              <div className="property-section">
                <label>🎨 Image Processing</label>
                <div className="processing-options">
                  <div className="processing-option">
                    <input
                      type="checkbox"
                      id="removeBackground"
                      checked={selectedSlot.processing.removeBackground}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'processing.removeBackground', e.target.checked)}
                    />
                    <label htmlFor="removeBackground">Remove Background</label>
                  </div>
                  <div className="processing-option">
                    <input
                      type="checkbox"
                      id="smoothSkin"
                      checked={selectedSlot.processing.smoothSkin}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'processing.smoothSkin', e.target.checked)}
                    />
                    <label htmlFor="smoothSkin">Smooth Skin</label>
                  </div>
                  <div className="processing-option">
                    <input
                      type="checkbox"
                      id="autoEnhance"
                      checked={selectedSlot.processing.autoEnhance}
                      onChange={(e) => handleUpdateSlotProperty(selectedSlot.id, 'processing.autoEnhance', e.target.checked)}
                    />
                    <label htmlFor="autoEnhance">Auto Enhance</label>
                  </div>
                </div>
              </div>
              
              <div className="property-section">
                <button onClick={() => handleDeleteSlot(selectedSlot.id)} className="btn-delete-slot">
                  🗑️ Delete Slot
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Slot Shape Component
function SlotShape({ slot, roleConfig, assetUrl, viewMode, isSelected, onSelect, onDragEnd, onTransformEnd, transformerRef }) {
  const shapeRef = useRef(null);
  const imageRef = useRef(null);
  const [image, imageStatus] = useImage(assetUrl || '', 'anonymous');
  
  // Debug image loading
  useEffect(() => {
    if (viewMode === 'preview' && assetUrl) {
      console.log(`🖼️ [${roleConfig.label}] Image loading:`, {
        url: assetUrl.substring(0, 100) + '...',
        status: imageStatus,
        hasImage: !!image,
        imageSize: image ? `${image.width}x${image.height}` : 'N/A'
      });
      
      if (imageStatus === 'failed') {
        console.error(`❌ [${roleConfig.label}] Image failed to load:`, assetUrl);
      }
    }
  }, [assetUrl, imageStatus, image, viewMode, roleConfig.label]);
  
  // Calculate image dimensions to fit slot while preserving aspect ratio
  const getImageDimensions = () => {
    if (!image) return { width: slot.width, height: slot.height, x: slot.x, y: slot.y };
    
    const imageAspect = image.width / image.height;
    const slotAspect = slot.width / slot.height;
    
    let renderWidth, renderHeight, offsetX = 0, offsetY = 0;
    
    // Fit image to cover the slot (like background-size: cover)
    if (imageAspect > slotAspect) {
      // Image is wider - fit to height
      renderHeight = slot.height;
      renderWidth = renderHeight * imageAspect;
      offsetX = (slot.width - renderWidth) / 2;
    } else {
      // Image is taller - fit to width
      renderWidth = slot.width;
      renderHeight = renderWidth / imageAspect;
      offsetY = (slot.height - renderHeight) / 2;
    }
    
    return {
      width: renderWidth,
      height: renderHeight,
      x: slot.x + offsetX,
      y: slot.y + offsetY
    };
  };
  
  const imageDims = getImageDimensions();
  
  useEffect(() => {
    if (isSelected && transformerRef.current) {
      const node = imageRef.current || shapeRef.current;
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [isSelected, transformerRef]);
  
  const handleTransform = () => {
    const node = imageRef.current || shapeRef.current;
    if (node) {
      node.scaleX(1);
      node.scaleY(1);
      onTransformEnd(node);
    }
  };
  
  // Render image if available, otherwise placeholder
  if (assetUrl && image && imageStatus === 'loaded') {
    return (
      <>
        {/* Clipping rect to constrain image to slot bounds */}
        <Rect
          x={slot.x}
          y={slot.y}
          width={slot.width}
          height={slot.height}
          fill="transparent"
          stroke={viewMode === 'preview' ? (isSelected ? '#667eea' : 'rgba(0,0,0,0.1)') : 'transparent'}
          strokeWidth={viewMode === 'preview' ? (isSelected ? 2 : 1) : 0}
          listening={false}
        />
        <KonvaImage
          ref={imageRef}
          image={image}
          x={imageDims.x}
          y={imageDims.y}
          width={imageDims.width}
          height={imageDims.height}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={onDragEnd}
          onTransformEnd={handleTransform}
          shadowBlur={isSelected ? 10 : 0}
          shadowColor="black"
          shadowOpacity={isSelected ? 0.5 : 0}
          clipX={slot.x}
          clipY={slot.y}
          clipWidth={slot.width}
          clipHeight={slot.height}
        />
        {isSelected && (
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 50 || newBox.height < 50) {
                return oldBox;
              }
              return newBox;
            }}
          />
        )}
      </>
    );
  }
  
  // Placeholder with role info and loading state
  const getStatusIcon = () => {
    if (viewMode === 'layout') return null;
    if (!assetUrl) return '⚠️';
    if (imageStatus === 'loading') return '⏳';
    if (imageStatus === 'failed') return '❌';
    return null;
  };
  
  const getStatusText = () => {
    if (viewMode === 'layout') return null;
    if (!assetUrl) return 'No Asset';
    if (imageStatus === 'loading') return 'Loading...';
    if (imageStatus === 'failed') return 'Load Failed';
    return null;
  };
  
  return (
    <>
      <Rect
        ref={shapeRef}
        x={slot.x}
        y={slot.y}
        width={slot.width}
        height={slot.height}
        fill={roleConfig.color + '33'}
        stroke={roleConfig.color}
        strokeWidth={isSelected ? 3 : 2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={onDragEnd}
        onTransformEnd={handleTransform}
      />
      <KonvaText
        x={slot.x + 5}
        y={slot.y + 5}
        text={`${roleConfig.icon} ${roleConfig.label}`}
        fontSize={14}
        fill="#000"
        listening={false}
      />
      {/* Show status indicator in preview mode */}
      {viewMode === 'preview' && getStatusIcon() && (
        <>
          <KonvaText
            x={slot.x + slot.width / 2}
            y={slot.y + slot.height / 2 - 10}
            text={getStatusIcon()}
            fontSize={32}
            fill="#666"
            align="center"
            offsetX={16}
            listening={false}
          />
          <KonvaText
            x={slot.x + slot.width / 2}
            y={slot.y + slot.height / 2 + 25}
            text={getStatusText()}
            fontSize={14}
            fill="#666"
            align="center"
            offsetX={getStatusText().length * 3.5}
            listening={false}
          />
        </>
      )}
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 50) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

export default TemplateDesigner;
