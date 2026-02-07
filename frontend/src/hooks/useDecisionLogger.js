import { useCallback } from 'react';
import { logDecision, createDecisionData } from '../services/decisionService';

/**
 * Custom hook for logging user decisions
 * Provides easy-to-use functions for tracking decisions throughout the app
 */
export const useDecisionLogger = () => {
  /**
   * Log a decision (generic)
   */
  const log = useCallback(async (decisionData) => {
    try {
      const result = await logDecision(decisionData);
      console.log('✅ Decision logged:', result.decision.decision_type);
      return result;
    } catch (error) {
      console.error('❌ Failed to log decision:', error);
      // Silent fail - don't interrupt user experience
      return null;
    }
  }, []);

  /**
   * Log scene duration change
   */
  const logSceneDuration = useCallback(async (episodeId, sceneId, duration, previousDuration = null) => {
    const data = createDecisionData.sceneDuration(episodeId, sceneId, duration, previousDuration);
    return await log(data);
  }, [log]);

  /**
   * Log asset selection
   */
  const logAssetSelection = useCallback(async (episodeId, sceneId, assetId, assetType, rejectedAssets = []) => {
    const data = createDecisionData.assetSelection(episodeId, sceneId, assetId, assetType, rejectedAssets);
    return await log(data);
  }, [log]);

  /**
   * Log scene linking decision
   * @param {string} episodeId - Episode ID
   * @param {string} scriptMetadataId - AI-detected scene (script_metadata_id)
   * @param {string} footageId - Uploaded footage scene ID
   * @param {string} matchType - 'manual' or 'auto'
   * @param {number} confidence - AI confidence score (if auto)
   */
  const logSceneLink = useCallback(async (episodeId, scriptMetadataId, footageId, matchType = 'manual', confidence = null) => {
    const data = createDecisionData.sceneLink(episodeId, scriptMetadataId, footageId, matchType, confidence);
    return await log(data);
  }, [log]);

  /**
   * Log AI suggestion feedback
   */
  const logAIFeedback = useCallback(async (episodeId, decisionType, suggestion, accepted, rating = null) => {
    const data = createDecisionData.aiSuggestionFeedback(episodeId, decisionType, suggestion, accepted, rating);
    return await log(data);
  }, [log]);

  /**
   * Log transition choice
   */
  const logTransition = useCallback(async (episodeId, sceneId, transitionType, duration = null) => {
    const data = {
      episode_id: episodeId,
      scene_id: sceneId,
      decision_type: 'transition_type',
      decision_category: 'style',
      chosen_option: { type: transitionType, duration },
      context_data: { transition_type: transitionType },
    };
    return await log(data);
  }, [log]);

  /**
   * Log music/audio choice
   */
  const logMusicChoice = useCallback(async (episodeId, sceneId, audioId, audioType) => {
    const data = {
      episode_id: episodeId,
      scene_id: sceneId,
      decision_type: 'music_choice',
      decision_category: 'content',
      chosen_option: { audio_id: audioId, audio_type: audioType },
      context_data: { audio_type: audioType },
    };
    return await log(data);
  }, [log]);

  /**
   * Log pacing adjustment
   */
  const logPacingAdjustment = useCallback(async (episodeId, pacingLevel, previousPacing = null) => {
    const data = {
      episode_id: episodeId,
      decision_type: 'pacing_adjustment',
      decision_category: 'timing',
      chosen_option: { pacing: pacingLevel },
      rejected_options: previousPacing ? [{ pacing: previousPacing }] : null,
      context_data: { changed_from: previousPacing },
    };
    return await log(data);
  }, [log]);

  return {
    log,
    logSceneDuration,
    logAssetSelection,
    logSceneLink,
    logAIFeedback,
    logTransition,
    logMusicChoice,
    logPacingAdjustment,
  };
};

export default useDecisionLogger;
