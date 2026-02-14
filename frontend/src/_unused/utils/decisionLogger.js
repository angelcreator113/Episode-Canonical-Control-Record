import axios from 'axios';

class DecisionLogger {
  constructor() {
    this.enabled = true;
    this.currentEpisodeId = null;
    this.currentSceneId = null;
  }

  setContext(episodeId, sceneId) {
    this.currentEpisodeId = episodeId;
    this.currentSceneId = sceneId;
  }

  async log(actionType, entityType, entityId, actionData, contextData = {}) {
    if (!this.enabled || !this.currentEpisodeId) return;

    try {
      await axios.post('/api/v1/decision-logs', {
        episode_id: this.currentEpisodeId,
        scene_id: this.currentSceneId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        action_data: actionData,
        context_data: {
          ...contextData,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Silently fail to prevent disrupting the UI
      if (process.env.NODE_ENV === 'development') {
        console.warn('Decision log failed (non-blocking):', error.message);
      }
    }
  }

  // Convenience methods for common actions
  logAssetPositioned(assetId, position, size, layerNumber) {
    this.log('ASSET_POSITIONED', 'asset', assetId, {
      position_x: position.x,
      position_y: position.y,
      width: size.width,
      height: size.height,
      layer_number: layerNumber
    });
  }

  logTimingSet(assetId, inPoint, outPoint, duration) {
    this.log('TIMING_SET', 'asset', assetId, {
      in_point_seconds: inPoint,
      out_point_seconds: outPoint,
      duration: duration
    });
  }

  logLayerCreated(layerId, layerNumber, layerType) {
    this.log('LAYER_CREATED', 'layer', layerId, {
      layer_number: layerNumber,
      layer_type: layerType
    });
  }

  logSceneCreated(sceneId, sceneName, sceneNumber) {
    this.log('SCENE_CREATED', 'scene', sceneId, {
      scene_name: sceneName,
      scene_number: sceneNumber
    });
  }

  logAssetPropertyChanged(assetId, property, oldValue, newValue) {
    this.log('PROPERTY_CHANGED', 'asset', assetId, {
      property,
      old_value: oldValue,
      new_value: newValue
    });
  }
}

export default new DecisionLogger();
