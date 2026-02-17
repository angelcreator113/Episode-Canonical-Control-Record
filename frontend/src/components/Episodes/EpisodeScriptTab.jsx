// frontend/src/components/Episodes/EpisodeScriptTab.jsx
import React, { useState, useEffect } from 'react';
import './EpisodeScriptTab.css';

/**
 * EpisodeScriptTab - Structured dialogue editor
 * 
 * Format: Character Name + Dialogue blocks
 * Features: Add/remove dialogue blocks, reorder, YouTube description
 * Philosophy: Machine-readable, future-proof, AI-parseable
 */

function EpisodeScriptTab({ episode, onUpdate }) {
  const [dialogueBlocks, setDialogueBlocks] = useState([]);
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  useEffect(() => {
    loadScript();
  }, [episode.id, episode.script_content]);
  
  const loadScript = () => {
    console.log('📜 Loading script, episode.script_content:', episode.script_content);
    try {
      // Parse existing script (if it's JSON format)
      if (episode.script_content) {
        const parsed = JSON.parse(episode.script_content);
        console.log('📜 Parsed script data:', parsed);
        setDialogueBlocks(parsed.dialogue || []);
        setYoutubeDescription(parsed.youtubeDescription || '');
      } else {
        // Default empty state
        setDialogueBlocks([
          { id: Date.now(), character: 'Lala', dialogue: '' }
        ]);
        setYoutubeDescription('');
      }
    } catch (error) {
      console.error('📜 Error parsing script:', error);
      // If not JSON, treat as plain text and convert
      if (episode.script_content) {
        setDialogueBlocks([
          { id: Date.now(), character: 'Lala', dialogue: episode.script_content }
        ]);
      }
    }
  };
  
  const handleSave = async () => {
    try {
      const scriptData = {
        dialogue: dialogueBlocks,
        youtubeDescription: youtubeDescription
      };
      
      await onUpdate({
        script_content: JSON.stringify(scriptData)
      });
      
      setHasChanges(false);
      alert('Script saved successfully!');
    } catch (error) {
      console.error('Error saving script:', error);
      alert('Failed to save script');
    }
  };
  
  const addDialogueBlock = (afterIndex = -1) => {
    const newBlock = {
      id: Date.now(),
      character: 'Lala',
      dialogue: ''
    };
    
    const newBlocks = [...dialogueBlocks];
    if (afterIndex === -1) {
      newBlocks.push(newBlock);
    } else {
      newBlocks.splice(afterIndex + 1, 0, newBlock);
    }
    
    setDialogueBlocks(newBlocks);
    setHasChanges(true);
  };
  
  const removeDialogueBlock = (index) => {
    if (dialogueBlocks.length === 1) {
      alert('Cannot remove the last dialogue block');
      return;
    }
    
    const newBlocks = dialogueBlocks.filter((_, i) => i !== index);
    setDialogueBlocks(newBlocks);
    setHasChanges(true);
  };
  
  const updateDialogueBlock = (index, field, value) => {
    const newBlocks = [...dialogueBlocks];
    newBlocks[index][field] = value;
    setDialogueBlocks(newBlocks);
    setHasChanges(true);
  };
  
  const moveBlockUp = (index) => {
    if (index === 0) return;
    
    const newBlocks = [...dialogueBlocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    setDialogueBlocks(newBlocks);
    setHasChanges(true);
  };
  
  const moveBlockDown = (index) => {
    if (index === dialogueBlocks.length - 1) return;
    
    const newBlocks = [...dialogueBlocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    setDialogueBlocks(newBlocks);
    setHasChanges(true);
  };
  
  const duplicateBlock = (index) => {
    const blockToDuplicate = dialogueBlocks[index];
    const newBlock = {
      ...blockToDuplicate,
      id: Date.now()
    };
    
    const newBlocks = [...dialogueBlocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setDialogueBlocks(newBlocks);
    setHasChanges(true);
  };
  
  const characterSuggestions = [
    'Lala',
    'Justawomaninherprime'
  ];
  
  return (
    <div className="episode-script-tab">
      {/* Header */}
      <div className="script-header">
        <div className="header-left">
          <h2>📜 Script</h2>
          <p className="header-subtitle">Structured dialogue editor</p>
        </div>
        <div className="header-actions">
          {hasChanges && (
            <span className="unsaved-indicator">● Unsaved changes</span>
          )}
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            💾 Save Script
          </button>
        </div>
      </div>
      
      {/* Help Banner */}
      <div className="help-banner">
        <div className="help-icon">💡</div>
        <div className="help-content">
          <strong>Structured Format:</strong> Each block has a Character Name + Dialogue.
          This format is machine-readable and enables AI automation, character-level clip generation, and Scene Composer integration.
        </div>
      </div>
      
      {/* Script Editor */}
      <div className="script-editor">
        <div className="editor-section">
          <div className="section-header">
            <h3>Dialogue Blocks</h3>
            <button
              className="btn-add-block"
              onClick={() => addDialogueBlock()}
            >
              + Add Block
            </button>
          </div>
          
          {dialogueBlocks.length === 0 ? (
            <div className="empty-script">
              <p>No dialogue blocks yet</p>
              <button
                className="btn-primary"
                onClick={() => addDialogueBlock()}
              >
                + Add First Block
              </button>
            </div>
          ) : (
            <div className="dialogue-blocks">
              {dialogueBlocks.map((block, index) => (
                <div key={block.id} className="dialogue-block">
                  {/* Block Number */}
                  <div className="block-number">{index + 1}</div>
                  
                  {/* Character Input */}
                  <div className="block-field character-field">
                    <label>Character</label>
                    <select
                      className="character-input"
                      value={block.character}
                      onChange={(e) => updateDialogueBlock(index, 'character', e.target.value)}
                    >
                      {characterSuggestions.map(char => (
                        <option key={char} value={char}>{char}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Dialogue Input */}
                  <div className="block-field dialogue-field">
                    <label>Dialogue</label>
                    <textarea
                      className="dialogue-textarea"
                      value={block.dialogue}
                      onChange={(e) => updateDialogueBlock(index, 'dialogue', e.target.value)}
                      placeholder="Enter dialogue..."
                      rows="3"
                    />
                  </div>
                  
                  {/* Block Actions */}
                  <div className="block-actions">
                    <button
                      className="btn-block-action"
                      onClick={() => moveBlockUp(index)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className="btn-block-action"
                      onClick={() => moveBlockDown(index)}
                      disabled={index === dialogueBlocks.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      className="btn-block-action"
                      onClick={() => duplicateBlock(index)}
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      className="btn-block-action"
                      onClick={() => addDialogueBlock(index)}
                      title="Add below"
                    >
                      +
                    </button>
                    <button
                      className="btn-block-action btn-delete"
                      onClick={() => removeDialogueBlock(index)}
                      disabled={dialogueBlocks.length === 1}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* YouTube Description */}
        <div className="editor-section youtube-section">
          <div className="section-header">
            <h3>YouTube Description</h3>
            <span className="section-hint">Written during scripting phase</span>
          </div>
          
          <textarea
            className="youtube-description"
            value={youtubeDescription}
            onChange={(e) => {
              setYoutubeDescription(e.target.value);
              setHasChanges(true);
            }}
            placeholder="Enter YouTube description...

Include:
- Episode summary
- Links (social media, products, etc.)
- Hashtags
- Timestamps (optional)
- Call to action"
            rows="12"
          />
          
          <div className="description-hints">
            <p><strong>💡 Tip:</strong> Platform-specific variations (TikTok captions, Instagram captions) are managed in the Distribution tab.</p>
          </div>
        </div>
      </div>
      
      {/* Preview Mode */}
      <div className="script-preview">
        <h3>Preview</h3>
        <div className="preview-content">
          {dialogueBlocks.map((block, index) => (
            <div key={block.id} className="preview-block">
              <div className="preview-character">{block.character}:</div>
              <div className="preview-dialogue">{block.dialogue || '(empty)'}</div>
            </div>
          ))}
          
          {dialogueBlocks.length === 0 && (
            <p className="preview-empty">No dialogue to preview</p>
          )}
        </div>
      </div>
      
      {/* Save Reminder */}
      {hasChanges && (
        <div className="save-reminder">
          <span className="reminder-icon">⚠️</span>
          <span>You have unsaved changes</span>
          <button className="btn-save-reminder" onClick={handleSave}>
            Save Now
          </button>
        </div>
      )}
    </div>
  );
}

export default EpisodeScriptTab;
