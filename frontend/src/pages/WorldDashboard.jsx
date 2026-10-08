/**
 * WorldDashboard — World State + Tensions (the LalaVerse hub's State tab)
 * Merges: UniverseWorldStatePage and UniverseTensionsPage, whose routes open
 * this tab (2026-10-08, utils/worldRedirects). Its Setup Progress moved to the hub's
 * Overview as components/WorldSetupProgress (2026-10-04).
 *
 * 2026-10-06: in the hub's design (WorldDashboard.css, tokens only, State's
 * blue). Inside the hub the front page (components/State/StateSummary)
 * comes first, fed by this page's snapshots and tension scan; the World
 * State and Tensions tabs stay below it.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { tabFromSearch } from '../utils/worldRedirects';
import StateSummary from '../components/State/StateSummary';
import useActiveShow from '../hooks/useActiveShow';
import { AUTO_SNAPSHOT_LABEL, TENSION_LEVELS, snapshotLine } from '../lib/stateSummary';
import './WorldDashboard.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Track 6 CP7 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 7 helpers covering 7 explicit-endpoint fetch sites on /world/* (snapshots,
// timeline, tension-scanner, create-tension-proposal).
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

const TABS = [
  { key: 'state', label: 'World State' },
  { key: 'tensions', label: 'Tensions' },
];

const TL_TYPES = [['plot', 'Plot'], ['backstory', 'Backstory'], ['world', 'World'], ['character', 'Character'], ['relationship', 'Relationship']];
const IMPACTS = [['minor', 'Minor'], ['moderate', 'Moderate'], ['major', 'Major'], ['catastrophic', 'Catastrophic']];
const toneOf = (state) => TENSION_LEVELS[String(state || '').toLowerCase()]?.tone || 'blue';

export default function WorldDashboard({ embedded = false }) {
  const navigate = useNavigate();
  // A snapshot is saved to the active show's universe (the script writers
  // read that universe's newest; wiring map fix-list item 17).
  const { showId } = useActiveShow();
  const [tab, setTab] = useState(() => tabFromSearch(TABS, 'state', undefined, 'sub'));
  const [toast, setToast] = useState(null);
  const flash = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const snapLabelRef = useRef(null);
  const [focusSnap, setFocusSnap] = useState(false);

  // World state; snapshots is null until the first read lands.
  const [snapshots, setSnapshots] = useState(null);
  const [snapFailed, setSnapFailed] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapForm, setSnapForm] = useState({ snapshot_label:'', world_facts:'', active_threads:'' });
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [tlForm, setTlForm] = useState({ event_name:'', event_description:'', event_type:'plot', impact_level:'moderate', story_date:'' });

  // Tensions
  const [tensionPairs, setTensionPairs] = useState([]);
  // The scan's own verdict: { status: 'ok' | 'scan_failed', characters_scanned, error }
  const [tensionScan, setTensionScan] = useState(null);
  const [tensionLoading, setTensionLoading] = useState(false);

  // Load state data
  const loadSnapshots = useCallback(async () => {
    setSnapLoading(true);
    try { const r = await listSnapshotsApi(); setSnapshots(r.data?.snapshots||[]); setSnapFailed(false); }
    catch(e){ console.error(e); setSnapshots((prev) => prev || []); setSnapFailed(true); }
    finally{setSnapLoading(false);}
  }, []);
  const loadTimeline = useCallback(async () => { setTlLoading(true); try { const r = await listTimelineApi(); setTimelineEvents(r.data?.events||[]); } catch(e){console.error(e);} finally{setTlLoading(false);} }, []);
  // The scanner contract (routes/worldStudio.js): pairs carry char_a / char_b
  // as { id, name } objects (the page read char_a_name, which never existed,
  // so every pair rendered nameless), and the scan says whether it ran.
  const loadTensions = useCallback(async () => {
    setTensionLoading(true);
    try { const r = await getTensionScannerApi(); setTensionPairs(r.data?.pairs || []); setTensionScan({ status: r.data?.status || 'ok', characters_scanned: r.data?.characters_scanned, error: r.data?.error }); }
    catch (e) { console.error(e); setTensionPairs([]); setTensionScan({ status: 'scan_failed', error: e.response?.data?.error || e.message }); }
    finally { setTensionLoading(false); }
  }, []);

  // In the hub the front page shows both, so both load at once.
  const [loadedTabs] = useState(() => new Set());
  useEffect(() => {
    const want = embedded ? ['state', 'tensions'] : [tab];
    for (const k of want) {
      if (loadedTabs.has(k)) continue;
      loadedTabs.add(k);
      if (k === 'state') { loadSnapshots(); loadTimeline(); }
      if (k === 'tensions') loadTensions();
    }
  }, [tab, embedded, loadedTabs, loadSnapshots, loadTimeline, loadTensions]);

  // "Take a snapshot" on the front page opens World State at the form.
  useEffect(() => {
    if (!focusSnap || tab !== 'state') return;
    setFocusSnap(false);
    const el = snapLabelRef.current;
    if (el) { el.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); el.focus(); }
  }, [focusSnap, tab]);
  const takeSnapshot = () => { setTab('state'); setFocusSnap(true); };
  const openTensions = () => setTab('tensions');

  const saveSnapshot = async () => {
    try { await createSnapshotApi({ snapshot_label:snapForm.snapshot_label, ...(showId ? { show_id:showId } : {}), world_facts:snapForm.world_facts?snapForm.world_facts.split('\n').filter(Boolean):[], active_threads:snapForm.active_threads?snapForm.active_threads.split('\n').filter(Boolean):[] }); flash('Snapshot saved'); setSnapForm({snapshot_label:'',world_facts:'',active_threads:''}); loadSnapshots(); } catch { flash('Failed','error'); }
  };

  const saveTimelineEvent = async () => {
    try { await createTimelineEventApi(tlForm); flash('Event added'); setTlForm({event_name:'',event_description:'',event_type:'plot',impact_level:'moderate',story_date:''}); loadTimeline(); } catch { flash('Failed','error'); }
  };

  const deleteTimelineEvent = async (id) => {
    try { await deleteTimelineEventApi(id); flash('Deleted'); loadTimeline(); } catch { flash('Failed','error'); }
  };

  // The proposal contract: the body is the scanner's pair itself (it sent
  // char_a_id / char_b_id, which the route never read, so it was refused 400).
  const proposeTensionScene = async (pair) => {
    try {
      const r = await createTensionProposalApi({ char_a: pair.char_a, char_b: pair.char_b, tension_state: pair.tension_state, relationship_type: pair.relationship_type, conflict_summary: pair.conflict_summary, romantic: pair.romantic });
      if (r.data?.proposal) navigate('/story-evaluation', { state: { sceneProposal: r.data.proposal } }); else flash('Could not generate a proposal', 'error');
    } catch (err) { flash(err.response?.data?.error || 'Could not generate a proposal', 'error'); }
  };

  // The temperature rows are readings, not snapshots anyone took.
  const saved = (snapshots || []).filter((s) => s.snapshot_label !== AUTO_SNAPSHOT_LABEL);
  const autoCount = (snapshots || []).length - saved.length;

  return (
    <div className={`wd${embedded ? ' is-embedded' : ''}`}>
      {embedded && (
        <StateSummary
          snapshots={snapshots}
          snapshotsFailed={snapFailed}
          tensions={{ pairs: tensionPairs, scan: tensionLoading ? null : tensionScan }}
          onTakeSnapshot={takeSnapshot}
          onOpenTensions={openTensions}
        />
      )}

      <div className="wd-shell">
        {/* Inside the LalaVerse hub the tab is the heading */}
        {!embedded && (
          <div className="wd-head">
            <h1 className="wd-h1">World Dashboard</h1>
            <p className="wd-note">Current world state and character tensions</p>
          </div>
        )}

        <div className="wd-tabs" role="tablist" aria-label="State sections">
          {TABS.map(t => <button key={t.key} type="button" role="tab" aria-selected={tab===t.key} className={`wd-tab${tab===t.key?' is-active':''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>

        {/* WORLD STATE */}
        {tab === 'state' && (
          <div role="tabpanel" aria-label="World State">
            <h2 className="wd-h2">State snapshots</h2>
            <p className="wd-note">What is true of the world at a point in the story: its facts and the threads still open.</p>
            <div className="wd-form">
              <label className="wd-field"><span>Snapshot label *</span>
                <input ref={snapLabelRef} className="wd-input" placeholder="e.g. Before the Dazzle Season" value={snapForm.snapshot_label} onChange={e=>setSnapForm(p=>({...p,snapshot_label:e.target.value}))} />
              </label>
              <div className="wd-two">
                <label className="wd-field"><span>World facts (one per line)</span>
                  <textarea className="wd-input" rows={3} value={snapForm.world_facts} onChange={e=>setSnapForm(p=>({...p,world_facts:e.target.value}))} />
                </label>
                <label className="wd-field"><span>Active threads (one per line)</span>
                  <textarea className="wd-input" rows={3} value={snapForm.active_threads} onChange={e=>setSnapForm(p=>({...p,active_threads:e.target.value}))} />
                </label>
              </div>
              <button type="button" className="wd-btn" onClick={saveSnapshot} disabled={!snapForm.snapshot_label}>Save Snapshot</button>
            </div>
            {snapLoading && !snapshots ? <p className="wd-empty">Loading…</p> : (
              <>
                {snapFailed && <p className="wd-empty">The snapshots could not be read just now.</p>}
                {!snapFailed && saved.length === 0 && <p className="wd-empty">No snapshots saved yet.</p>}
                <ul className="wd-list">
                  {saved.map(s => (
                    <li key={s.id} className="wd-card">
                      <div className="wd-card-top"><strong className="wd-card-title">{s.snapshot_label}</strong><span className="wd-meta">{snapshotLine(s)}{s.timeline_position ? ` · position ${s.timeline_position}` : ''}</span></div>
                      {s.world_facts?.length>0 && <div className="wd-chips">{s.world_facts.map((f,i)=><span key={i} className="wd-chip">{typeof f === 'string' ? f : f?.fact}</span>)}</div>}
                      {s.active_threads?.length>0 && <div className="wd-chips">{s.active_threads.map((t,i)=><span key={i} className="wd-chip is-thread">{typeof t === 'string' ? t : t?.name || t?.thread_name}</span>)}</div>}
                    </li>
                  ))}
                </ul>
                {autoCount > 0 && <p className="wd-foot">{autoCount === 1 ? 'One world temperature reading is' : `${autoCount} world temperature readings are`} kept with the snapshots and not listed here.</p>}
              </>
            )}

            <h2 className="wd-h2 is-spaced">Timeline events</h2>
            <p className="wd-note">What happened in the world, in story order. Each one also lands on the story calendar.</p>
            <div className="wd-form">
              <div className="wd-two">
                <label className="wd-field"><span>Event name *</span>
                  <input className="wd-input" value={tlForm.event_name} onChange={e=>setTlForm(p=>({...p,event_name:e.target.value}))} />
                </label>
                <label className="wd-field"><span>Story date</span>
                  <input className="wd-input" value={tlForm.story_date} onChange={e=>setTlForm(p=>({...p,story_date:e.target.value}))} />
                </label>
                <label className="wd-field"><span>Type</span>
                  <select className="wd-input" value={tlForm.event_type} onChange={e=>setTlForm(p=>({...p,event_type:e.target.value}))}>
                    {TL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="wd-field"><span>Impact</span>
                  <select className="wd-input" value={tlForm.impact_level} onChange={e=>setTlForm(p=>({...p,impact_level:e.target.value}))}>
                    {IMPACTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              </div>
              <label className="wd-field"><span>Description</span>
                <textarea className="wd-input" rows={2} value={tlForm.event_description} onChange={e=>setTlForm(p=>({...p,event_description:e.target.value}))} />
              </label>
              <button type="button" className="wd-btn" onClick={saveTimelineEvent} disabled={!tlForm.event_name}>Add Event</button>
            </div>
            {tlLoading ? <p className="wd-empty">Loading…</p> : timelineEvents.length === 0 ? <p className="wd-empty">No timeline events yet.</p> : (
              <ul className="wd-list">
                {timelineEvents.map(ev => (
                  <li key={ev.id} className={`wd-card wd-event is-${ev.impact_level || 'minor'}`}>
                    <div className="wd-card-top">
                      <strong className="wd-card-title">{ev.event_name}</strong>
                      <button type="button" className="wd-delete" aria-label={`Delete ${ev.event_name}`} onClick={()=>deleteTimelineEvent(ev.id)}>Delete</button>
                    </div>
                    <span className="wd-meta">{ev.event_type} · {ev.impact_level}{ev.story_date?` · ${ev.story_date}`:''}</span>
                    {ev.event_description && <p className="wd-card-text">{ev.event_description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* TENSIONS */}
        {tab === 'tensions' && (
          <div role="tabpanel" aria-label="Tensions" data-testid="wd-tensions-panel">
            <div className="wd-card-top wd-section-head">
              <h2 className="wd-h2">Character tension scanner</h2>
              <button type="button" className="wd-btn is-quiet" onClick={loadTensions} disabled={tensionLoading}>{tensionLoading?'Scanning...':'Rescan'}</button>
            </div>
            <p className="wd-note">Pairs whose relationship is Simmering, Unresolved, High or Explosive. Propose Scene turns one into a scene proposal for Story Evaluation.</p>
            {tensionLoading ? <p className="wd-empty">Scanning…</p> : (
              <div className="wd-grid">
                {tensionPairs.map((p,i) => (
                  <div key={i} className={`wd-card wd-pair wd-tone-${toneOf(p.tension_state)}`}>
                    <div className="wd-card-top">
                      <strong className="wd-card-title">{p.char_a?.name || 'Unknown'} &amp; {p.char_b?.name || 'Unknown'}</strong>
                      <span className="wd-state">{p.tension_state}</span>
                    </div>
                    <span className="wd-meta">{p.relationship_type}{p.romantic?' · romantic':''}</span>
                    {p.conflict_summary && <p className="wd-card-text">{p.conflict_summary}</p>}
                    <button type="button" className="wd-btn is-small" onClick={()=>proposeTensionScene(p)}>Propose Scene</button>
                  </div>
                ))}
                {/* Three different empties: the scan failed, nothing to scan, nothing simmering */}
                {tensionPairs.length===0 && tensionScan?.status === 'scan_failed' && <div data-testid="tensions-scan-failed" className="wd-warn">The scan could not run{tensionScan.error ? `: ${tensionScan.error}` : ''}. This is not "no tension". Rescan, or check the server log.</div>}
                {tensionPairs.length===0 && tensionScan?.status === 'ok' && tensionScan.characters_scanned === 0 && <div data-testid="tensions-no-data" className="wd-empty is-wide">No confirmed relationships to scan yet. Add them, with a tension, on the Relationships page.</div>}
                {tensionPairs.length===0 && tensionScan?.status === 'ok' && tensionScan.characters_scanned > 0 && <div data-testid="tensions-none" className="wd-empty is-wide">No high-tension pairs among {tensionScan.characters_scanned} characters.</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <div role="status" className={`wd-toast${toast.type==='error'?' is-error':''}`}>{toast.msg}</div>}
    </div>
  );
}
