/**
 * SceneSuggestionReview — modal that shows AI scene-set proposals for an
 * episode and lets the creator approve, edit-by-toggling, or discard.
 *
 * The proposal comes from POST /api/v1/episodes/:id/suggest-scenes:
 *   { beats: [
 *       { beat_number, beat_summary, scene_set_id, scene_set_name,
 *         scene_set_thumb, new_set_name, new_set_description,
 *         stills_to_use, reason }
 *   ] }
 *
 * Approve → POST /scene-sets to link the chosen sets to the episode.
 * Beats with scene_set_id === null (Claude couldn't find a match) are
 * surfaced separately so the creator can decide whether to create a new
 * set later — they're skipped from the bulk-link.
 */
import React, { useState } from 'react';
import { Sparkles, X, Check, Plus } from 'lucide-react';

export default function SceneSuggestionReview({
  proposal,
  contextSummary,
  onApprove,
  onReject,
  busy,
}) {
  // Per-beat checkbox state. Default: matched beats checked, unmatched
  // (new_set proposals) unchecked since we can't link them without
  // creating the set first.
  const [accepted, setAccepted] = useState(() => {
    const init = {};
    (proposal?.beats || []).forEach((b, i) => {
      init[i] = !!b.scene_set_id;
    });
    return init;
  });

  if (!proposal) return null;
  const beats = proposal.beats || [];
  const acceptedCount = Object.values(accepted).filter(Boolean).length;

  const apply = () => {
    const sceneSetIds = beats
      .filter((_, i) => accepted[i])
      .map(b => b.scene_set_id)
      .filter(Boolean);
    // Dedupe — same set can be matched to multiple beats; only need
    // to link it once.
    const unique = Array.from(new Set(sceneSetIds));
    onApprove({ sceneSetIds: unique, beats });
  };

  return (
    <div
      onClick={onReject}
      style={{
        position: 'fixed', inset: 0, zIndex: 9800,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, maxHeight: '85vh',
          background: '#FAF7F0', borderRadius: 16,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid #e8e0d0',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8e0d0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="#B8962E" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2C2C2C' }}>Scene Suggestions</div>
            {contextSummary && (
              <div style={{ fontSize: 11, color: '#888', fontFamily: "'DM Mono', monospace" }}>{contextSummary}</div>
            )}
          </div>
          <button onClick={onReject} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#888' }}>
            <X size={16} />
          </button>
        </div>

        {/* Beats list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {beats.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#999', fontSize: 13 }}>
              No beats proposed.
            </div>
          ) : (
            beats.map((b, i) => {
              const matched = !!b.scene_set_id;
              const isOn = !!accepted[i];
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', gap: 10, padding: '10px 8px',
                    background: isOn ? '#fdf8ee' : '#fff',
                    border: `1px solid ${isOn ? '#e6d9b8' : '#eceadf'}`,
                    borderRadius: 8, marginBottom: 8,
                    opacity: matched ? 1 : 0.85,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={!matched}
                    onChange={() => setAccepted(prev => ({ ...prev, [i]: !prev[i] }))}
                    style={{ marginTop: 2, cursor: matched ? 'pointer' : 'not-allowed' }}
                    title={matched ? '' : 'No matching scene set — create one first'}
                  />
                  {b.scene_set_thumb ? (
                    <img src={b.scene_set_thumb} alt={b.scene_set_name} style={{ width: 56, height: 36, borderRadius: 4, objectFit: 'cover', border: '1px solid #e8e0d0', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 36, borderRadius: 4, background: '#f1eee6', border: '1px solid #e8e0d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#bbb', fontSize: 16 }}>📍</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>BEAT {b.beat_number}</span>
                      <span style={{ fontSize: 10, color: '#999', fontFamily: "'DM Mono', monospace" }}>· {b.stills_to_use} still{b.stills_to_use === 1 ? '' : 's'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#2C2C2C', fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>
                      {b.beat_summary || '—'}
                    </div>
                    {matched ? (
                      <div style={{ fontSize: 11, color: '#5a8f3b' }}>
                        → {b.scene_set_name}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#B84D2E', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={11} /> Suggests new set: <strong>{b.new_set_name || 'Unnamed'}</strong>
                      </div>
                    )}
                    {b.reason && (
                      <div style={{ fontSize: 10, color: '#888', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
                        {b.reason}
                      </div>
                    )}
                    {!matched && b.new_set_description && (
                      <div style={{ fontSize: 10, color: '#888', marginTop: 4, padding: '4px 6px', background: '#fef7f3', borderRadius: 4, lineHeight: 1.4 }}>
                        {b.new_set_description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e8e0d0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#888', flex: 1, fontFamily: "'DM Mono', monospace" }}>
            {acceptedCount} / {beats.length} beats selected
          </span>
          <button
            onClick={onReject}
            disabled={busy}
            style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e8e0d0', background: '#fff', color: '#666', fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
          >
            Discard
          </button>
          <button
            onClick={apply}
            disabled={busy || acceptedCount === 0}
            style={{
              padding: '7px 14px', borderRadius: 6, border: 'none',
              background: acceptedCount === 0 ? '#ccc' : '#B8962E',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: busy || acceptedCount === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Check size={13} /> {busy ? 'Linking…' : `Link ${acceptedCount} set${acceptedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
