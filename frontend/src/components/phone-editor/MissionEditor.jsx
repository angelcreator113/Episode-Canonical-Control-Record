/**
 * MissionEditor — manage read-only observer missions for the show.
 *
 * Each mission is a name + optional description + array of objectives. Each
 * objective uses the SAME ConditionRow editor that zones/content zones use,
 * so the author's muscle memory works everywhere. No rewards in v1 — missions
 * only watch and report.
 *
 * Usage: mount inside a modal when `open` is true. The host owns open/close
 * state and supplies `showId` + optional `episodeId`. Saving a mission POSTs
 * or PUTs via the host's `api` singleton; this component stays focused on UX.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, X, Target, CheckCircle, Circle, Edit3, Gift } from 'lucide-react';
import api from '../../services/api';
import ConditionRow from './ConditionRow';
import ActionRow from './ActionRow';

const TOKENS = { parchment: '#FAF7F0', gold: '#B8962E', ink: '#2C2C2C' };
const MONO = "'DM Mono', monospace";
const PROSE = "'Lora', serif";

export default function MissionEditor({ open, showId, episodeId, onClose }) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | <missionId>

  const reload = useCallback(async () => {
    if (!showId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = episodeId ? `?episode_id=${encodeURIComponent(episodeId)}` : '';
      const res = await api.get(`/api/v1/ui-overlays/${showId}/missions${qs}`);
      setMissions(res.data?.missions || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [showId, episodeId]);

  useEffect(() => { if (open) reload(); }, [open, reload]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9600,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, maxHeight: '85vh',
          background: TOKENS.parchment, borderRadius: 16,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid #e8e0d0',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8e0d0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Target size={18} color={TOKENS.gold} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: PROSE, fontSize: 17, fontWeight: 700, color: TOKENS.ink }}>Missions</div>
            <div style={{ fontSize: 10, color: '#8a7e65', fontFamily: MONO, letterSpacing: 0.3, marginTop: 2 }}>
              Read-only observers — watch state, report progress
            </div>
          </div>
          {editing !== 'new' && (
            <button
              onClick={() => setEditing('new')}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 8, background: TOKENS.gold, color: '#fff', cursor: 'pointer', fontFamily: MONO, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} /> New
            </button>
          )}
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {error && (
            <div style={{ padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
              {error}
            </div>
          )}

          {editing === 'new' && (
            <MissionForm
              initial={null}
              showId={showId}
              episodeId={episodeId}
              onSaved={async () => { setEditing(null); await reload(); }}
              onCancel={() => setEditing(null)}
            />
          )}

          {editing && editing !== 'new' && (
            <MissionForm
              initial={missions.find(m => m.id === editing)}
              showId={showId}
              episodeId={episodeId}
              onSaved={async () => { setEditing(null); await reload(); }}
              onCancel={() => setEditing(null)}
            />
          )}

          {!editing && (
            <>
              {loading && <div style={{ padding: 20, textAlign: 'center', color: '#8a7e65', fontFamily: MONO, fontSize: 12 }}>Loading…</div>}
              {!loading && missions.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#8a7e65', fontFamily: MONO, fontSize: 12, lineHeight: 1.6 }}>
                  No missions yet.<br />
                  Click <strong>+ New</strong> to create one — missions watch state flags and report progress as players play.
                </div>
              )}
              {!loading && missions.map(m => (
                <MissionCard key={m.id} mission={m} onEdit={() => setEditing(m.id)} onDeleted={reload} showId={showId} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mission card ────────────────────────────────────────────────────────────
function MissionCard({ mission, onEdit, onDeleted, showId }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!confirm(`Delete mission "${mission.name}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/ui-overlays/${showId}/missions/${mission.id}`);
      onDeleted();
    } finally { setDeleting(false); }
  };
  const objectives = mission.objectives || [];
  return (
    <div style={{ padding: 12, marginBottom: 10, background: '#fff', borderRadius: 10, border: '1px solid #e8e0d0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: PROSE, fontSize: 15, fontWeight: 700, color: TOKENS.ink }}>{mission.name}</div>
          {mission.description && (
            <div style={{ fontSize: 12, color: '#6b5a28', lineHeight: 1.4, marginTop: 2 }}>{mission.description}</div>
          )}
          <div style={{ fontSize: 10, color: '#8a7e65', fontFamily: MONO, marginTop: 4 }}>
            {objectives.length} objective{objectives.length === 1 ? '' : 's'}
            {mission.episode_id ? ' · episode-scoped' : ' · show-wide'}
            {!mission.is_active && ' · inactive'}
          </div>
        </div>
        <button onClick={onEdit} style={iconBtn}><Edit3 size={14} /></button>
        <button onClick={handleDelete} disabled={deleting} style={{ ...iconBtn, color: '#dc2626' }}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

// ── Create / edit form ───────────────────────────────────────────────────────
function MissionForm({ initial, showId, episodeId, onSaved, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [objectives, setObjectives] = useState(initial?.objectives || []);
  const [rewardActions, setRewardActions] = useState(initial?.reward_actions || []);
  const [scopeToEpisode, setScopeToEpisode] = useState(initial ? Boolean(initial.episode_id) : Boolean(episodeId));
  const [isActive, setIsActive] = useState(initial ? initial.is_active !== false : true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const addObjective = () => {
    setObjectives(prev => [
      ...prev,
      { id: `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, label: '', condition: [{ key: '', op: 'eq', value: true }] },
    ]);
  };

  const save = async () => {
    setErr(null);
    if (!name.trim()) { setErr('Name is required'); return; }
    // Each objective needs at least one condition row with a key.
    const cleanObjs = objectives.map(o => ({
      id: o.id,
      label: (o.label || '').trim(),
      condition: (o.condition || []).filter(c => c.key && c.op),
    })).filter(o => o.label && o.condition.length > 0);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      objectives: cleanObjs,
      // Drop actions whose required fields are still empty (e.g. navigate
      // without a target) before sending — the server's Joi schema would
      // reject them anyway and we'd rather not trip the error banner.
      reward_actions: rewardActions.filter(a => {
        if (!a.type) return false;
        if (a.type === 'navigate') return Boolean(a.target);
        if (a.type === 'set_state') return Boolean(a.key);
        if (a.type === 'show_toast') return Boolean((a.text || '').trim());
        return true;
      }),
      is_active: isActive,
      episode_id: scopeToEpisode && episodeId ? episodeId : null,
    };

    setSaving(true);
    try {
      if (initial?.id) {
        await api.put(`/api/v1/ui-overlays/${showId}/missions/${initial.id}`, payload);
      } else {
        await api.post(`/api/v1/ui-overlays/${showId}/missions`, payload);
      }
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 14, background: '#fff', border: '1px solid #e8e0d0', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: PROSE, fontSize: 14, fontWeight: 700, color: TOKENS.ink }}>
        {initial ? 'Edit mission' : 'New mission'}
      </div>
      {err && <div style={{ padding: 8, background: '#fef2f2', color: '#991b1b', borderRadius: 6, fontSize: 11 }}>{err}</div>}

      <div>
        <label style={labelStyle}>NAME</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Break up with the ex" style={fieldStyle} />
      </div>
      <div>
        <label style={labelStyle}>DESCRIPTION</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What this mission is about (optional)" style={{ ...fieldStyle, minHeight: 60, fontFamily: PROSE }} />
      </div>

      {/* Objectives */}
      <div style={{ paddingTop: 6, borderTop: '1px dashed #f0ece4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={labelStyle}>OBJECTIVES {objectives.length > 0 && `(${objectives.length})`}</label>
          <button onClick={addObjective} style={addBtn}><Plus size={12} /> objective</button>
        </div>
        {objectives.length === 0 && (
          <div style={{ fontSize: 11, color: '#8a7e65', fontFamily: MONO, padding: '4px 0' }}>
            Add at least one objective — a labeled condition that passes when the player has done the thing.
          </div>
        )}
        {objectives.map((o, oi) => (
          <div key={o.id} style={{ padding: 8, marginBottom: 8, background: '#faf7f0', border: '1px solid #e8e0d0', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={o.label || ''}
                onChange={e => {
                  const next = [...objectives];
                  next[oi] = { ...o, label: e.target.value };
                  setObjectives(next);
                }}
                placeholder="Objective label (e.g. Read the message)"
                style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: PROSE }}
              />
              <button
                onClick={() => setObjectives(objectives.filter((_, i) => i !== oi))}
                style={iconBtn}
                aria-label="Remove objective"
              ><Trash2 size={12} /></button>
            </div>
            <div style={{ fontSize: 10, color: '#8a7e65', fontFamily: MONO, letterSpacing: 0.3 }}>
              PASSES WHEN (all of these are true):
            </div>
            {(o.condition || []).map((c, ci) => (
              <ConditionRow
                key={ci}
                condition={c}
                onChange={next => {
                  const nextObjs = [...objectives];
                  const nextConds = [...(o.condition || [])];
                  nextConds[ci] = next;
                  nextObjs[oi] = { ...o, condition: nextConds };
                  setObjectives(nextObjs);
                }}
                onRemove={() => {
                  const nextObjs = [...objectives];
                  const nextConds = (o.condition || []).filter((_, i) => i !== ci);
                  nextObjs[oi] = { ...o, condition: nextConds };
                  setObjectives(nextObjs);
                }}
              />
            ))}
            <button
              onClick={() => {
                const next = [...objectives];
                const nextConds = [...(o.condition || []), { key: '', op: 'eq', value: true }];
                next[oi] = { ...o, condition: nextConds };
                setObjectives(next);
              }}
              style={addBtn}
            ><Plus size={11} /> condition</button>
          </div>
        ))}
      </div>

      {/* Rewards on complete — fires once per playthrough when all objectives pass. */}
      <div style={{ paddingTop: 6, borderTop: '1px dashed #f0ece4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ ...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 0 }}>
            <Gift size={10} /> REWARDS ON COMPLETE {rewardActions.length > 0 && `(${rewardActions.length})`}
          </label>
          <button
            onClick={() => setRewardActions(prev => [...prev, { type: 'set_state', key: '', value: true }])}
            style={addBtn}
          ><Plus size={11} /> reward</button>
        </div>
        {rewardActions.length === 0 && (
          <div style={{ fontSize: 11, color: '#8a7e65', fontFamily: MONO, padding: '4px 0', lineHeight: 1.5 }}>
            Optional. Actions here run once when all objectives complete — e.g. <em>set_state</em> unlocks a gated zone, <em>show_toast</em> congratulates, <em>navigate</em> jumps to a reward screen.
          </div>
        )}
        {rewardActions.map((a, ai) => (
          <div key={ai} style={{ marginBottom: 6 }}>
            <ActionRow
              action={a}
              screenOptions={[]} /* MissionEditor isn't scoped to a screen list; navigate rewards use raw ids for now */
              onChange={(next) => {
                const arr = [...rewardActions];
                arr[ai] = next;
                setRewardActions(arr);
              }}
              onRemove={() => setRewardActions(rewardActions.filter((_, i) => i !== ai))}
            />
          </div>
        ))}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {episodeId && (
          <label style={{ fontSize: 11, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, cursor: 'pointer' }}>
            <input type="checkbox" checked={scopeToEpisode} onChange={e => setScopeToEpisode(e.target.checked)} />
            scope to this episode
          </label>
        )}
        <label style={{ fontSize: 11, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, cursor: 'pointer' }}>
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          active
        </label>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #f0ece4', paddingTop: 10, marginTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: '1px solid #e0d9ce', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#666', fontFamily: MONO }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 6, background: TOKENS.gold, color: '#fff', cursor: saving ? 'wait' : 'pointer', fontFamily: MONO, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Save size={12} /> {saving ? 'Saving…' : 'Save mission'}
        </button>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 10, fontWeight: 700, color: '#8a7e65', fontFamily: MONO, letterSpacing: 0.3, marginBottom: 4 };
const fieldStyle = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e0d9ce', borderRadius: 6, fontFamily: PROSE };
const iconBtn = { background: 'none', border: '1px solid #e8e0d0', borderRadius: 6, cursor: 'pointer', color: '#888', padding: 6, minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const addBtn = { padding: '4px 10px', fontSize: 10, fontWeight: 700, border: '1px solid #e0d9ce', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#8a7e65', fontFamily: MONO, letterSpacing: 0.3, display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' };
