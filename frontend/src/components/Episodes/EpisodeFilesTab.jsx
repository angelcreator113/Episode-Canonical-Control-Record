/**
 * Production › Files (Evoni, 2026-10-22: "how can we improve the files tab
 * layout"; her choices: three tabs, lighter photo cards, empty spots shrink,
 * one drop zone then sort). One drop zone at the top takes photos into Style
 * photos › To sort, where each is filed as a Style folder or a character
 * pose; videos go to Footage. Below it, three tabs with their counts:
 * Poses (EpisodePosesPanel), Style photos (EpisodeStylePhotosPanel) and
 * Footage (EpisodeRawFootageTab). All three load at once, so the counts are
 * right and switching is instant; only the open one shows.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { lookbookApi } from '../../lib/lookbookApi';
import EpisodePosesPanel from './EpisodePosesPanel';
import EpisodeStylePhotosPanel from './EpisodeStylePhotosPanel';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';
import './EpisodeFilesTab.css';

const TABS = [
  { key: 'poses', label: 'Poses' },
  { key: 'style', label: 'Style photos' },
  { key: 'footage', label: 'Footage' },
];
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const errorText = (err) => err?.response?.data?.error || err?.message || 'The photos could not be uploaded.';

export default function EpisodeFilesTab({ episode }) {
  const episodeId = episode?.id;
  const [tab, setTab] = useState('poses');
  const [counts, setCounts] = useState({ poses: null, style: null, footage: null });
  const [styleKey, setStyleKey] = useState(0);
  const [posesKey, setPosesKey] = useState(0);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind, text }
  const input = useRef(null);

  const setCount = useCallback((key, n) => setCounts((c) => (c[key] === n ? c : { ...c, [key]: n })), []);
  const onPoses = useCallback((n) => setCount('poses', n), [setCount]);
  const onStyle = useCallback((n) => setCount('style', n), [setCount]);
  const onFootage = useCallback((n) => setCount('footage', n), [setCount]);
  const onFiledAsPose = useCallback(() => setPosesKey((k) => k + 1), []);

  // Photos go to Style photos › To sort; videos are filed by who is on camera, in Footage.
  const send = async (fileList) => {
    const list = [...(fileList || [])];
    if (!list.length) return;
    const photos = list.filter((f) => PHOTO_TYPES.includes(f.type));
    const videos = list.filter((f) => (f.type || '').startsWith('video/'));
    const other = list.length - photos.length - videos.length;
    const notes = [];
    if (videos.length) notes.push(`${videos.length === 1 ? 'A video goes' : 'Videos go'} in Footage: drop ${videos.length === 1 ? 'it' : 'them'} on who is on camera.`);
    if (other) notes.push(`${other === 1 ? 'One file was' : `${other} files were`} skipped: use PNG, JPEG or WebP photos.`);
    if (!photos.length) {
      if (videos.length) setTab('footage');
      setMessage({ kind: other && !videos.length ? 'error' : 'info', text: notes.join(' ') });
      return;
    }
    setBusy(true);
    try {
      for (let i = 0; i < photos.length; i += 20) await lookbookApi.upload(episodeId, photos.slice(i, i + 20));
      setStyleKey((k) => k + 1);
      setTab('style');
      setMessage({ kind: 'ok', text: [`${photos.length} ${photos.length === 1 ? 'photo is' : 'photos are'} in To sort: open ⋯ on each to file it as a Style folder or a pose.`, ...notes].join(' ') });
    } catch (err) {
      console.error('[Files] upload failed:', err);
      setMessage({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="eft" data-testid="eft">
      <div
        className={`eft-drop${over ? ' is-over' : ''}`}
        data-testid="eft-drop"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer?.files); }}
      >
        <Upload size={20} aria-hidden />
        <span className="eft-drop-text">Drop photos here; they land in Style photos › To sort, ready to file as a Style folder or a pose.</span>
        <button type="button" className="eft-drop-btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Choose photos'}</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden data-testid="eft-input"
          onChange={(e) => { send(e.target.files); e.target.value = ''; }} />
      </div>
      {message && <p className={`eft-message is-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'} data-testid="eft-message">{message.text}</p>}

      <div className="eft-tabs" role="tablist" aria-label="Files">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`eft-tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`eft-panel-${t.key}`}
            className={`eft-tab${tab === t.key ? ' is-active' : ''}`} data-testid={`eft-tab-${t.key}`} onClick={() => setTab(t.key)}>
            {t.label}{counts[t.key] != null && <span className="eft-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="eft-panel-poses" aria-labelledby="eft-tab-poses" hidden={tab !== 'poses'}>
        <EpisodePosesPanel episode={episode} reloadKey={posesKey} onCount={onPoses} />
      </div>
      <div role="tabpanel" id="eft-panel-style" aria-labelledby="eft-tab-style" hidden={tab !== 'style'}>
        <EpisodeStylePhotosPanel episode={episode} reloadKey={styleKey} onCount={onStyle} onFiledAsPose={onFiledAsPose} />
      </div>
      <div role="tabpanel" id="eft-panel-footage" aria-labelledby="eft-tab-footage" hidden={tab !== 'footage'}>
        <EpisodeRawFootageTab episode={episode} onCount={onFootage} />
      </div>
    </div>
  );
}
