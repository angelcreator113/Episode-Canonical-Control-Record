import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const NOTE_TYPES = [
  { value: 'intent',        label: 'Intent',        desc: 'Why it was built' },
  { value: 'watch',         label: 'Watch',         desc: 'Track this over time' },
  { value: 'plant',         label: 'Plant',         desc: 'Seed for future story' },
  { value: 'amber_context', label: 'Amber Context', desc: "Amber's working notes" },
  { value: 'private',       label: 'Private',       desc: 'Evoni only — never shown to Amber' },
];

const TYPE_COLORS = {
  intent:        { bg: '#fdf4f9', border: '#d4789a', text: '#9d174d' },
  watch:         { bg: '#f0f7fd', border: '#7ab3d4', text: '#1e5f8a' },
  plant:         { bg: '#f5f0fd', border: '#a889c8', text: '#5b3a8c' },
  amber_context: { bg: '#f0f7fd', border: '#7ab3d4', text: '#1e5f8a' },
  private:       { bg: '#fef9e7', border: '#d4a84c', text: '#6d4c00' },
};

export default function AuthorNotePanel({ entityType, entityId }) {
  const [notes, setNotes] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('intent');
  const [createdBy, setCreatedBy] = useState('evoni');
  const [loading, setLoading] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!entityType || !entityId) return;
    try {
      const res = await api.get(`/api/v1/author-notes?entity_type=${entityType}&entity_id=${entityId}`);
      setNotes(res.data?.notes || []);
    } catch (err) {
      console.warn('[AuthorNotePanel] load error:', err.message);
    }
  }, [entityType, entityId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleCreate = async () => {
    if (!noteText.trim()) return;
    setLoading(true);
    try {
      await api.post('/api/v1/author-notes', {
        entity_type: entityType,
        entity_id: entityId,
        note_text: noteText,
        note_type: noteType,
        created_by: createdBy,
      });
      setNoteText('');
      setAdding(false);
      await loadNotes();
    } catch (err) {
      console.error('[AuthorNotePanel] create error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/v1/author-notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('[AuthorNotePanel] delete error:', err);
    }
  };

  const grouped = {};
  for (const n of notes) {
    if (!grouped[n.note_type]) grouped[n.note_type] = [];
    grouped[n.note_type].push(n);
  }

  return (
    <div style={{
      border: '1px solid #e8d5e0',
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: 16,
      background: '#fff',
    }}>
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#888',
        }}
      >
        <span>Author Notes</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {notes.length > 0 && (
            <span style={{
              background: '#d4789a',
              color: '#fff',
              borderRadius: 10,
              padding: '1px 8px',
              fontSize: 10,
              fontWeight: 700,
            }}>
              {notes.length}
            </span>
          )}
          <span style={{ fontSize: 14 }}>{expanded ? '−' : '+'}</span>
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0e8ec' }}>
          {/* Notes grouped by type */}
          {Object.entries(grouped).map(([type, typeNotes]) => {
            const colors = TYPE_COLORS[type] || TYPE_COLORS.intent;
            return (
              <div key={type} style={{ marginTop: 12 }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: colors.text,
                  marginBottom: 6,
                }}>
                  {NOTE_TYPES.find(t => t.value === type)?.label || type}
                </div>
                {typeNotes.map(note => (
                  <div key={note.id} style={{
                    background: colors.bg,
                    border: `1px solid ${colors.border}33`,
                    borderLeft: `3px solid ${colors.border}`,
                    borderRadius: 6,
                    padding: '8px 12px',
                    marginBottom: 6,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#333',
                    position: 'relative',
                  }}>
                    <div>{note.note_text}</div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      fontSize: 10,
                      color: '#999',
                    }}>
                      <span style={{
                        color: note.created_by === 'evoni' ? '#d4789a' : '#7ab3d4',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}>
                        {note.created_by}
                      </span>
                      <button
                        onClick={() => handleDelete(note.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ccc',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: '0 4px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {notes.length === 0 && !adding && (
            <div style={{
              textAlign: 'center',
              padding: '16px 0 8px',
              fontSize: 13,
              color: '#aaa',
              fontStyle: 'italic',
            }}>
              No notes yet
            </div>
          )}

          {/* Add note form */}
          {adding ? (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a note..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e8d5e0',
                  borderRadius: 6,
                  fontSize: 13,
                  lineHeight: 1.5,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #e8d5e0',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {NOTE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #e8d5e0',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  <option value="evoni">Evoni</option>
                  <option value="amber">Amber</option>
                </select>
                <button
                  onClick={handleCreate}
                  disabled={loading || !noteText.trim()}
                  style={{
                    padding: '4px 14px',
                    background: '#d4789a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading || !noteText.trim() ? 0.5 : 1,
                  }}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setAdding(false); setNoteText(''); }}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    color: '#999',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{
                marginTop: 12,
                padding: '6px 14px',
                background: 'transparent',
                border: '1px dashed #d4789a55',
                borderRadius: 6,
                color: '#d4789a',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              + Add Note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
