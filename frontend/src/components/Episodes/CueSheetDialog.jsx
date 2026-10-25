// frontend/src/components/Episodes/CueSheetDialog.jsx
// The editor's cue sheet (Script tab → Export → Cue sheet): every sound,
// music, camera, video, edit and transition note in the script, beat by
// beat, the cold open's shot list first (lib/cueSheet). When the episode has
// a whole-episode take with beat markers, each beat says when it starts in
// that take. Copy it, or download it as a .txt file.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Download } from 'lucide-react';
import { cueSheet, cueSheetText, cueSheetFileName } from '../../lib/cueSheet';
import { fullTakes } from '../../lib/fullEpisodeTake';
import { clipMarks } from '../../lib/assembleTakes';
import { rawClipsApi } from '../../lib/rawClipsApi';
import useDialogLayer from '../../hooks/useDialogLayer';
import { copyText, downloadText } from './ScriptReadActions';
import { scriptFileName } from '../../lib/scriptExport';

export default function CueSheetDialog({ scriptText, title = '', episodeId = null, episodeNumber = null, onClose }) {
  const [takes, setTakes] = useState([]);
  const [takeId, setTakeId] = useState('');
  const [said, setSaid] = useState(null);
  const isTop = useDialogLayer(true);
  const closeRef = useRef(null);

  // The whole-episode takes with beat markers; the newest is picked.
  useEffect(() => {
    if (!episodeId) return undefined;
    let live = true;
    Promise.resolve().then(() => rawClipsApi.list(episodeId))
      .then((clips) => {
        if (!live) return;
        const marked = fullTakes(clips).filter((c) => clipMarks(c).length > 0);
        setTakes(marked);
        const fav = marked.find((c) => c.is_favorite === true);
        setTakeId(String((fav || marked[marked.length - 1])?.id ?? ''));
      })
      .catch((err) => console.error('[CueSheet] takes not loaded:', err));
    return () => { live = false; };
  }, [episodeId]);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isTop()) { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, isTop]);

  const take = takes.find((c) => String(c.id) === takeId) || null;
  const text = useMemo(() => {
    const sheet = cueSheet(scriptText, { marks: take ? clipMarks(take) : null });
    return cueSheetText(sheet, { title, takeLabel: take?.label || '' });
  }, [scriptText, take, title]);

  const say = (msg) => { setSaid(msg); setTimeout(() => setSaid(null), 2500); };
  const copy = async () => say((await copyText(text)) ? 'Cue sheet copied' : 'Could not copy. Select the text and copy it instead.');
  const download = () => {
    try {
      downloadText(text, cueSheetFileName(scriptFileName(title, episodeNumber)));
    } catch (err) {
      console.error('[CueSheet] download failed:', err);
      say('The download could not be made.');
    }
  };

  return createPortal(
    <div className="str-cue" role="dialog" aria-modal="true" aria-label="Cue sheet" onClick={onClose} data-testid="cue-sheet">
      <div className="str-cue-card" onClick={(e) => e.stopPropagation()}>
        <div className="str-cue-head">
          <h3 className="str-cue-title">Cue sheet</h3>
          <button type="button" ref={closeRef} className="str-icon-btn" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        </div>
        <p className="str-cue-sub">Every sound, music, camera, video, edit and transition note in the script, beat by beat, for whoever edits the episode. The notes before Beat 1 are the cold open’s shot list.</p>
        {takes.length > 0 ? (
          <label className="str-cue-take">
            Beat times from
            <select value={takeId} onChange={(e) => setTakeId(e.target.value)} data-testid="cue-sheet-take">
              <option value="">No times</option>
              {takes.map((c) => <option key={c.id} value={String(c.id)}>{c.label || 'Full episode take'}{c.is_favorite ? ' ★' : ''}</option>)}
            </select>
          </label>
        ) : (
          <p className="str-cue-sub">Record the whole episode on the teleprompter to add each beat’s start time.</p>
        )}
        <pre className="str-cue-text" data-testid="cue-sheet-text">{text}</pre>
        <div className="str-cue-actions">
          <button type="button" className="esp-btn str-launch" onClick={copy} data-testid="cue-sheet-copy"><Copy size={14} aria-hidden="true" /> Copy</button>
          <button type="button" className="esp-btn str-launch" onClick={download} data-testid="cue-sheet-download"><Download size={14} aria-hidden="true" /> Download .txt</button>
          {said && <span className="str-cue-said" role="status">{said}</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
