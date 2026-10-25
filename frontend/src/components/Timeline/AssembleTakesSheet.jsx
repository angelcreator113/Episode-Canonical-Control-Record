// frontend/src/components/Timeline/AssembleTakesSheet.jsx
// Edit & Assemble → "Takes to use": each beat's takes from the episode's
// Files, her ★ favourite first and picked, and "Use favourites" to line the
// favourites up in beat order (lib/assembleTakes). A beat she only has in a
// whole-episode take uses that take's stretch, from its beat marker to the
// next. The picks are kept on this device; the ★ itself is set on the
// teleprompter's Takes list.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, ListOrdered, Copy } from 'lucide-react';
import { rawClipsApi, clipLength } from '../../lib/rawClipsApi';
import { markClock } from '../../lib/fullEpisodeTake';
import { assembly, assemblyStat, assemblyText, favouritePicks, readPicks, writePicks } from '../../lib/assembleTakes';
import { copyText } from '../Episodes/ScriptReadActions';

const takeName = (clip) => clip.label || clip.original_filename || 'Take';

function optionNote(o) {
  if (o.full) return `from ${markClock(o.start)}${o.end != null ? ` to ${markClock(o.end)}` : ' to the end'} of the whole-episode take`;
  return clipLength(o.clip.duration_seconds) || '';
}

export default function AssembleTakesSheet({ episodeId, onClose }) {
  const [clips, setClips] = useState([]);
  const [beats, setBeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picks, setPicks] = useState(() => readPicks(episodeId));
  const [lined, setLined] = useState(false);
  const [said, setSaid] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      Promise.resolve().then(() => rawClipsApi.list(episodeId)),
      Promise.resolve().then(() => rawClipsApi.beats(episodeId)).catch((err) => { console.error('[AssembleTakes] scene names not loaded:', err); return []; }),
    ])
      .then(([c, b]) => { if (live) { setClips(c); setBeats(b); } })
      .catch((err) => { console.error('[AssembleTakes] takes not loaded:', err); if (live) setError('Could not load the takes.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [episodeId]);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const keep = useCallback((next) => { setPicks(next); writePicks(episodeId, next); }, [episodeId]);
  const rows = assembly(clips, beats, picks);
  const order = assemblyText(rows, markClock);

  const pick = (beat, key) => { setLined(false); keep({ ...picks, [beat]: key }); };
  const useFavourites = () => { keep(favouritePicks(clips, beats)); setLined(true); };
  const copy = async () => {
    const ok = await copyText(order);
    setSaid(ok ? 'Order copied' : 'Could not copy. Select the text and copy it instead.');
    setTimeout(() => setSaid(null), 2500);
  };

  return createPortal(
    <div className="ats" role="dialog" aria-modal="true" aria-label="Takes to use" onClick={onClose} data-testid="assemble-takes">
      {/* Keys stay in the sheet: the editor's own shortcuts (Space plays) listen on the window. */}
      <div className="ats-card" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation(); }}>
        <div className="ats-head">
          <div>
            <h2 className="ats-title">Takes to use</h2>
            <p className="ats-sub">Each beat’s ★ favourite take comes first and is picked. Pick another take if you like; your picks stay on this device.</p>
          </div>
          <button type="button" ref={closeRef} className="ats-icon-btn" onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="ats-bar">
          <button type="button" className="ats-btn is-primary" onClick={useFavourites} disabled={loading} data-testid="assemble-use-favourites">
            <Star size={14} aria-hidden="true" /> Use favourites
          </button>
          <span className="ats-stat" data-testid="assemble-stat">{assemblyStat(rows)}</span>
        </div>
        {error && <p className="ats-error" role="alert">{error}</p>}
        {lined && (
          <div className="ats-lined" data-testid="assemble-lined" role="status">
            <p className="ats-lined-head"><ListOrdered size={14} aria-hidden="true" /> Favourites lined up in beat order</p>
            <pre className="ats-order">{order}</pre>
            <button type="button" className="ats-btn" onClick={copy}><Copy size={14} aria-hidden="true" /> Copy the order</button>
            {said && <span className="ats-said">{said}</span>}
          </div>
        )}
        {loading ? <p className="ats-sub">Loading takes…</p> : (
          <ol className="ats-beats">
            {rows.map((r) => (
              <li key={r.number} className="ats-beat" data-testid={`assemble-beat-${r.number}`}>
                <h3 className="ats-beat-name">{r.number}. {r.name}</h3>
                {r.options.length === 0 ? <p className="ats-none">No take yet. Record this beat on the teleprompter, or link a clip to it in Files.</p> : (
                  <ul className="ats-options">
                    {r.options.map((o) => (
                      <li key={o.key}>
                        <label className={`ats-option${r.pick?.key === o.key ? ' is-on' : ''}`}>
                          <input type="radio" name={`assemble-beat-${r.number}`} checked={r.pick?.key === o.key} onChange={() => pick(r.number, o.key)} />
                          <span className="ats-option-name">
                            {o.favorite && <Star size={13} aria-label="Favourite" className="ats-star" />} {takeName(o.clip)}
                          </span>
                          {optionNote(o) && <span className="ats-option-note">{optionNote(o)}</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
}
