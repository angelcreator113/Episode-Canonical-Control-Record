/**
 * StageSubtitles - Dialogue clip subtitle overlay
 * 
 * Renders the currently active dialogue clip as a subtitle
 * at the bottom of the stage, based on currentTime.
 */

import React, { useMemo } from 'react';

function StageSubtitles({ dialogueClips = [], currentTime = 0, duration = 5 }) {
  // Find the active clip based on currentTime
  const activeClip = useMemo(() => {
    if (!dialogueClips || dialogueClips.length === 0) return null;

    // If clips have explicit start/end times, use those
    for (const clip of dialogueClips) {
      const start = parseFloat(clip.startTime ?? clip.start_time ?? 0);
      const end = parseFloat(clip.endTime ?? clip.end_time ?? duration);
      if (currentTime >= start && currentTime < end) {
        return clip;
      }
    }

    // Fallback: distribute clips evenly across duration
    if (dialogueClips.length > 0) {
      const clipDuration = duration / dialogueClips.length;
      const idx = Math.min(
        Math.floor(currentTime / clipDuration),
        dialogueClips.length - 1
      );
      return dialogueClips[idx];
    }

    return null;
  }, [dialogueClips, currentTime, duration]);

  if (!activeClip) return null;

  const text = activeClip.text || activeClip.dialogue || activeClip.content || '';
  const speaker = activeClip.speaker || activeClip.character || activeClip.characterName || '';

  if (!text) return null;

  return (
    <div className="stage-subtitles">
      <div className="stage-subtitle-bar">
        {speaker && (
          <span className="stage-subtitle-speaker">{speaker}</span>
        )}
        <span className="stage-subtitle-text">{text}</span>
      </div>
    </div>
  );
}

export default StageSubtitles;
