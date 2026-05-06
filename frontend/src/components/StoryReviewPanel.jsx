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
import { useState, useEffect, useRef } from 'react';
import apiClient from '../services/api';
import './StoryReviewPanel.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// File-local helpers. listStoriesForCharacterApi is a CP9 cross-CP
// duplicate per v2.12 §9.11; the other two are fresh.
export const listStoriesForCharacterApi = (characterKey) =>
  apiClient.get(`${API_BASE}/stories/character/${characterKey}`).then((r) => r.data);
export const approveStoryApi = (storyId) =>
  apiClient.post(`${API_BASE}/stories/${storyId}/approve`).then((r) => r.data);
export const rejectStoryApi = (storyId) =>
  apiClient.patch(`${API_BASE}/stories/${storyId}`, { status: 'rejected' });

export default function StoryReviewPanel({
  story,
  characterKey,
  taskBrief,
  onApproved,
  onRejected,
  onSaved,
  charColor = '#9a7d1e',
  currentPage = 0,
  totalPages = 1,
  onPageChange,
}) {
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [dbStory, setDbStory] = useState(null);
  const [editorNotes, setEditorNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Sync when story prop changes
  useEffect(() => {
    setSaveStatus('idle');
    setEditorNotes('');
  }, [story?.story_number, story?.text]);

  // Load existing persisted story on mount
  useEffect(() => {
    if (!characterKey) return;
    (async () => {
      try {
        const data = await listStoriesForCharacterApi(characterKey);
        const existing = data.stories?.find(s => s.story_number === story?.story_number);
        if (existing) {
          setDbStory(existing);
          setSavedVersion(existing.version);
        }
      } catch { /* ignore */ }
    })();
  }, [characterKey, story?.story_number]);

  // Full save (creates if not exists)
  async function handleSave() {
    if (!story) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const res = await apiClient.post(`${API_BASE}/stories`, {
        character_key: characterKey,
        story_number: story.story_number,
        title: story.title,
        text: story.text,
        phase: story.phase,
        story_type: story.story_type,
        word_count: (story.text || '').split(/\s+/).length,
        task_brief: taskBrief,
        new_character: story.new_character,
        new_character_name: story.new_character_name,
        new_character_role: story.new_character_role,
        opening_line: story.opening_line,
        editor_notes: editorNotes || undefined,
      });
      const data = res.data;
      if (data?.story) {
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
      const data = await approveStoryApi(storyId);
      setDbStory(data.story);
      onApproved?.(data.story);
    } catch (err) {
      console.error('Approve error:', err);
    }
  }

  // Reject
  async function handleReject() {
    if (dbStory?.id) {
      try {
        await rejectStoryApi(dbStory.id);
      } catch { /* ignore */ }
    }
    onRejected?.(story);
  }

  if (!story) return null;

  const wordCount = (story.text || '').split(/\s+/).filter(Boolean).length;
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
              Draft — not yet saved
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
        {totalPages > 1 && onPageChange && (
          <div className="se-review-page-nav">
            <button
              className="se-review-page-btn"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              ‹ Prev
            </button>
            <span className="se-review-page-indicator">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              className="se-review-page-btn"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next ›
            </button>
          </div>
        )}

        <div className="se-review-status-right">
          <span className="se-review-wc">{wordCount.toLocaleString()} words</span>
        </div>
      </div>

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

        <div style={{ flex: 1 }} />

        {!isApproved && (
          <button
            className="se-review-btn se-review-btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : isPersisted ? 'Update' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
}
