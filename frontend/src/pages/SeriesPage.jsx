/**
 * SeriesPage.jsx
 * Standalone page for Series management (extracted from UniversePage tab)
 * Route: /universe/series
 */

import { useState, useEffect, useCallback } from 'react';
import './UniversePage.css';

const UNIVERSE_API    = '/api/v1/universe';
const STORYTELLER_API = '/api/v1/storyteller';
const SHOWS_API       = '/api/v1/shows';
const LALAVERSE_ID = 'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e';

function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

export default function SeriesPage() {
  const width = useWindowWidth();
  const isMobile = width < 640;
  const [series, setSeries] = useState([]);
  const [books, setBooks] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        fetch(`${UNIVERSE_API}/series?universe_id=${LALAVERSE_ID}`),
        fetch(`${STORYTELLER_API}/books`),
      ]);
      const sData = await sRes.json();
      const bData = await bRes.json();
      setSeries(sData.series || []);
      setBooks(bData.books || []);
      try {
        const shRes = await fetch(SHOWS_API);
        const shData = await shRes.json();
        const showsList = shData.data || shData.shows || shData;
        setShows(Array.isArray(showsList) ? showsList : []);
      } catch (_) {}
    } catch (err) {
      console.error('SeriesPage load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Series management functions
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingEra, setEditingEra] = useState(null);
  const [eraValues, setEraValues] = useState({});

  async function linkShow(seriesId, showId) {
    try {
      const res = await fetch(`${UNIVERSE_API}/series/${seriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_id: showId || null }),
      });
      if (!res.ok) throw new Error('Failed to link show');
      showToast(showId ? 'Show linked to series' : 'Show unlinked');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function assignToSeries(bookId, seriesId) {
    try {
      const res = await fetch(`${STORYTELLER_API}/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series_id: seriesId || null }),
      });
      if (!res.ok) throw new Error('Failed to assign');
      showToast('Book assigned to series');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function createSeries() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${UNIVERSE_API}/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe_id: LALAVERSE_ID,
          name: newName.trim(),
          description: newDesc.trim(),
          order_index: series.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreating(false);
      setNewName('');
      setNewDesc('');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveEra(bookId) {
    const val = eraValues[bookId];
    try {
      const res = await fetch(`${STORYTELLER_API}/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ era_name: val }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditingEra(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteSeries(seriesId) {
    if (!confirm('Delete this series? Books will be unlinked but not deleted.')) return;
    try {
      const res = await fetch(`${UNIVERSE_API}/series/${seriesId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (loading) return <div className="up-loading">Loading series…</div>;

  const unassigned = books.filter(b => !b.series_id);

  return (
    <div className="up-shell">
      <div className="up-hero-compact" style={{ padding: isMobile ? '10px 16px' : '10px 48px' }}>
        <div className="up-hero-compact-left">
          <h1 className="up-hero-compact-title">Series</h1>
          <span className="up-hero-compact-slug">Manage series, books & eras</span>
        </div>
      </div>

      <div className="up-tab-content" style={isMobile ? { padding: '0 16px' } : undefined}>
        <div className="up-tab-shell">
          <div className="up-actions-bar">
            <button className="up-btn-primary" onClick={() => setCreating(true)}>+ New Series</button>
          </div>

          {creating && (
            <div className="up-create-card">
              <div className="up-section-label">NEW SERIES</div>
              <input className="up-input" style={{ marginBottom: 10 }} placeholder='Series name — e.g. Becoming Prime' value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              <textarea className="up-textarea" style={{ minHeight: 80, marginBottom: 10 }} placeholder='Series description — what story arc does this cover?' value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="up-btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
                <button className="up-btn-primary" style={{ opacity: saving ? 0.6 : 1 }} onClick={createSeries} disabled={saving}>{saving ? 'Creating…' : 'Create Series'}</button>
              </div>
            </div>
          )}

          {series.map(ser => {
            const seriesBooks = books.filter(b => b.series_id === ser.id);
            return (
              <div key={ser.id} className="up-series-card" style={isMobile ? { padding: '14px' } : undefined}>
                <div className="up-series-header" style={isMobile ? { flexDirection: 'column', gap: 8 } : undefined}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div className="up-series-name" style={isMobile ? { fontSize: 19 } : undefined}>{ser.name}</div>
                      {isMobile && <button className="up-btn-delete" style={{ padding: '8px 12px', flexShrink: 0 }} onClick={() => deleteSeries(ser.id)} title='Delete series'>✕</button>}
                    </div>
                    {ser.description && <div className="up-series-desc" style={isMobile ? { maxWidth: '100%' } : undefined}>{ser.description}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: 'rgba(26,26,46,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Show:</span>
                      <select className="up-assign-select" style={{ maxWidth: isMobile ? 'none' : 220, fontSize: 12, padding: '6px 10px' }} value={ser.show_id || ''} onChange={e => linkShow(ser.id, e.target.value || null)}>
                        <option value=''>— None —</option>
                        {(shows || []).map(sh => <option key={sh.id} value={sh.id}>{sh.title || sh.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {!isMobile && <button className="up-btn-delete" onClick={() => deleteSeries(ser.id)} title='Delete series'>✕</button>}
                </div>

                {seriesBooks.length === 0 ? (
                  <div className="up-empty-books">No books in this series yet.</div>
                ) : (
                  <div className="up-book-list">
                    {seriesBooks.map(book => (
                      <div key={book.id} className="up-book-row" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
                        <div className="up-book-row-left">
                          <div className="up-book-title" style={isMobile ? { fontSize: 15 } : undefined}>{book.title}</div>
                          <div className="up-book-meta">
                            {book.primary_pov && <span className="up-meta-chip">{book.primary_pov.replace('_', ' ')}</span>}
                            {book.canon_status && (
                              <span className="up-meta-chip" style={{ color: book.canon_status === 'locked' ? '#a78bfa' : book.canon_status === 'active' ? '#4ade80' : '#C9A84C' }}>{book.canon_status}</span>
                            )}
                          </div>
                        </div>
                        <div className="up-book-row-right" style={isMobile ? { justifyContent: 'flex-start', width: '100%', flexWrap: 'wrap' } : undefined}>
                          {editingEra === book.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
                              <input className="up-input" style={{ padding: '8px 10px', fontSize: 13, flex: 1, width: 'auto' }} value={eraValues[book.id] ?? book.era_name ?? ''} onChange={e => setEraValues(prev => ({ ...prev, [book.id]: e.target.value }))} autoFocus />
                              <button className="up-btn-micro" style={isMobile ? { padding: '8px 12px' } : undefined} onClick={() => saveEra(book.id)}>✓</button>
                              <button className="up-btn-micro" style={isMobile ? { padding: '8px 12px' } : undefined} onClick={() => setEditingEra(null)}>✕</button>
                            </div>
                          ) : (
                            <button className="up-era-btn" style={isMobile ? { padding: '8px 12px', fontSize: 12 } : undefined} onClick={() => { setEditingEra(book.id); setEraValues(prev => ({ ...prev, [book.id]: book.era_name || '' })); }}>{book.era_name || '+ Set Era'}</button>
                          )}
                          <select className="up-assign-select" style={isMobile ? { maxWidth: 'none', flex: '1 1 auto', fontSize: 12, padding: '8px 10px' } : undefined} value={ser.id} onChange={e => { const val = e.target.value; if (val !== ser.id) assignToSeries(book.id, val || null); }}>
                            {series.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                            <option value=''>— Unassign —</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {unassigned.length > 0 && (
            <div className="up-series-card" style={{ borderColor: '#eeebe4', ...(isMobile ? { padding: 14 } : {}) }}>
              <div className="up-series-name">Unassigned Books</div>
              <div className="up-book-list">
                {unassigned.map(book => (
                  <div key={book.id} className="up-book-row" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
                    <div className="up-book-row-left">
                      <div className="up-book-title" style={isMobile ? { fontSize: 15 } : undefined}>{book.title}</div>
                      <div className="up-book-meta"><span className="up-meta-chip" style={{ color: 'rgba(26,26,46,0.3)' }}>no series</span></div>
                    </div>
                    <div className="up-book-row-right">
                      {series.length > 0 ? (
                        <select className="up-assign-select" value='' onChange={e => { if (e.target.value) assignToSeries(book.id, e.target.value); }}>
                          <option value=''>Assign to series…</option>
                          {series.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                        </select>
                      ) : (
                        <span className="up-meta-chip" style={{ color: 'rgba(26,26,46,0.3)' }}>Create a series first</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`up-toast ${toast.type === 'error' ? 'up-toast--error' : 'up-toast--success'}`}>{toast.msg}</div>
      )}
    </div>
  );
}
