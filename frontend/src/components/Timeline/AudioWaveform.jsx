import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import './AudioWaveform.css';

/**
 * AudioWaveform — renders a waveform visualization inside the audio track.
 * Syncs with the parent timeline's currentTime and pixelsPerSecond.
 *
 * Props:
 *   audioUrl       - URL to the audio file
 *   currentTime    - current playhead time in seconds
 *   totalDuration  - full timeline duration
 *   pixelsPerSecond - timeline zoom scale
 *   clipStartTime  - where the clip starts on the timeline (seconds)
 *   clipDuration   - clip duration (seconds)
 *   volume         - 0-1 volume level
 *   onSeek         - (time) => void — seek callback in timeline time
 *   isPlaying      - whether the parent timeline is playing
 */
function AudioWaveform({
  audioUrl,
  currentTime = 0,
  totalDuration = 0,
  pixelsPerSecond = 50,
  clipStartTime = 0,
  clipDuration = 5,
  volume = 1.0,
  onSeek,
  isPlaying = false
}) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const suppressSeek = useRef(false);

  // Create / destroy wavesurfer instance
  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;

    setReady(false);
    setError(null);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(236, 72, 153, 0.5)',
      progressColor: '#ec4899',
      cursorColor: 'transparent',       // parent playhead handles cursor
      barWidth: 2,
      barRadius: 2,
      barGap: 1,
      height: 48,
      normalize: true,
      interact: true,
      fillParent: true,
      minPxPerSec: 0,
      backend: 'WebAudio',
      mediaControls: false,
      autoplay: false,
    });

    ws.load(audioUrl);

    ws.on('ready', () => {
      setReady(true);
      ws.setVolume(volume);
    });

    ws.on('error', (err) => {
      console.warn('AudioWaveform: load error', err);
      setError('Could not load audio');
    });

    // When user clicks the waveform, translate to timeline time
    ws.on('seek', (progress) => {
      if (suppressSeek.current) return;
      const wsDuration = ws.getDuration();
      if (wsDuration && onSeek) {
        const localTime = progress * wsDuration;
        onSeek(clipStartTime + localTime);
      }
    });

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
      setReady(false);
    };
  }, [audioUrl]); // re-create only when URL changes

  // Sync volume
  useEffect(() => {
    if (wsRef.current && ready) {
      wsRef.current.setVolume(volume);
    }
  }, [volume, ready]);

  // Sync playhead from parent currentTime → wavesurfer seekTo
  useEffect(() => {
    if (!wsRef.current || !ready) return;
    const wsDuration = wsRef.current.getDuration();
    if (!wsDuration) return;

    // Convert timeline time to local clip-relative progress 0..1
    const localTime = currentTime - clipStartTime;
    const progress = Math.max(0, Math.min(localTime / wsDuration, 1));

    suppressSeek.current = true;
    wsRef.current.seekTo(progress);
    suppressSeek.current = false;
  }, [currentTime, clipStartTime, ready]);

  // Sync play/pause
  useEffect(() => {
    if (!wsRef.current || !ready) return;
    const localTime = currentTime - clipStartTime;
    const inRange = localTime >= 0 && localTime < clipDuration;

    if (isPlaying && inRange) {
      if (!wsRef.current.isPlaying()) {
        wsRef.current.play();
      }
    } else {
      if (wsRef.current.isPlaying()) {
        wsRef.current.pause();
      }
    }
  }, [isPlaying, currentTime, clipStartTime, clipDuration, ready]);

  // Width matches clip duration in the timeline
  const widthPx = clipDuration * pixelsPerSecond;

  return (
    <div
      className="awf-container"
      style={{ width: `${widthPx}px` }}
    >
      <div ref={containerRef} className="awf-waveform" />
      {!ready && !error && (
        <div className="awf-loading">
          <span className="awf-loading-pulse" />
          Loading…
        </div>
      )}
      {error && (
        <div className="awf-error">{error}</div>
      )}
    </div>
  );
}

export default AudioWaveform;
