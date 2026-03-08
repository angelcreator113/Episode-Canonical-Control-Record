/**
 * StoryReviewPanel.jsx — Drop-in persistence bridge for StoryEngine
 *
 * Wraps any generated story with:
 *   - Auto-save on edit (debounced 2s)
 *   - Save/Approve/Reject buttons that persist to storyteller_stories
 *   - Version badge + save indicator
 *   - Consistency check results display
 *
 * Props:
 *   story        — { story_number, title, text, phase, story_type, word_count, ... }
 *   characterKey — 'justawoman', 'david', etc.
 *   taskBrief    — original task object from story engine
 *   onApproved   — callback after successful approve
 *   onRejected   — callback after successful reject
 *   onSaved      — callback after any save
 *   charColor    — accent color for the character
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import './StoryReviewPanel.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export default function StoryReviewPanel({
  story,
  characterKey,
  taskBrief,
  onApproved,
  onRejected,
  onSaved,
  charColor = '#9a7d1e',
}) {
  const [editText, setEditText] = useState(story?.text || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [dbStory, setDbStory] = useState(null);
  const [editorNotes, setEditorNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const autoSaveTimer = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Sync when story prop changes
  useEffect(() => {
    setEditText(story?.text || '');
    setEditing(false);
    setSaveStatus('idle');
    setEditorNotes('');
  }, [story?.story_number, story?.text]);

  // Load existing persisted story on mount
  useEffect(() => {
    if (!characterKey) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/stories/character/${characterKey}`);
        if (res.ok) {
          const data = await res.json();
          const existing = data.stories?.find(s => s.story_number === story?.story_number);
          if (existing) {
            setDbStory(existing);
            setSavedVersion(existing.version);
          }
        }
      } catch { /* ignore */ }
    })();
  }, [characterKey, story?.story_number]);

  // Auto-save debounce
  const triggerAutoSave = useCallback((text) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!mountedRef.current || !dbStory) return;
      setSaveStatus('saving');
      try {
        const res = await fetch(`${API_BASE}/stories/auto-save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character_key: characterKey,
            story_number: story.story_number,
            text,
            editor_notes: editorNotes || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (mountedRef.current) {
            setSavedVersion(data.version);
            setSaveStatus('saved');
            setTimeout(() => {
              if (mountedRef.current) setSaveStatus('idle');
            }, 2000);
          }
        } else {
          if (mountedRef.current) setSaveStatus('error');
        }
      } catch {
        if (mountedRef.current) setSaveStatus('error');
      }
    }, 2000);
  }, [characterKey, story?.story_number, dbStory, editorNotes]);

  // Full save (creates if not exists)
  async function handleSave() {
    if (!story) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_key: characterKey,
          story_number: story.story_number,
          title: story.title,
          text: editText,
          phase: story.phase,
          story_type: story.story_type,
          word_count: editText.split(/\s+/).length,
          task_brief: taskBrief,
          new_character: story.new_character,
          new_character_name: story.new_character_name,
          new_character_role: story.new_character_role,
          opening_line: story.opening_line,
          editor_notes: editorNotes || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDbStory(data.story);
        setSavedVersion(data.story.version);
        setSaveStatus('saved');
        onSaved?.(data.story);
        setTimeout(() => {
          if (mountedRef.current) setSaveStatus('idle');
        }, 2000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  // Approve
  async function handleApprove() {
    // Save first if not persisted
    if (!dbStory) await handleSave();

    const storyId = dbStory?.id;
    if (!storyId) return;

    try {
      const res = await fetch(`${API_BASE}/stories/${storyId}/approve`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDbStory(data.story);
        onApproved?.(data.story);
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  }

  // Reject
  async function handleReject() {
    if (dbStory?.id) {
      try {
        await fetch(`${API_BASE}/stories/${dbStory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected' }),
        });
      } catch { /* ignore */ }
    }
    onRejected?.(story);
  }

  function handleTextChange(newText) {
    setEditText(newText);
    if (dbStory) triggerAutoSave(newText);
  }

  if (!story) return null;

  const wordCount = editText.split(/\s+/).filter(Boolean).length;
  const isPersisted = !!dbStory;
  const isApproved = dbStory?.status === 'approved';

  return (
    <div className="se-review-panel" style={{ '--review-accent': charColor }}>
      {/* Status bar */}
      <div className="se-review-status-bar">
        <div className="se-review-status-left">
          {isPersisted ? (
            <span className="se-review-badge se-review-badge-saved">
              ✓ Saved · v{savedVersion}
            </span>
          ) : (
            <span className="se-review-badge se-review-badge-unsaved">
              ● Unsaved
            </span>
          )}
          {isApproved && (
            <span className="se-review-badge se-review-badge-approved">
              ✓ Approved
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="se-review-saving">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="se-review-saved-flash">✓ Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="se-review-error">Save failed</span>
          )}
        </div>
        <div className="se-review-status-right">
          <span className="se-review-wc">{wordCount.toLocaleString()} words</span>
        </div>
      </div>

      {/* Editor area — only shown when editing (read-only view is in StoryPanel's paginated body) */}
      {editing && (
        <div className="se-review-editor-wrap">
          <textarea
            className="se-review-textarea"
            value={editText}
            onChange={(e) => handleTextChange(e.target.value)}
            spellCheck
          />
        </div>
      )}

      {/* Notes toggle */}
      {showNotes && (
        <div className="se-review-notes">
          <textarea
            className="se-review-notes-input"
            placeholder="Editor notes (private, not part of story text)…"
            value={editorNotes}
            onChange={(e) => setEditorNotes(e.target.value)}
          />
        </div>
      )}

      {/* Action bar */}
      <div className="se-review-actions">
        <button
          className="se-review-btn se-review-btn-notes"
          onClick={() => setShowNotes(!showNotes)}
        >
          {showNotes ? 'Hide Notes' : 'Notes'}
        </button>

        {editing && (
          <button
            className="se-review-btn se-review-btn-cancel"
            onClick={() => { setEditing(false); setEditText(story.text); }}
          >
            Cancel
          </button>
        )}

        <div style={{ flex: 1 }} />

        {!isApproved && (
          <>
            <button
              className="se-review-btn se-review-btn-reject"
              onClick={handleReject}
            >
              Reject
            </button>
            <button
              className="se-review-btn se-review-btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : isPersisted ? 'Update' : 'Save'}
            </button>
            <button
              className="se-review-btn se-review-btn-approve"
              style={{ background: charColor }}
              onClick={handleApprove}
            >
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
}
