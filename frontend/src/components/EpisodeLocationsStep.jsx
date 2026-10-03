/**
 * The Episode Locations step (Evoni's rulings L3 and L6, 2026-10-02, and her
 * answers Q12–Q16; docs/EVENT_EPISODE_FLOW.md §8(hh)).
 *
 *   L3. "At Start Episode, an Episode Locations step shows Home, Closet and
 *   Event (the event's set with its look) plus any additional locations,
 *   each changeable; creating a new set there returns to the step with it
 *   selected."
 *   L6. "An episode can have any number of scene sets, each with a role
 *   (home, closet, event, or an extra location such as a car or café).
 *   They're chosen together in the Episode Locations step and can be added
 *   or changed while the episode is a draft."
 *
 * Used before Start Episode (nothing is created until Confirm, Q13) and on
 * an episode while it is a draft. A role with no saved default is asked for
 * (Q12). "+ Create" makes a set with only its name and returns with it
 * selected; its images come later (Q14, L5). Extras: any number, each with a
 * free name (Q15).
 *
 * Props:
 *   showId, title, confirmLabel
 *   initial      [{ role, scene_set_id, name, scene_set }] (the proposal, or
 *                the episode's locations)
 *   missing      roles with no default ('home', 'closet', 'event')
 *   eventLook    the event's venue look, shown read-only under Event (L1,
 *                Q10); edited in the Event Package's Place section
 *   angleGaps    the angles the planner will ask for that a set lacks (L4,
 *                Q19): [{ role, scene_set_id, text, beats }], shown under
 *                the row while it still holds that set
 *   onConfirm(locations) → [{ role, scene_set_id, name }]
 *   onCancel, busy
 */
import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import OpenInSceneSets from './OpenInSceneSets';
import './EpisodeLocationsStep.css';

const ROLE_LABELS = { event: 'Event', home: 'Home', closet: 'Closet', extra: 'Extra location' };
const ROLE_SCENE_TYPE = { event: 'EVENT_LOCATION', home: 'HOME_BASE', closet: 'CLOSET', extra: 'OTHER' };
const FIXED_ROLES = ['event', 'home', 'closet'];

let extraKey = 0;
const nextKey = () => { extraKey += 1; return `extra-${extraKey}`; };

function initialRows(initial) {
  const byRole = Object.fromEntries(FIXED_ROLES.map((r) => [r, null]));
  const extras = [];
  for (const l of initial || []) {
    const row = { scene_set_id: l.scene_set_id, scene_set: l.scene_set || null };
    if (l.role === 'extra') extras.push({ key: nextKey(), name: l.name || '', ...row });
    else if (FIXED_ROLES.includes(l.role)) byRole[l.role] = row;
  }
  return { byRole, extras };
}

function SetThumb({ set }) {
  return set?.base_still_url
    ? <img className="els-thumb" src={set.base_still_url} alt="" />
    : <div className="els-thumb els-thumb-empty" aria-hidden="true">No image</div>;
}

function SetPicker({ showId, sets, role, onPick, onClose, setSets }) {
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const q = search.trim().toLowerCase();
  const shown = sets.filter((s) => !q || (s.name || '').toLowerCase().includes(q));

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/scene-sets', { name, scene_type: ROLE_SCENE_TYPE[role], show_id: showId });
      const set = res.data?.data;
      if (set?.id) {
        setSets((prev) => [set, ...prev]);
        onPick(set);
      }
    } catch (err) {
      console.error('[EpisodeLocationsStep] create set failed:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="els-picker" data-testid={`els-picker-${role}`}>
      <input className="els-input" aria-label="Search scene sets" placeholder="Search scene sets"
        value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="els-grid">
        {shown.map((s) => (
          <button key={s.id} type="button" className="els-option" onClick={() => onPick(s)} data-testid={`els-option-${s.id}`}>
            <SetThumb set={s} />
            <span className="els-option-name">{s.name}</span>
          </button>
        ))}
        {shown.length === 0 && <p className="els-note">No scene set matches.</p>}
      </div>
      <div className="els-create">
        <input className="els-input" aria-label="New scene set name" placeholder="+ Create a scene set"
          value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="button" className="els-btn" onClick={create} disabled={creating || !newName.trim()}>
          {creating ? 'Creating…' : '+ Create'}
        </button>
      </div>
      {error && <p className="els-error">{error}</p>}
      <button type="button" className="els-link" onClick={onClose}>Close</button>
    </div>
  );
}

export default function EpisodeLocationsStep({
  showId, title = 'Episode locations', confirmLabel = 'Confirm', initial = [], missing = [], eventLook = null, angleGaps = [],
  onConfirm, onCancel, busy = false,
}) {
  const [{ byRole, extras }, setRows] = useState(() => initialRows(initial));
  const [sets, setSets] = useState([]);
  const [picking, setPicking] = useState(null); // 'home' | 'closet' | 'event' | extra key

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/scene-sets?show_id=${showId}`)
      .then((res) => {
        if (cancelled) return;
        const list = (res.data?.data || []).filter((s) => !s.show_id || String(s.show_id) === String(showId));
        setSets(list);
      })
      .catch((err) => { console.error('[EpisodeLocationsStep] sets load failed:', err); });
    return () => { cancelled = true; };
  }, [showId]);

  // The event's set may be another show's (S7): keep it offered.
  const offered = useMemo(() => {
    const extra = [byRole.event?.scene_set].filter((s) => s && !sets.some((x) => x.id === s.id));
    return [...extra, ...sets];
  }, [sets, byRole.event]);

  const setFixed = (role, set) => setRows((r) => ({ ...r, byRole: { ...r.byRole, [role]: { scene_set_id: set.id, scene_set: set } } }));
  const setExtra = (key, patch) => setRows((r) => ({ ...r, extras: r.extras.map((x) => (x.key === key ? { ...x, ...patch } : x)) }));
  const removeExtra = (key) => setRows((r) => ({ ...r, extras: r.extras.filter((x) => x.key !== key) }));
  const addExtra = () => {
    const key = nextKey();
    setRows((r) => ({ ...r, extras: [...r.extras, { key, name: '', scene_set_id: null, scene_set: null }] }));
    setPicking(key);
  };

  const used = new Set([...FIXED_ROLES.map((r) => byRole[r]?.scene_set_id), ...extras.map((x) => x.scene_set_id)].filter(Boolean));
  const duplicate = used.size !== [...FIXED_ROLES.map((r) => byRole[r]?.scene_set_id), ...extras.map((x) => x.scene_set_id)].filter(Boolean).length;
  const unnamed = extras.some((x) => x.scene_set_id && !x.name.trim());

  const confirm = () => {
    const list = [
      ...FIXED_ROLES.filter((r) => byRole[r]?.scene_set_id).map((r) => ({ role: r, scene_set_id: byRole[r].scene_set_id, name: null })),
      ...extras.filter((x) => x.scene_set_id).map((x) => ({ role: 'extra', scene_set_id: x.scene_set_id, name: x.name.trim() })),
    ];
    onConfirm(list);
  };

  const row = (key, label, value, { onPick, extra = null } = {}) => (
    <div className="els-row" key={key} data-testid={`els-row-${key}`}>
      <SetThumb set={value?.scene_set} />
      <div className="els-row-body">
        <div className="els-row-label">{label}</div>
        <div className="els-row-set">
          {value?.scene_set_id ? (value.scene_set?.name || 'Scene set') : <span className="els-ask">Not chosen</span>}
        </div>
        {key === 'event' && (eventLook?.overall || eventLook?.areas?.length > 0) && (
          <div className="els-look" data-testid="els-event-look">
            <span className="els-look-label">Venue look</span>{' '}
            {[eventLook.overall, eventLook.areas?.length ? `Areas: ${eventLook.areas.join(', ')}` : null].filter(Boolean).join(' · ')}
          </div>
        )}
        {(angleGaps || []).filter((g) => g.role === key && value?.scene_set_id && g.scene_set_id === value.scene_set_id).map((g) => (
          <div key={g.text} className="els-gap-row">
            <div className="els-gap" data-testid={`els-gap-${key}`}>
              {g.text}{g.beats?.length ? ` (beat${g.beats.length === 1 ? '' : 's'} ${g.beats.join(', ')})` : ''}
            </div>
            {/* S8 (§8(dd)): the gap's one action, on its set and zone. */}
            <OpenInSceneSets showId={showId} setId={g.scene_set_id} zone={g.angle_id || g.kinds?.[0] || null}
              fromLabel="the event" need={g.text} className="els-gap-open" testId={`els-gap-open-${key}`} />
          </div>
        ))}
        {!value?.scene_set_id && missing.includes(key) && (
          <div className="els-note">No saved default: choose one.</div>
        )}
      </div>
      <button type="button" className="els-btn" onClick={() => setPicking(picking === key ? null : key)} data-testid={`els-change-${key}`}>
        {value?.scene_set_id ? 'Change' : 'Choose'}
      </button>
      {extra && <div className="els-row-extra">{extra}</div>}
      {picking === key && (
        <SetPicker showId={showId} sets={offered} setSets={setSets} role={FIXED_ROLES.includes(key) ? key : 'extra'}
          onPick={(set) => { onPick(set); setPicking(null); }} onClose={() => setPicking(null)} />
      )}
    </div>
  );

  return (
    <div className="els-overlay" role="dialog" aria-modal="true" aria-labelledby="els-title">
      <div className="els-panel" data-testid="episode-locations-step">
        <h2 id="els-title" className="els-title">{title}</h2>
        <p className="els-sub">Where this episode happens. Each can be changed; images can come later.</p>

        {FIXED_ROLES.map((r) => row(r, ROLE_LABELS[r], byRole[r], { onPick: (set) => setFixed(r, set) }))}

        {extras.map((x, i) => row(x.key, `${ROLE_LABELS.extra} ${i + 1}`, x, {
          onPick: (set) => setExtra(x.key, { scene_set_id: set.id, scene_set: set }),
          extra: (
            <div className="els-extra-name">
              <input className="els-input" aria-label={`Extra location ${i + 1} name`} placeholder="Name, e.g. Car or Café"
                value={x.name} onChange={(e) => setExtra(x.key, { name: e.target.value })} />
              <button type="button" className="els-link" onClick={() => removeExtra(x.key)}>Remove</button>
            </div>
          ),
        }))}

        <button type="button" className="els-btn els-add" onClick={addExtra} data-testid="els-add-extra">+ Add a location</button>

        {duplicate && <p className="els-error">A scene set holds one role in an episode.</p>}
        {unnamed && <p className="els-error">Name each extra location.</p>}

        <div className="els-actions">
          <button type="button" className="els-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="els-btn els-primary" onClick={confirm} disabled={busy || duplicate || unnamed} data-testid="els-confirm">
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
