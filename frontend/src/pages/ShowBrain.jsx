import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── TAB CONFIG ───────────────────────────────────────────────────────────────
// Maps display tabs to applies_to filter tags + section filters
// The backend returns all franchise_law entries — we filter client-side by applies_to

const TABS = [
  { id: 'identity',       label: 'Identity',        tag: 'show_brain',        section: 'identity'           },
  { id: 'character',      label: 'Character Bible',  tag: 'character_registry', section: 'character_bible'   },
  { id: 'personality',    label: 'Personality',      tag: 'show_brain',        section: 'personality'        },
  { id: 'world_rules',    label: 'World Rules',      tag: 'show_brain',        section: 'world_rules'        },
  { id: 'stats',          label: 'Stats',            tag: 'show_brain',        section: 'stats'              },
  { id: 'economy',        label: 'Economy',          tag: 'show_brain',        section: 'economy'            },
  { id: 'episode_beats',  label: 'Episode Beats',    tag: 'writer_brain',      section: 'episode_beats'      },
  { id: 'five_brains',    label: '5 Brains',         tag: 'show_brain',        section: 'five_brains'        },
  { id: 'screen_states',  label: 'Screen States',    tag: 'show_brain',        section: 'screen_states'      },
  { id: 'visual_lang',    label: 'Visual Language',  tag: 'show_brain',        section: 'visual_language'    },
  { id: 'scene_rules',    label: 'Scene Rules',      tag: 'scene_generation',  section: 'scene_rules'        },
  { id: 'scene_gen',      label: 'Scene Generation', tag: 'scene_generation',  section: 'scene_generation'   },
  { id: 'season1',        label: 'Season 1',         tag: 'show_brain',        section: 'season_1'           },
  { id: 'multiplatform',  label: 'Multi-Platform',   tag: 'show_brain',        section: 'multi_platform'     },
  { id: 'canon_rules',    label: 'Canon Rules',      tag: 'show_brain',        section: 'canon_rules'        },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseContent(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return { summary: raw }; }
}

function parseAppliesTo(raw) {
  if (!raw) return [];
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return []; }
}

// ─── ENTRY CARD ───────────────────────────────────────────────────────────────

function EntryCard({ entry, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const content = parseContent(entry.content);
  const appliesTo = parseAppliesTo(entry.applies_to);

  return (
    <div style={{
      background: '#FFF',
      border: '1px solid #EEE',
      borderLeft: '3px solid #B8960C',
      borderRadius: 10,
      padding: '16px 18px',
      marginBottom: 12,
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(44,27,105,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {content.rule_number && (
              <span style={{
                background: '#F0EBF8', color: '#5C3D8F',
                padding: '1px 8px', borderRadius: 12,
                fontSize: 11, fontWeight: 700,
              }}>#{content.rule_number}</span>
            )}
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
              {entry.title.replace(/^.*?—\s*/, '')}
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            {content.summary}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {entry.always_inject && (
            <span style={{
              background: '#FFF8E1', color: '#B8960C',
              padding: '2px 8px', borderRadius: 12,
              fontSize: 10, fontWeight: 700,
            }}>INJECTED</span>
          )}
          <button onClick={() => setExpanded(e => !e)} style={{
            background: '#F5F0FF', color: '#5C3D8F',
            border: 'none', borderRadius: 8,
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
          }}>
            {expanded ? 'Less' : 'More'}
          </button>
          {onEdit && (
            <button onClick={() => onEdit(entry)} style={{
              background: 'none', color: '#999',
              border: '1px solid #EEE', borderRadius: 8,
              padding: '4px 10px', fontSize: 11,
              cursor: 'pointer',
            }}>Edit</button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0EBF8' }}>
          {/* Render all content fields except summary */}
          {Object.entries(content)
            .filter(([k]) => k !== 'summary' && k !== 'rule_number' && k !== 'section')
            .map(([key, value]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#888',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  display: 'block', marginBottom: 4,
                }}>
                  {key.replace(/_/g, ' ')}
                </span>
                {Array.isArray(value) ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {value.map((item, i) => (
                      <li key={i} style={{ fontSize: 12, color: '#444', marginBottom: 2 }}>
                        {typeof item === 'object' ? JSON.stringify(item) : item}
                      </li>
                    ))}
                  </ul>
                ) : typeof value === 'object' ? (
                  <div style={{ fontSize: 12, color: '#444', fontFamily: 'monospace',
                    background: '#F9F9F9', padding: '8px 10px', borderRadius: 6 }}>
                    {JSON.stringify(value, null, 2)}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: '#444' }}>{String(value)}</p>
                )}
              </div>
            ))
          }

          {/* Applies-to tags */}
          {appliesTo.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {appliesTo.map(tag => (
                <span key={tag} style={{
                  background: '#F0EBF8', color: '#5C3D8F',
                  padding: '2px 8px', borderRadius: 12,
                  fontSize: 10, fontWeight: 600,
                }}>
                  {tag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────

function EditModal({ entry, onSave, onClose }) {
  const [content, setContent] = useState(
    typeof entry.content === 'string'
      ? entry.content
      : JSON.stringify(JSON.parse(entry.content || '{}'), null, 2)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    // Validate JSON
    try { JSON.parse(content); } catch {
      setError('Content must be valid JSON');
      return;
    }
    setSaving(true);
    try {
      await onSave(entry.id, { content });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#FFF', borderRadius: 14, padding: 28,
        width: '90%', maxWidth: 640, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
            Edit Rule
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: '#888',
          }}>&#x2715;</button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: '#555', fontWeight: 600 }}>
          {entry.title}
        </p>

        {error && (
          <div style={{
            background: '#FFEBEE', color: '#C62828',
            border: '1px solid #FFCDD2', borderRadius: 8,
            padding: '8px 12px', fontSize: 12,
          }}>{error}</div>
        )}

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{
            fontFamily: 'monospace', fontSize: 12,
            border: '1px solid #E0D5F0', borderRadius: 8,
            padding: 12, resize: 'vertical', minHeight: 280,
            outline: 'none', color: '#333',
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#F5F5F5', color: '#555',
            border: 'none', borderRadius: 8,
            padding: '8px 18px', fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            background: saving ? '#EEE' : 'linear-gradient(135deg, #2D1B69, #5C3D8F)',
            color: saving ? '#999' : '#FFF',
            border: 'none', borderRadius: 8,
            padding: '8px 18px', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ShowBrain() {
  const [activeTab, setActiveTab] = useState('identity');
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [search, setSearch] = useState('');

  const fetchEntries = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/v1/franchise-brain/entries?category=franchise_law&status=active`
      );
      // API may return { data: [] } or { entries: [] } — handle both
      const data = res.data?.data || res.data?.entries || res.data || [];
      setAllEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load Show Brain data. Make sure franchise_knowledge migration has run.');
      console.error('[ShowBrain] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleSaveEntry = async (id, updates) => {
    await axios.patch(`${API_BASE}/api/v1/franchise-brain/entries/${id}`, updates);
    await fetchEntries();
  };

  // Filter entries for the current tab
  const currentTab = TABS.find(t => t.id === activeTab) || TABS[0];

  const tabEntries = allEntries.filter(entry => {
    const appliesTo = parseAppliesTo(entry.applies_to);
    const content = parseContent(entry.content);
    const matchesTag = appliesTo.includes(currentTab.tag);
    const matchesSection = content.section === currentTab.section;
    return matchesTag || matchesSection;
  });

  const filteredEntries = search
    ? tabEntries.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (parseContent(e.content).summary || '').toLowerCase().includes(search.toLowerCase())
      )
    : tabEntries;

  const totalRules = allEntries.length;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>

      {editingEntry && (
        <EditModal
          entry={editingEntry}
          onSave={handleSaveEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2D1B69 0%, #4A2D8F 100%)',
        padding: '32px 40px 0',
        color: '#FFF',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Show Brain
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 14, opacity: 0.7 }}>
                Master Intelligence Document &middot; v1.0 &middot; Prime Studios &mdash; The single source of truth for Styling Adventures with Lala
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#D4AF37' }}>
                {totalRules}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Active Rules</div>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 24, marginTop: 20 }}>
            <input
              type="text"
              placeholder="Search rules..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 10, padding: '8px 16px',
                color: '#FFF', fontSize: 13, width: 280,
                outline: 'none',
              }}
            />
          </div>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 0, overflowX: 'auto',
            scrollbarWidth: 'none',
          }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.id
                    ? '2px solid #D4AF37'
                    : '2px solid transparent',
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 700 : 400,
                  color: activeTab === tab.id ? '#D4AF37' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 40px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
            Loading Show Brain data...
          </div>
        )}

        {error && (
          <div style={{
            background: '#FFEBEE', border: '1px solid #FFCDD2',
            borderRadius: 10, padding: '16px 20px',
            color: '#C62828', fontSize: 13, lineHeight: 1.6,
          }}>
            <strong>&#x26A0; Data unavailable</strong><br />
            {error}<br />
            <span style={{ fontSize: 12, opacity: 0.8, marginTop: 4, display: 'block' }}>
              Run: npx sequelize-cli db:migrate &amp;&amp; node scripts/seed-scene-rules.js
            </span>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Tab header */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>
                {currentTab.label}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
                {filteredEntries.length} rule{filteredEntries.length !== 1 ? 's' : ''}
                {search && ` matching "${search}"`}
              </p>
            </div>

            {/* Entries */}
            {filteredEntries.length === 0 ? (
              <div style={{
                border: '2px dashed #E0D5F0', borderRadius: 12,
                padding: '48px 40px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>&#x2726;</div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#5C3D8F' }}>
                  {search ? 'No rules match your search' : 'No rules in this section yet'}
                </p>
                {!search && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: '#888' }}>
                    Run the franchise laws seeder to populate this section.
                  </p>
                )}
              </div>
            ) : (
              <div>
                {filteredEntries.map(entry => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onEdit={setEditingEntry}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
