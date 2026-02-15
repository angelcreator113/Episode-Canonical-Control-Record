import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Timeline from '../components/Timeline/Timeline';
import PreviewMonitor from '../components/Timeline/PreviewMonitor';
import KeyframePropertyEditor from '../components/Timeline/KeyframePropertyEditor';
import SaveIndicator from '../components/SaveIndicator/SaveIndicator';
import ExportDropdown from '../components/ExportDropdown/ExportDropdown';
import useSaveManager from '../hooks/useSaveManager';
import LandscapeRequired from '../components/LandscapeRequired';
import { episodeAPI, platformAPI, sceneAPI, timelineDataAPI } from '../services/api';
import { API_URL } from '../config/api';
import '../components/Timeline/TimelineEditor.css';

function TimelineEditor() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [episode, setEpisode] = useState(null);
  const [platform, setPlatform] = useState('youtube');
  const [scenes, setScenes] = useState([]);
  const [beats, setBeats] = useState([]);
  const [characterClips, setCharacterClips] = useState([]);
  const [audioClips, setAudioClips] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [keyframes, setKeyframes] = useState([]);
  const [selectedKeyframe, setSelectedKeyframe] = useState(null);
  const [snapToBeat, setSnapToBeat] = useState(true);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1.0); // Zoom for preview canvas
  const [timelineZoom, setTimelineZoom] = useState(1.0); // Zoom for timeline tracks
  const [loading, setLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loopMode, setLoopMode] = useState(false);
  const [selectedScene, setSelectedScene] = useState(null);
  const timelineWrapperRef = useRef(null);
  const previewSectionRef = useRef(null);
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem('timeline-split-ratio');
    return saved ? parseFloat(saved) : 0.55;
  });
  const splitterRef = useRef(null);
  const editorRef = useRef(null);
  const keyframeShortcutRef = useRef(null);
  const markerShortcutRef = useRef(null);

  const platforms = {
    youtube:    { width: 1920, height: 1080, ratio: '16:9',  name: 'YouTube',        icon: '📺' },
    instagram:  { width: 1080, height: 1080, ratio: '1:1',   name: 'Instagram Post', icon: '📷' },
    reels:      { width: 1080, height: 1920, ratio: '9:16',  name: 'Reels/TikTok',   icon: '📱' },
    ig_story:   { width: 1080, height: 1920, ratio: '9:16',  name: 'IG Story',       icon: '📲' },
    ig_feed:    { width: 1080, height: 1350, ratio: '4:5',   name: 'IG Feed',        icon: '🖼️' },
    tiktok:     { width: 1080, height: 1920, ratio: '9:16',  name: 'TikTok',         icon: '🎵' },
    twitter:    { width: 1920, height: 1080, ratio: '16:9',  name: 'Twitter/X',      icon: '🐦' },
    facebook:   { width: 1920, height: 1080, ratio: '16:9',  name: 'Facebook',       icon: '📘' },
    shorts:     { width: 1080, height: 1920, ratio: '9:16',  name: 'YT Shorts',      icon: '⚡' },
    ultrawide:  { width: 2560, height: 1080, ratio: '21:9',  name: 'Ultrawide',      icon: '🖥️' },
  };
  const currentPlatform = platforms[platform];
  const [showSafeZones, setShowSafeZones] = useState(false);

  // Save system
  const getSavePayload = useCallback(() => ({
    episode: episode ? { title: episode.title, episode_number: episode.episode_number } : {},
    platform: {
      platform,
      width: currentPlatform.width,
      height: currentPlatform.height,
      aspect_ratio: currentPlatform.ratio,
    },
    scenes: scenes.map((scene, idx) => ({
      id: scene.id,
      scene_number: scene.scene_number || idx + 1,
      title: scene.title,
      duration_seconds: scene.duration_seconds,
      background_url: scene.background_url,
      characters: scene.characters,
      ui_elements: scene.ui_elements,
    })),
    timeline: { beats, markers, audioClips, characterClips, keyframes },
  }), [episode, platform, scenes, beats, markers, audioClips, characterClips, keyframes, currentPlatform]);

  const { saveStatus, lastSaved, errorMessage, save, markDirty } = useSaveManager({
    episodeId,
    getSavePayload,
    autoSaveDelay: 3000,
    enabled: true
  });

  // ── Undo / Redo history ──
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const MAX_HISTORY = 50;

  const getSnapshot = useCallback(() => ({
    scenes: JSON.parse(JSON.stringify(scenes)),
    beats: JSON.parse(JSON.stringify(beats)),
    markers: JSON.parse(JSON.stringify(markers)),
    audioClips: JSON.parse(JSON.stringify(audioClips)),
    characterClips: JSON.parse(JSON.stringify(characterClips)),
    keyframes: JSON.parse(JSON.stringify(keyframes)),
  }), [scenes, beats, markers, audioClips, characterClips, keyframes]);

  const pushHistory = useCallback(() => {
    const snap = getSnapshot();
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length);
    setRedoCount(0);
  }, [getSnapshot]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const current = getSnapshot();
    redoStackRef.current.push(current);
    const prev = undoStackRef.current.pop();
    setScenes(prev.scenes);
    setBeats(prev.beats);
    setMarkers(prev.markers);
    setAudioClips(prev.audioClips);
    setCharacterClips(prev.characterClips);
    if (prev.keyframes) setKeyframes(prev.keyframes);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    markDirty();
  }, [getSnapshot, markDirty]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const current = getSnapshot();
    undoStackRef.current.push(current);
    const next = redoStackRef.current.pop();
    setScenes(next.scenes);
    setBeats(next.beats);
    setMarkers(next.markers);
    setAudioClips(next.audioClips);
    setCharacterClips(next.characterClips);
    if (next.keyframes) setKeyframes(next.keyframes);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    markDirty();
  }, [getSnapshot, markDirty]);

  const totalDuration = useMemo(() => {
    return scenes.reduce((sum, scene) => sum + (parseFloat(scene.duration_seconds) || 0), 0);
  }, [scenes]);

  const getCurrentScene = useMemo(() => {
    let accumulatedTime = 0;
    for (const scene of scenes) {
      const duration = parseFloat(scene.duration_seconds) || 0;
      const sceneStart = accumulatedTime;
      const sceneEnd = accumulatedTime + duration;
      
      if (currentTime >= sceneStart && currentTime < sceneEnd) {
        return { 
          ...scene, 
          startTime: sceneStart, 
          endTime: sceneEnd,
          relativeTime: currentTime - sceneStart 
        };
      }
      accumulatedTime += duration;
    }
    return scenes.length > 0 ? { ...scenes[scenes.length - 1], startTime: totalDuration } : null;
  }, [scenes, currentTime, totalDuration]);

  useEffect(() => {
    loadEpisodeData();
  }, [episodeId]);

  // Playback loop — requestAnimationFrame for smooth, frame-accurate playback
  useEffect(() => {
    if (!isPlaying) return;
    let rafId;
    let lastTimestamp = null;

    const animate = (timestamp) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const deltaMs = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      setCurrentTime(prev => {
        const increment = (deltaMs / 1000) * playbackSpeed;
        const newTime = prev + increment;
        if (newTime >= totalDuration) {
          if (loopMode) return 0;
          setIsPlaying(false);
          return totalDuration;
        }
        return newTime;
      });

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, totalDuration, playbackSpeed, loopMode]);

  // Keyboard shortcuts — NLE-standard (Space, J/K/L shuttle, comma/period frame step)
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Undo / Redo — Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      switch(e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentTime(prev => Math.max(0, prev - (e.shiftKey ? 1 : 5)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentTime(prev => Math.min(totalDuration, prev + (e.shiftKey ? 1 : 5)));
          break;
        case 'Home':
          e.preventDefault();
          setCurrentTime(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentTime(totalDuration);
          break;
        case 'j':
        case 'J':
          // J — Slow down / reverse step
          e.preventDefault();
          setPlaybackSpeed(prev => Math.max(0.25, prev - 0.25));
          setIsPlaying(true);
          break;
        case 'k':
        case 'K':
          // K — Pause
          e.preventDefault();
          setIsPlaying(false);
          break;
        case 'l':
        case 'L':
          // L — Play / speed up
          e.preventDefault();
          setPlaybackSpeed(prev => Math.min(2, prev + 0.25));
          setIsPlaying(true);
          break;
        case ',':
          // Comma — Step back 1 frame (1/30s)
          e.preventDefault();
          setIsPlaying(false);
          setCurrentTime(prev => Math.max(0, prev - 1/30));
          break;
        case '.':
          // Period — Step forward 1 frame (1/30s)
          e.preventDefault();
          setIsPlaying(false);
          setCurrentTime(prev => Math.min(totalDuration, prev + 1/30));
          break;
        case 'r':
        case 'R':
          // R — Toggle loop
          setLoopMode(prev => !prev);
          break;
        case 'b':
        case 'B':
          // B — Toggle snap-to-beat
          setSnapToBeat(prev => !prev);
          break;
        case 'F6':
          // F6 — Add keyframe at current time (inline to avoid TDZ)
          e.preventDefault();
          keyframeShortcutRef.current?.();
          break;
        case 'm':
        case 'M':
          // M — Add marker (with snapshot)
          e.preventDefault();
          markerShortcutRef.current?.();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [totalDuration, handleUndo, handleRedo]);

  const loadEpisodeData = async () => {
    setLoading(true);
    try {
      // Load episode, platform, scenes, and timeline data in parallel
      const [episodeRes, platformRes, scenesRes, timelineRes] = await Promise.all([
        episodeAPI.getById(episodeId),
        platformAPI.get(episodeId),
        sceneAPI.getAll(episodeId),
        timelineDataAPI.get(episodeId),
      ]);

      const ep = episodeRes.data.episode || episodeRes.data;
      setEpisode(ep);

      const plat = platformRes.data;
      setPlatform(plat.platform || 'youtube');

      // Load scenes
      const loadedScenes = scenesRes.data;
      if (loadedScenes && loadedScenes.length > 0) {
        setScenes(loadedScenes.map((s, i) => ({
          id: s.id,
          scene_number: s.sceneNumber || s.scene_number || i + 1,
          title: s.title || `Scene ${i + 1}`,
          duration_seconds: parseFloat(s.durationSeconds || s.duration_seconds) || 5.0,
          background_url: s.background_url || s.backgroundUrl || null,
          characters: s.characters || [],
          ui_elements: s.uiElements || s.ui_elements || [],
        })));
      } else {
        setScenes([
          { id: 'scene-1', scene_number: 1, title: 'Scene 1', duration_seconds: 5.0, background_url: null, characters: [], ui_elements: [] },
          { id: 'scene-2', scene_number: 2, title: 'Scene 2', duration_seconds: 8.0, background_url: null, characters: [], ui_elements: [] },
          { id: 'scene-3', scene_number: 3, title: 'Scene 3', duration_seconds: 10.0, background_url: null, characters: [], ui_elements: [] },
        ]);
      }

      // Load timeline data (beats, markers, audio/character clips)
      const tl = timelineRes.data;
      setBeats(tl.beats || tl.beats || []);
      setMarkers(tl.markers || []);
      setAudioClips(tl.audioClips || tl.audio_clips || []);
      setCharacterClips(tl.characterClips || tl.character_clips || []);
      setKeyframes(tl.keyframes || []);
    } catch (error) {
      console.warn('API unavailable, using mock data:', error.message);
      setEpisode({
        id: episodeId,
        episode_number: 1,
        title: 'Untitled Episode',
        platform: 'youtube',
      });
      setPlatform('youtube');
      setScenes([
        { id: 'scene-1', scene_number: 1, title: 'Intro', duration_seconds: 5.0, background_url: null, characters: [], ui_elements: [] },
        { id: 'scene-2', scene_number: 2, title: 'Main Content', duration_seconds: 8.0, background_url: null, characters: [], ui_elements: [] },
        { id: 'scene-3', scene_number: 3, title: 'Outro', duration_seconds: 10.0, background_url: null, characters: [], ui_elements: [] },
      ]);
      setBeats([]);
      setCharacterClips([]);
      setAudioClips([]);
      setMarkers([]);
      setKeyframes([]);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = useCallback((time) => {
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  }, [totalDuration]);

  const handleRewind = () => {
    setCurrentTime(prev => Math.max(0, prev - 5));
  };

  const handleFastForward = () => {
    setCurrentTime(prev => Math.min(totalDuration, prev + 5));
  };

  // Canvas zoom controls — zoom the preview video canvas
  // At zoom=1.0 the canvas auto-fills the viewport via ResizeObserver inside PreviewMonitor
  const handleZoomIn = () => setCanvasZoom(prev => Math.min(prev + 0.1, 3.0));
  const handleZoomOut = () => setCanvasZoom(prev => Math.max(prev - 0.1, 0.25));
  const handleFitToView = () => setCanvasZoom(1.0);

  // Platform change handler
  const handlePlatformChange = useCallback((key) => {
    if (platforms[key]) {
      setPlatform(key);
      setCanvasZoom(1.0); // re-fit on platform switch
      markDirty();
    }
  }, [markDirty]);

  // Timeline zoom — zoom=1.0 (100%) fits the full timeline in view
  const handleTimelineZoomIn = () => setTimelineZoom(prev => Math.min(prev + 0.25, 8.0));
  const handleTimelineZoomOut = () => setTimelineZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleTimelineFitToView = () => setTimelineZoom(1.0);

  // Reset canvas zoom on mount / platform / resize
  useEffect(() => {
    if (!loading) setCanvasZoom(1.0);
  }, [loading, platform, splitRatio]);

  // No auto-fit needed — zoom=1.0 (initial) already fits the full timeline

  const handleAddBeat = () => {
    pushHistory();
    const newBeat = {
      id: `beat-${Date.now()}`,
      time: currentTime,
      title: `Beat ${beats.length + 1}`,
      type: 'story',
      color: '#a855f7'
    };
    setBeats([...beats, newBeat]);
    markDirty();
    console.log('✅ Beat added:', newBeat);
  };

  const handleAddMarker = () => {
    pushHistory();
    // Capture canvas snapshot for thumbnail
    let snapshot = null;
    try {
      const canvas = document.querySelector('.preview-monitor canvas, .preview-canvas canvas');
      if (canvas) {
        snapshot = canvas.toDataURL('image/png');
      }
    } catch (err) {
      console.warn('Could not capture marker snapshot:', err);
    }

    const newMarker = {
      id: `marker-${Date.now()}`,
      time: currentTime,
      label: `Marker ${markers.length + 1}`,
      color: '#667eea',
      snapshot,
      notes: ''
    };
    setMarkers([...markers, newMarker]);
    markDirty();
    console.log('✅ Marker added with snapshot:', newMarker);
  };

  const handleAddAudio = () => {
    pushHistory();
    const newAudio = {
      id: `audio-${Date.now()}`,
      name: `Audio ${audioClips.length + 1}`,
      startTime: currentTime,
      duration: 5.0,
      volume: 1.0,
      audioUrl: null
    };
    setAudioClips([...audioClips, newAudio]);
    markDirty();
    console.log('✅ Audio clip added:', newAudio);
  };

  const handleSceneSelect = (sceneId) => {
    let time = 0;
    for (const scene of scenes) {
      if (scene.id === sceneId) break;
      time += parseFloat(scene.duration_seconds) || 0;
    }
    setCurrentTime(time);
    setSelectedScene(sceneId);
  };

  const handleAddScene = () => {
    pushHistory();
    const newScene = {
      id: `scene-${Date.now()}`,
      scene_number: scenes.length + 1,
      title: `Scene ${scenes.length + 1}`,
      duration_seconds: 5.0,
      background_url: null,
      characters: [],
      ui_elements: []
    };
    setScenes([...scenes, newScene]);
    markDirty();
    console.log('✅ Scene added:', newScene);
  };

  const handleDeleteScene = (sceneId) => {
    if (scenes.length <= 1) {
      alert('Cannot delete the last scene');
      return;
    }
    pushHistory();
    setScenes(
      scenes.filter(s => s.id !== sceneId)
        .map((s, i) => ({
          ...s,
          scene_number: i + 1,
          title: /^Scene \d+$/.test(s.title) ? `Scene ${i + 1}` : s.title
        }))
    );
    if (selectedScene === sceneId) setSelectedScene(null);
    markDirty();
    console.log('✅ Scene deleted:', sceneId);
  };

  const handleUpdateSceneDuration = (sceneId, newDuration) => {
    pushHistory();
    setScenes(scenes.map(s => 
      s.id === sceneId ? { ...s, duration_seconds: parseFloat(newDuration) || 0 } : s
    ));
    markDirty();
    console.log('✅ Scene duration updated:', sceneId, newDuration);
  };

  const handleDeleteBeat = (beatId) => {
    pushHistory();
    setBeats(beats.filter(b => b.id !== beatId));
    markDirty();
    console.log('✅ Beat deleted:', beatId);
  };

  const handleDeleteMarker = (markerId) => {
    pushHistory();
    setMarkers(markers.filter(m => m.id !== markerId));
    markDirty();
    console.log('✅ Marker deleted:', markerId);
  };

  const handleReorderScenes = (fromIndex, toIndex) => {
    pushHistory();
    const reordered = [...scenes];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    // Re-number scenes and update auto-generated titles
    const renumbered = reordered.map((s, i) => ({
      ...s,
      scene_number: i + 1,
      title: /^Scene \d+$/.test(s.title) ? `Scene ${i + 1}` : s.title
    }));
    setScenes(renumbered);
    markDirty();
    console.log('✅ Scenes reordered');
  };

  const handleResizeScene = useCallback((sceneId, newDuration) => {
    pushHistory();
    const clamped = Math.max(0.5, Math.round(newDuration * 10) / 10);
    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, duration_seconds: clamped } : s
    ));
    markDirty();
  }, [markDirty, pushHistory]);

  const handleUpdateBeat = (beatId, updates) => {
    pushHistory();
    setBeats(beats.map(b => b.id === beatId ? { ...b, ...updates } : b));
    markDirty();
  };

  const handleUpdateMarker = useCallback((markerId, updates) => {
    pushHistory();
    setMarkers(prev => prev.map(m => m.id === markerId ? { ...m, ...updates } : m));
    markDirty();
  }, [markDirty, pushHistory]);

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
  };

  const handleToggleLoop = () => {
    setLoopMode(!loopMode);
    console.log('✅ Loop mode:', !loopMode);
  };

  // ── Keyframe handlers ──
  const handleAddKeyframe = useCallback((time) => {
    pushHistory();
    const newKeyframe = {
      id: `kf-${Date.now()}`,
      time: Math.round(time * 100) / 100,
      properties: {
        x: 50,
        y: 50,
        scale: 1.0,
        opacity: 1.0,
        rotation: 0
      }
    };
    setKeyframes(prev => [...prev, newKeyframe]);
    setSelectedKeyframe(newKeyframe.id);
    markDirty();
    console.log('✅ Keyframe added at', newKeyframe.time);
  }, [pushHistory, markDirty]);

  const handleDeleteKeyframe = useCallback((id) => {
    pushHistory();
    setKeyframes(prev => prev.filter(kf => kf.id !== id));
    if (selectedKeyframe === id) setSelectedKeyframe(null);
    markDirty();
    console.log('✅ Keyframe deleted:', id);
  }, [pushHistory, markDirty, selectedKeyframe]);

  const handleDragKeyframe = useCallback((id, newTime) => {
    setKeyframes(prev => prev.map(kf =>
      kf.id === id ? { ...kf, time: Math.round(newTime * 100) / 100 } : kf
    ));
    markDirty();
  }, [markDirty]);

  const handleSelectKeyframe = useCallback((id) => {
    setSelectedKeyframe(id);
  }, []);

  const handleUpdateKeyframeProperties = useCallback((id, newProps) => {
    setKeyframes(prev => prev.map(kf =>
      kf.id === id ? { ...kf, properties: newProps } : kf
    ));
    markDirty();
  }, [markDirty]);

  const handleToggleSnapToBeat = useCallback(() => {
    setSnapToBeat(prev => !prev);
    console.log('✅ Snap-to-beat:', !snapToBeat);
  }, [snapToBeat]);

  // Look up the full selected keyframe object for the property editor
  const selectedKeyframeObj = useMemo(() => {
    if (!selectedKeyframe) return null;
    return keyframes.find(kf => kf.id === selectedKeyframe) || null;
  }, [selectedKeyframe, keyframes]);

  // Keep refs in sync for keyboard shortcut access (avoids TDZ in useEffect)
  keyframeShortcutRef.current = () => handleAddKeyframe(currentTime);
  markerShortcutRef.current = handleAddMarker;

  // ── Keyframe interpolation — compute live transforms for PreviewMonitor ──
  const interpolatedTransforms = useMemo(() => {
    if (keyframes.length === 0) return null;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    // Before first keyframe
    if (currentTime <= sorted[0].time) return { ...sorted[0].properties };
    // After last keyframe
    if (currentTime >= sorted[sorted.length - 1].time) return { ...sorted[sorted.length - 1].properties };
    // Find surrounding keyframes and lerp
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (currentTime >= a.time && currentTime <= b.time) {
        const t = (currentTime - a.time) / (b.time - a.time);
        const props = {};
        for (const key of Object.keys(a.properties)) {
          const va = parseFloat(a.properties[key]) || 0;
          const vb = parseFloat(b.properties[key]) || 0;
          props[key] = va + (vb - va) * t;
        }
        return props;
      }
    }
    return null;
  }, [keyframes, currentTime]);

  // Splitter drag handler
  const handleSplitterMouseDown = useCallback((e) => {
    e.preventDefault();
    const editorEl = editorRef.current;
    if (!editorEl) return;

    const headerHeight = 72; // fixed header
    const startY = e.clientY;
    const startRatio = splitRatio;
    const editorHeight = editorEl.clientHeight - headerHeight;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientY - startY;
      const newRatio = startRatio + (delta / editorHeight);
      const clamped = Math.max(0.25, Math.min(0.75, newRatio));
      setSplitRatio(clamped);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSplitRatio(r => { localStorage.setItem('timeline-split-ratio', r); return r; });
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [splitRatio]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timecode display (MM:SS:FF at 30fps)
  const formatTimecode = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="timeline-editor">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading timeline...</p>
        </div>
      </div>
    );
  }

  // Compute section heights (header is 72px fixed)
  const previewHeight = `calc((100vh - 72px) * ${splitRatio})`;
  const timelineHeight = `calc((100vh - 72px) * ${1 - splitRatio})`;

  return (
    <LandscapeRequired>
    <div className="timeline-editor" ref={editorRef}>
      {/* Header */}
      <header className="timeline-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(`/episodes/${episodeId}`)}>
            ← Back
          </button>
          <div className="episode-info">
            <h1>Timeline Editor</h1>
            <span className="episode-meta">
              Episode {episode?.episode_number} · {episode?.title} · {currentPlatform.icon} {currentPlatform.name}
            </span>
          </div>
          <div className="undo-redo-group">
            <button
              className="undo-redo-btn"
              onClick={handleUndo}
              disabled={undoCount === 0}
              title="Undo (Ctrl+Z)"
            >
              ↩
            </button>
            <button
              className="undo-redo-btn"
              onClick={handleRedo}
              disabled={redoCount === 0}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↪
            </button>
          </div>
        </div>

        <div className="header-right">
          <SaveIndicator
            saveStatus={saveStatus}
            lastSaved={lastSaved}
            errorMessage={errorMessage}
            onSave={save}
          />
          <div className="keyboard-shortcuts-hint">
            <span className="hint-icon">⌨️</span>
            <span className="hint-text">Space: Play · J/K/L: Shuttle · ,/.: Frame Step · ←→: Seek · R: Loop</span>
          </div>
          <ExportDropdown episodeId={episodeId} />
        </div>
      </header>

      {/* Preview Monitor */}
      <div className="preview-section" ref={previewSectionRef} style={{ height: previewHeight, minHeight: 200, maxHeight: 'none' }}>
        <PreviewMonitor
          scenes={scenes}
          currentTime={currentTime}
          isPlaying={isPlaying}
          totalDuration={totalDuration}
          platform={currentPlatform}
          platformKey={platform}
          canvasZoom={canvasZoom}
          showSafeZones={showSafeZones}
          keyframeTransforms={interpolatedTransforms}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitToView={handleFitToView}
          onPlatformChange={handlePlatformChange}
          onToggleSafeZones={() => setShowSafeZones(prev => !prev)}
        />
      </div>

      {/* Resizable Splitter */}
      <div
        className="timeline-splitter"
        ref={splitterRef}
        onMouseDown={handleSplitterMouseDown}
        title="Drag to resize preview / timeline"
      >
        <div className="splitter-handle" />
      </div>

          {/* Timeline Section */}
          <div className="timeline-section" style={{ height: timelineHeight }}>
            <div className="timeline-controls">
              <div className="controls-left">
                <div className="timecode-display">
                  <span className="timecode current">{formatTimecode(currentTime)}</span>
                  <span className="timecode-separator">/</span>
                  <span className="timecode total">{formatTimecode(totalDuration)}</span>
                </div>
                <div className="playback-controls-group">
                  <label className="control-label">Speed:</label>
                  <select 
                    className="speed-select" 
                    value={playbackSpeed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  >
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
                <button 
                  className={`control-btn loop-btn ${loopMode ? 'active' : ''}`}
                  onClick={handleToggleLoop}
                  title="Toggle Loop (R)"
                >
                  🔁
                </button>
              </div>

              <div className="controls-center">
                <div className="transport-controls">
                  <button className="transport-btn" onClick={() => setCurrentTime(0)} title="Go to Start (Home)">⏮</button>
                  <button className="transport-btn" onClick={handleRewind} title="Rewind 5s (←)">⏪</button>
                  <button className={`transport-btn play-btn ${isPlaying ? 'playing' : ''}`} onClick={handlePlayPause} title="Play/Pause (Space)">
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className="transport-btn" onClick={handleFastForward} title="Forward 5s (→)">⏩</button>
                  <button className="transport-btn" onClick={() => setCurrentTime(totalDuration)} title="Go to End (End)">⏭</button>
                </div>
              </div>

              <div className="controls-right">
                <button className="tool-btn" onClick={handleAddScene}>+ Scene</button>
                <button className="tool-btn" onClick={handleAddBeat}>+ Beat</button>
                <button className="tool-btn" onClick={handleAddMarker} title="Add Marker with snapshot (M)">+ Marker</button>
                <button className="tool-btn" onClick={handleAddAudio}>+ Audio</button>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button className="tool-btn" onClick={() => handleAddKeyframe(currentTime)} title="Add Keyframe (F6)">+ Keyframe {keyframes.length > 0 && <span className="badge">{keyframes.length}</span>}</button>
                  <KeyframePropertyEditor
                    keyframe={selectedKeyframeObj}
                    onUpdateProperties={handleUpdateKeyframeProperties}
                    onDelete={handleDeleteKeyframe}
                    onClose={() => setSelectedKeyframe(null)}
                  />
                </div>
                <button
                  className={`tool-btn ${snapToBeat ? 'active' : ''}`}
                  onClick={handleToggleSnapToBeat}
                  title="Snap to Beat (B)"
                >
                  🧲 Snap
                </button>
                <div className="controls-divider" />
                <div className="timeline-zoom-group">
                  <button className="control-btn sm" onClick={handleTimelineZoomOut} title="Timeline Zoom Out">−</button>
                  <span className="zoom-display">{Math.round(timelineZoom * 100)}%</span>
                  <button className="control-btn sm" onClick={handleTimelineZoomIn} title="Timeline Zoom In">+</button>
                  <button className="control-btn fit-btn sm" onClick={handleTimelineFitToView}>Fit</button>
                </div>
              </div>
            </div>

            <div className="timeline-wrapper" ref={timelineWrapperRef}>
              <Timeline
                scenes={scenes}
                beats={beats}
                characterClips={characterClips}
                audioClips={audioClips}
                markers={markers}
                keyframes={keyframes}
                currentTime={currentTime}
                totalDuration={totalDuration}
                zoom={timelineZoom}
                isPlaying={isPlaying}
                onSeek={handleSeek}
                onSceneSelect={handleSceneSelect}
                onSceneDelete={handleDeleteScene}
                onSceneDurationChange={handleUpdateSceneDuration}
                onBeatDelete={handleDeleteBeat}
                onMarkerDrag={handleUpdateMarker}
                onMarkerDelete={handleDeleteMarker}
                onSceneReorder={handleReorderScenes}
                onSceneResize={handleResizeScene}
                onAddKeyframe={handleAddKeyframe}
                onDeleteKeyframe={handleDeleteKeyframe}
                onSelectKeyframe={handleSelectKeyframe}
                onDragKeyframe={handleDragKeyframe}
                selectedKeyframe={selectedKeyframe}
                selectedScene={selectedScene}
                snapToBeat={snapToBeat}
              />
            </div>
          </div>
    </div>
    </LandscapeRequired>
  );
}

export default TimelineEditor;