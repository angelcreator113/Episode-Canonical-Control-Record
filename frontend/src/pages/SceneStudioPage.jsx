import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SceneStudio from '../components/SceneStudio/SceneStudio';

/**
 * SceneStudioPage — Route-level wrapper for Scene Studio.
 *
 * Supports two URL patterns:
 *   /studio/scene/:sceneId       — edit a scene
 *   /studio/scene-set/:sceneSetId — edit a scene set
 *
 * Query params:
 *   ?show_id=...     — show context for asset fetching
 *   ?episode_id=...  — episode context
 *   ?angle_id=...    — pre-select a specific angle (scene sets)
 */
export default function SceneStudioPage() {
  const { sceneId, sceneSetId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const showId = searchParams.get('show_id') || null;
  const episodeId = searchParams.get('episode_id') || null;

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <SceneStudio
      sceneId={sceneId || null}
      sceneSetId={sceneSetId || null}
      showId={showId}
      episodeId={episodeId}
      onBack={handleBack}
    />
  );
}
