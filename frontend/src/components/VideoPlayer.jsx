import React, { useState, useRef, useEffect } from 'react';
import './VideoPlayer.css';

const VideoPlayer = ({
  videoUrl,
  thumbnailUrl,
  trimStart = 0,
  trimEnd = null,
  onTrimChange,
  showTrimControls = true,
  autoPlay = false,
  className = '',
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingTrimStart, setIsDraggingTrimStart] = useState(false);
  const [isDraggingTrimEnd, setIsDraggingTrimEnd] = useState(false);

  // Local trim state
  const [localTrimStart, setLocalTrimStart] = useState(trimStart);
  const [localTrimEnd, setLocalTrimEnd] = useState(trimEnd);

  // Update local trim when props change
  useEffect(() => {
    setLocalTrimStart(trimStart);
    setLocalTrimEnd(trimEnd);
  }, [trimStart, trimEnd]);

  // Auto-play
  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play();
    }
  }, [autoPlay]);

  // Update time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Auto-pause at trim end
      if (localTrimEnd && time >= localTrimEnd) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Handle metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!localTrimEnd) {
        setLocalTrimEnd(dur);
      }
    }
  };

  // Play/Pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // If at trim end, restart from trim start
        if (localTrimEnd && currentTime >= localTrimEnd) {
          videoRef.current.currentTime = localTrimStart;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Seek
  const handleSeek = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Progress bar click
  const handleProgressClick = (e) => {
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const time = percent * duration;
      handleSeek(Math.max(0, Math.min(duration, time)));
    }
  };

  // Progress bar drag
  const handleProgressMouseDown = (e) => {
    setIsDraggingProgress(true);
    handleProgressClick(e);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingProgress && progressBarRef.current && duration > 0) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * duration;
        handleSeek(time);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingProgress(false);
    };

    if (isDraggingProgress) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingProgress, duration]);

  // Trim marker drag handlers
  const handleTrimStartDrag = (e) => {
    e.stopPropagation();
    setIsDraggingTrimStart(true);
  };

  const handleTrimEndDrag = (e) => {
    e.stopPropagation();
    setIsDraggingTrimEnd(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (progressBarRef.current && duration > 0) {
        const rect = progressBarRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * duration;

        if (isDraggingTrimStart) {
          const newStart = Math.max(0, Math.min(time, localTrimEnd - 1));
          setLocalTrimStart(newStart);
          if (onTrimChange) {
            onTrimChange({ start: newStart, end: localTrimEnd });
          }
        } else if (isDraggingTrimEnd) {
          const newEnd = Math.max(localTrimStart + 1, Math.min(time, duration));
          setLocalTrimEnd(newEnd);
          if (onTrimChange) {
            onTrimChange({ start: localTrimStart, end: newEnd });
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingTrimStart(false);
      setIsDraggingTrimEnd(false);
    };

    if (isDraggingTrimStart || isDraggingTrimEnd) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingTrimStart, isDraggingTrimEnd, duration, localTrimStart, localTrimEnd, onTrimChange]);

  // Jump to trim points
  const jumpToTrimStart = () => {
    handleSeek(localTrimStart);
  };

  const jumpToTrimEnd = () => {
    handleSeek(localTrimEnd);
  };

  // Volume
  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // Frame navigation
  const stepFrame = (direction) => {
    if (videoRef.current) {
      const frameTime = 1 / 30; // Assume 30fps
      const newTime = currentTime + direction * frameTime;
      handleSeek(Math.max(0, Math.min(duration, newTime)));
    }
  };

  // Format time
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00:00.000';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Calculate percentages for trim markers
  const trimStartPercent = duration > 0 ? (localTrimStart / duration) * 100 : 0;
  const trimEndPercent = duration > 0 ? (localTrimEnd / duration) * 100 : 100;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={containerRef} className={`video-player ${className} ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Video Element */}
      <div className="video-container">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          className="video-element"
        />

        {/* Play overlay */}
        {!isPlaying && (
          <div className="play-overlay" onClick={togglePlay}>
            <div className="play-button">▶</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className="progress-bar-container"
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          <div className="progress-bar-bg" />

          {/* Trim region */}
          {showTrimControls && (
            <div
              className="trim-region"
              style={{
                left: `${trimStartPercent}%`,
                width: `${trimEndPercent - trimStartPercent}%`,
              }}
            />
          )}

          {/* Progress */}
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Trim markers */}
          {showTrimControls && (
            <>
              <div
                className="trim-marker trim-marker-start"
                style={{ left: `${trimStartPercent}%` }}
                onMouseDown={handleTrimStartDrag}
                title="Trim Start"
              >
                <div className="marker-handle">◀</div>
              </div>
              <div
                className="trim-marker trim-marker-end"
                style={{ left: `${trimEndPercent}%` }}
                onMouseDown={handleTrimEndDrag}
                title="Trim End"
              >
                <div className="marker-handle">▶</div>
              </div>
            </>
          )}
        </div>

        {/* Control Buttons */}
        <div className="controls-row">
          {/* Left controls */}
          <div className="controls-left">
            <button className="control-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? '⏸' : '▶'}
            </button>

            {showTrimControls && (
              <>
                <button className="control-btn" onClick={jumpToTrimStart} title="Jump to Trim Start">
                  ⏮
                </button>
                <button className="control-btn" onClick={() => stepFrame(-1)} title="Previous Frame">
                  ⏪
                </button>
                <button className="control-btn" onClick={() => stepFrame(1)} title="Next Frame">
                  ⏩
                </button>
                <button className="control-btn" onClick={jumpToTrimEnd} title="Jump to Trim End">
                  ⏭
                </button>
              </>
            )}

            <div className="time-display">
              <span className="current-time">{formatTime(currentTime)}</span>
              <span className="time-separator">/</span>
              <span className="duration-time">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right controls */}
          <div className="controls-right">
            <div className="volume-control">
              <button className="control-btn" onClick={toggleMute}>
                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>

            <button className="control-btn" onClick={toggleFullscreen} title="Fullscreen">
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          </div>
        </div>

        {/* Trim Info */}
        {showTrimControls && (
          <div className="trim-info">
            <div className="trim-info-item">
              <span className="trim-label">Trim Start:</span>
              <span className="trim-value">{formatTime(localTrimStart)}</span>
            </div>
            <div className="trim-info-item">
              <span className="trim-label">Trim End:</span>
              <span className="trim-value">{formatTime(localTrimEnd)}</span>
            </div>
            <div className="trim-info-item">
              <span className="trim-label">Duration:</span>
              <span className="trim-value">{formatTime(localTrimEnd - localTrimStart)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
