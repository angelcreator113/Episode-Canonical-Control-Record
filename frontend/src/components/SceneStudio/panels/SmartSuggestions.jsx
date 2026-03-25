import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';
import sceneService from '../../../services/sceneService';

/**
 * SmartSuggestions — AI-powered object suggestions based on scene context.
 * Shows at the bottom of CreationPanel when scene has background but few objects.
 * Each suggestion is a one-click shortcut to the Generate tab with a pre-filled prompt.
 */
export default function SmartSuggestions({ sceneId, objectCount, hasBackground, onSuggestionClick, contextType }) {
  const [suggestions, setSuggestions] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Only show for scenes (not scene sets) with a background and < 4 objects
  const shouldShow = contextType === 'scene' && hasBackground && objectCount < 4 && !dismissed && sceneId;

  const fetchSuggestions = useCallback(async () => {
    if (!shouldShow || suggestions.length > 0) return;
    setLoading(true);
    try {
      const result = await sceneService.suggestObjects(sceneId);
      if (result?.success && result.data?.suggestions?.length > 0) {
        setSuggestions(result.data.suggestions.slice(0, 6));
      }
    } catch (err) {
      console.error('Smart suggestions error:', err);
    } finally {
      setLoading(false);
    }
  }, [sceneId, shouldShow, suggestions.length]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Auto-dismiss when user has enough objects
  useEffect(() => {
    if (objectCount >= 4) setDismissed(true);
  }, [objectCount]);

  if (!shouldShow || (suggestions.length === 0 && !loading)) return null;

  return (
    <div className="scene-studio-smart-suggestions">
      <div className="scene-studio-suggestions-header">
        <Sparkles size={12} />
        <span>Try adding</span>
        <button className="scene-studio-icon-btn" onClick={() => setDismissed(true)} title="Dismiss">
          <X size={10} />
        </button>
      </div>
      <div className="scene-studio-suggestions-list">
        {loading ? (
          <span className="scene-studio-suggestions-loading">Thinking...</span>
        ) : (
          suggestions.map((s, i) => (
            <button
              key={i}
              className="scene-studio-suggestion-chip"
              onClick={() => onSuggestionClick && onSuggestionClick(s.prompt || s.label)}
              title={s.prompt}
            >
              <Plus size={10} />
              {s.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
