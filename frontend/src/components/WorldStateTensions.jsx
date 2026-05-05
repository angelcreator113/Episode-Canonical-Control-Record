/**
 * WorldStateTensions.jsx
 * Combined World State + Tensions tab content.
 * Extracted from WorldStudio and moved under Universe page.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

const API = '/api/v1';

// ─── Track 6 CP8 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// All 7 helpers duplicated locally from CP7 WorldDashboard.jsx per v2.12 §9.11
// file-local convention. ~21 LOC duplication preserves test-per-file isolation.
export const listSnapshotsApi = () => apiClient.get(`${API}/world/state/snapshots`);
export const listTimelineApi = () => apiClient.get(`${API}/world/state/timeline`);
export const getTensionScannerApi = () => apiClient.get(`${API}/world/tension-scanner`);
export const createSnapshotApi = (payload) =>
  apiClient.post(`${API}/world/state/snapshots`, payload);
export const createTimelineEventApi = (payload) =>
  apiClient.post(`${API}/world/state/timeline`, payload);
export const deleteTimelineEventApi = (id) =>
  apiClient.delete(`${API}/world/state/timeline/${id}`);
export const createTensionProposalApi = (payload) =>
  apiClient.post(`${API}/world/create-tension-proposal`, payload);

export default function WorldStateTensions({ activeSubTab = 'world-state' }) {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState(activeSubTab);
  const [toast, setToast] = useState(null);

  function flash(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ── World State ────────────────────────────────────────────────────
  const [snapshots, setSnapshots] = useState([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapForm, setSnapForm] = useState({ snapshot_label: '', world_facts: '', active_threads: '' });
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlForm, setTlForm] = useState({ event_name: '', event_description: '', event_type: 'plot', impact_level: 'moderate', story_date: '' });

  // ── Tensions ───────────────────────────────────────────────────────
  const [tensionPairs, setTensionPairs] = useState([]);
  const [tensionLoading, setTensionLoading] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setSnapLoading(true);
    try { const r = await listSnapshotsApi(); setSnapshots(r.data?.snapshots || []); }
    catch (e) { console.error('loadSnapshots', e); }
    finally { setSnapLoading(false); }
  }, []);

  const loadTimeline = useCallback(async () => {
    setTlLoading(true);
    try { const r = await listTimelineApi(); setTimelineEvents(r.data?.events || []); }
    catch (e) { console.error('loadTimeline', e); }
    finally { setTlLoading(false); }
  }, []);

  const loadTensions = useCallback(async () => {
    setTensionLoading(true);
    try { const r = await getTensionScannerApi(); setTensionPairs(r.data?.pairs || []); }
    catch (e) { console.error('loadTensions', e); }
    finally { setTensionLoading(false); }
  }, []);

  const saveSnapshot = useCallback(async () => {
    const body = {
      snapshot_label: snapForm.snapshot_label,
      world_facts: snapForm.world_facts ? snapForm.world_facts.split('\n').filter(Boolean) : [],
      active_threads: snapForm.active_threads ? snapForm.active_threads.split('\n').filter(Boolean) : [],
    };
    try {
      await createSnapshotApi(body);
      flash('Snapshot saved');
      setSnapForm({ snapshot_label: '', world_facts: '', active_threads: '' });
      loadSnapshots();
    } catch (e) { flash('Save failed', 'error'); }
  }, [snapForm, loadSnapshots]);

  const saveTimelineEvent = useCallback(async () => {
    try {
      await createTimelineEventApi(tlForm);
      flash('Timeline event created');
      setTlForm({ event_name: '', event_description: '', event_type: 'plot', impact_level: 'moderate', story_date: '' });
      loadTimeline();
    } catch (e) { flash('Save failed', 'error'); }
  }, [tlForm, loadTimeline]);

  const deleteTimelineEvent = useCallback(async (id) => {
    try { await deleteTimelineEventApi(id); flash('Event deleted'); loadTimeline(); }
    catch (e) { flash('Delete failed', 'error'); }
  }, [loadTimeline]);

  const proposeTensionScene = useCallback(async (pair) => {
    try {
      const r = await createTensionProposalApi({ char_a_id: pair.char_a_id, char_b_id: pair.char_b_id });
      if (r.data?.proposal) navigate('/story-evaluation', { state: { sceneProposal: r.data.proposal } });
      else flash('Could not generate proposal', 'error');
    } catch (e) { flash('Proposal failed', 'error'); }
  }, [navigate]);

  // Load data on mount based on active sub-tab
  useEffect(() => {
    if (subTab === 'world-state') { loadSnapshots(); loadTimeline(); }
    if (subTab === 'tensions') { loadTensions(); }
  }, [subTab, loadSnapshots, loadTimeline, loadTensions]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Sub-tab toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '0 20px' }}>
        <button
          onClick={() => setSubTab('world-state')}
          style={{
            background: subTab === 'world-state' ? '#1a1714' : 'transparent',
            color: subTab === 'world-state' ? '#fff' : '#a89f94',
            border: '1px solid #e0d9ce',
            borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}
        >
          📜 World State
        </button>
        <button
          onClick={() => setSubTab('tensions')}
          style={{
            background: subTab === 'tensions' ? '#1a1714' : 'transparent',
            color: subTab === 'tensions' ? '#fff' : '#a89f94',
            border: '1px solid #e0d9ce',
            borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}
        >
          ⚡ Tensions
        </button>
      </div>

      {/* ── WORLD STATE ─────────────────────────────────────────────── */}
      {subTab === 'world-state' && (
        <div style={{ padding: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>📜 World State</h2>

          {/* Snapshots section */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>State Snapshots</h3>
            <div style={{ background: '#f8f7f4', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #e8e5de' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <input className="ws4-input" placeholder="Snapshot Label *" value={snapForm.snapshot_label} onChange={e => setSnapForm(p => ({ ...p, snapshot_label: e.target.value }))} />
                <textarea className="ws4-input" placeholder="World Facts (one per line)" rows={3} value={snapForm.world_facts} onChange={e => setSnapForm(p => ({ ...p, world_facts: e.target.value }))} style={{ resize: 'vertical' }} />
                <textarea className="ws4-input" placeholder="Active Threads (one per line)" rows={2} value={snapForm.active_threads} onChange={e => setSnapForm(p => ({ ...p, active_threads: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <button className="ws4-btn ws4-btn-primary ws4-btn-sm" style={{ marginTop: 8 }} onClick={saveSnapshot} disabled={!snapForm.snapshot_label}>Save Snapshot</button>
            </div>
            {snapLoading ? <div style={{ color: '#999', textAlign: 'center' }}>Loading…</div> : snapshots.map(s => (
              <div key={s.id} style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #e8e5de', marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.snapshot_label}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Position: {s.timeline_position || '—'}</div>
                {s.world_facts?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>Facts: </span>
                    {s.world_facts.map((f, i) => <span key={i} style={{ fontSize: 11, background: '#f0eee8', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>{f}</span>)}
                  </div>
                )}
                {s.active_threads?.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>Threads: </span>
                    {s.active_threads.map((t, i) => <span key={i} style={{ fontSize: 11, background: '#e8edf5', borderRadius: 4, padding: '1px 6px', marginRight: 4 }}>{t}</span>)}
                  </div>
                )}
              </div>
            ))}
            {!snapLoading && snapshots.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>No snapshots yet</div>}
          </div>

          {/* Timeline section */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Timeline Events</h3>
            <div style={{ background: '#f8f7f4', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #e8e5de' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="ws4-input" placeholder="Event Name *" value={tlForm.event_name} onChange={e => setTlForm(p => ({ ...p, event_name: e.target.value }))} />
                <input className="ws4-input" placeholder="Story Date (e.g. Year 2, Month 3)" value={tlForm.story_date} onChange={e => setTlForm(p => ({ ...p, story_date: e.target.value }))} />
                <select className="ws4-select" value={tlForm.event_type} onChange={e => setTlForm(p => ({ ...p, event_type: e.target.value }))}>
                  <option value="plot">Plot</option><option value="backstory">Backstory</option>
                  <option value="world">World</option><option value="character">Character</option><option value="relationship">Relationship</option>
                </select>
                <select className="ws4-select" value={tlForm.impact_level} onChange={e => setTlForm(p => ({ ...p, impact_level: e.target.value }))}>
                  <option value="minor">Minor</option><option value="moderate">Moderate</option>
                  <option value="major">Major</option><option value="catastrophic">Catastrophic</option>
                </select>
              </div>
              <textarea className="ws4-input" placeholder="Event Description" rows={2} value={tlForm.event_description} onChange={e => setTlForm(p => ({ ...p, event_description: e.target.value }))} style={{ resize: 'vertical', marginTop: 8, width: '100%' }} />
              <button className="ws4-btn ws4-btn-primary ws4-btn-sm" style={{ marginTop: 8 }} onClick={saveTimelineEvent} disabled={!tlForm.event_name}>Add Event</button>
            </div>
            {tlLoading ? <div style={{ color: '#999', textAlign: 'center' }}>Loading…</div> : timelineEvents.map(ev => (
              <div key={ev.id} style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #e8e5de', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {ev.impact_level === 'catastrophic' ? '🔥' : ev.impact_level === 'major' ? '⚠️' : '•'} {ev.event_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>{ev.event_type} · {ev.impact_level}{ev.story_date ? ` · ${ev.story_date}` : ''}</div>
                  {ev.event_description && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{ev.event_description}</div>}
                  {ev.WorldLocation && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>📍 {ev.WorldLocation.name}</div>}
                </div>
                <button className="ws4-btn ws4-btn-danger ws4-btn-sm" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => deleteTimelineEvent(ev.id)}>✕</button>
              </div>
            ))}
            {!tlLoading && timelineEvents.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>No timeline events yet</div>}
          </div>
        </div>
      )}

      {/* ── TENSIONS ────────────────────────────────────────────────── */}
      {subTab === 'tensions' && (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>⚡ Character Tension Scanner</h2>
            <button className="ws4-btn ws4-btn-outline ws4-btn-sm" onClick={loadTensions} disabled={tensionLoading}>
              {tensionLoading ? '⏳ Scanning…' : '🔄 Rescan'}
            </button>
          </div>
          {tensionLoading ? <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>Scanning tensions…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {tensionPairs.map((p, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e8e5de' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {p.char_a_name} <span style={{ color: '#c44', fontSize: 12 }}>⚡</span> {p.char_b_name}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase',
                      background: p.tension_state === 'Explosive' ? '#fee' : p.tension_state === 'Simmering' ? '#fff3e0' : '#f5f5f5',
                      color: p.tension_state === 'Explosive' ? '#c44' : p.tension_state === 'Simmering' ? '#e65100' : '#666',
                    }}>{p.tension_state}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{p.relationship_type}{p.is_romantic ? ' · 💕 Romantic' : ''}</div>
                  {p.conflict_summary && <div style={{ fontSize: 12, color: '#666', marginTop: 6, lineHeight: 1.4 }}>{p.conflict_summary}</div>}
                  <button className="ws4-btn ws4-btn-primary ws4-btn-sm" style={{ marginTop: 10 }} onClick={() => proposeTensionScene(p)}>
                    ✦ Propose Scene
                  </button>
                </div>
              ))}
              {tensionPairs.length === 0 && <div style={{ color: '#999', gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>No high-tension pairs found. Increase relationship tension states to populate this scanner.</div>}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '10px 20px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          background: toast.type === 'error' ? '#fee' : '#e8f5e9',
          color: toast.type === 'error' ? '#c44' : '#2e7d32',
          border: `1px solid ${toast.type === 'error' ? '#fcc' : '#c8e6c9'}`,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
