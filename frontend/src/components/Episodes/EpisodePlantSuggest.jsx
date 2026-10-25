/**
 * Script tab › "This episode must cover" › Suggest plants from this script
 * (plant tracker, 2026-10-25). One AI read of the saved script (POST
 * /episodes/:id/season-plants/suggest, Haiku; services/seasonTwists
 * suggestPlantsFromScript) proposes the details it plants for later: the
 * forward hook, a reveal, an offer. Each draft is only shown: she can fix
 * its words, kind, beat and planned payoff, then Keep saves it as a plant
 * planted in this episode (PUT /world/:showId/season/twists), or Drop
 * discards it. Nothing is saved without her. Every plant is listed on the
 * Season page's Plants tab.
 *
 * Props: episodeId, hasScript, onSaved (optional: after a plant is kept).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sprout, Check, X } from 'lucide-react';
import api from '../../services/api';
import { PLANT_KINDS, KIND_LABEL } from '../../lib/seasonPlants';
import { seasonPageHref } from '../../lib/seasonPage';
import './EpisodePlantSuggest.css';

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

export default function EpisodePlantSuggest({ episodeId, hasScript, onSaved = null }) {
  // { show_id, plant_slot_id, later_slots, drafts: [{ key, ... }] } once read.
  const [found, setFound] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [note, setNote] = useState(null);

  const suggest = async () => {
    setReading(true); setNote(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/season-plants/suggest`);
      const stamp = Date.now();
      const drafts = (res.data?.drafts || []).map((d, i) => ({ ...d, key: `p-${stamp}-${i}`, plant_beat: d.plant_beat ?? '' }));
      setFound({ ...res.data, drafts });
      if (!drafts.length) setNote({ text: 'No new plants found in this script.' });
    } catch (err) {
      console.error('[EpisodePlantSuggest] suggest failed:', err);
      setNote({ error: true, text: errorOf(err, 'The script could not be read for plants. Try again.') });
    } finally { setReading(false); }
  };

  const change = (key, patch) => setFound((f) => ({ ...f, drafts: f.drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)) }));
  const dropDraft = (key) => setFound((f) => ({ ...f, drafts: f.drafts.filter((d) => d.key !== key) }));

  const keep = async (d) => {
    setSaving(d.key); setNote(null);
    try {
      await api.put(`/api/v1/world/${found.show_id}/season/twists`, {
        title: d.title.trim(), description: d.description || '', kind: d.kind,
        plant_beat: d.plant_beat === '' ? null : Number(d.plant_beat),
        plant_slot_id: d.plant_slot_id, payoff_slot_id: d.payoff_slot_id || '', status: 'planted',
        thread_ids: [], character_ids: [], note: '',
      });
      dropDraft(d.key);
      setNote({ text: `Kept “${d.title.trim()}” as a plant.` });
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[EpisodePlantSuggest] keep failed:', err);
      setNote({ error: true, text: errorOf(err, 'The plant was not saved. Try again.') });
    } finally { setSaving(null); }
  };

  const drafts = found?.drafts || [];
  const later = found?.later_slots || [];

  return (
    <div className="eps" data-testid="script-plants">
      <h4 className="eps-title"><Sprout size={14} aria-hidden="true" /> Plants for later</h4>
      <p className="eps-about">Small details this script sets up that should pay off later in the season.</p>
      <button type="button" className="esp-btn is-small" disabled={!hasScript || reading} onClick={suggest} data-testid="script-plants-suggest">
        {reading ? 'Reading the script…' : 'Suggest plants from this script'}
      </button>
      {!hasScript && <p className="eps-note">Write the script first.</p>}
      {note && <p className={`eps-note${note.error ? ' is-error' : ' is-done'}`} role="status">{note.text}</p>}

      {drafts.length > 0 && (
        <>
          <p className="eps-note is-ai">Suggested by AI. Nothing is saved until you keep it.</p>
          <ul className="eps-list">
            {drafts.map((d) => (
              <li key={d.key} className="eps-item" data-testid={`script-plant-${d.key}`}>
                <label className="eps-field is-wide">
                  <span>The plant</span>
                  <input type="text" maxLength={200} value={d.title} onChange={(e) => change(d.key, { title: e.target.value })} />
                </label>
                {d.description && <span className="eps-desc">{d.description}</span>}
                {d.quote && <span className="eps-quote">“{d.quote}”</span>}
                <label className="eps-field">
                  <span>Kind</span>
                  <select value={d.kind} onChange={(e) => change(d.key, { kind: e.target.value })}>
                    {PLANT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </label>
                <label className="eps-field">
                  <span>Beat</span>
                  <input type="number" min={1} max={99} inputMode="numeric" value={d.plant_beat} onChange={(e) => change(d.key, { plant_beat: e.target.value })} />
                </label>
                <label className="eps-field">
                  <span>Pays off in</span>
                  <select value={d.payoff_slot_id || ''} onChange={(e) => change(d.key, { payoff_slot_id: e.target.value || null })}>
                    <option value="">Not chosen yet</option>
                    {later.map((s) => <option key={s.id} value={s.id}>Episode {s.slot_number}</option>)}
                  </select>
                </label>
                <span className="eps-actions">
                  <button type="button" className="esp-btn is-small" disabled={saving === d.key || !d.title.trim()} onClick={() => keep(d)} aria-label={`Keep ${d.title}`}>
                    <Check size={13} aria-hidden="true" /> {saving === d.key ? 'Keeping…' : 'Keep'}
                  </button>
                  <button type="button" className="esp-btn is-small" disabled={saving === d.key} onClick={() => dropDraft(d.key)} aria-label={`Drop ${d.title}`}>
                    <X size={13} aria-hidden="true" /> Drop
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {found?.show_id && (
        <Link className="esp-link eps-link" to={seasonPageHref(found.show_id, 'plants')} data-testid="script-plants-all">See every plant in the season</Link>
      )}
    </div>
  );
}
