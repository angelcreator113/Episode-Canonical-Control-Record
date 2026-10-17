/**
 * Assets → Files: the episode's raw, unedited video clips (Evoni,
 * 2026-10-17), in three lanes by who is on camera: Lala, JustAWoman and
 * Guest. Drop clips on a lane to upload them. A clip filmed on a green
 * screen gets a cut-out with the green removed, made on the server in the
 * background (on by default for Lala); the original is always kept. Each
 * clip plays as the original or the cut-out, can redo the green removal at
 * another strength, move to another lane, or be deleted.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Film, Trash2, Play, WandSparkles, X, Loader, CircleCheck, CircleAlert, Clock, RefreshCw, UserRound,
} from 'lucide-react';
import { rawClipsApi, PERFORMERS, STRENGTHS, clipLength, clipSize, anyKeying } from '../../lib/rawClipsApi';
import './EpisodeRawFootageTab.css';

const POLL_MS = 5000;

const STATUS = {
  none: { label: 'Original only', Icon: Film, tone: 'is-plain' },
  queued: { label: 'Waiting to remove green', Icon: Clock, tone: 'is-wait' },
  processing: { label: 'Removing green…', Icon: Loader, tone: 'is-wait' },
  done: { label: 'Background removed', Icon: CircleCheck, tone: 'is-done' },
  failed: { label: "Couldn't remove green", Icon: CircleAlert, tone: 'is-failed' },
};

function ClipPlayer({ clip, onClose }) {
  const [view, setView] = useState(clip.url_cutout ? 'cutout' : 'original');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const src = view === 'cutout' ? clip.url_cutout : clip.url_raw;
  return (
    <div className="erf-modal" role="dialog" aria-modal="true" aria-label={`Play ${clip.label || 'clip'}`} onClick={onClose}>
      <div className="erf-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="erf-modal-head">
          <h3 className="erf-modal-title">{clip.label || clip.original_filename || 'Clip'}</h3>
          <button type="button" className="erf-icon-btn" onClick={onClose} aria-label="Close"><X size={18} aria-hidden /></button>
        </div>
        {clip.url_cutout && (
          <div className="erf-toggle" role="group" aria-label="Which version">
            <button type="button" className={view === 'original' ? 'is-on' : ''} aria-pressed={view === 'original'} onClick={() => setView('original')}>Original</button>
            <button type="button" className={view === 'cutout' ? 'is-on' : ''} aria-pressed={view === 'cutout'} onClick={() => setView('cutout')}>Background removed</button>
          </div>
        )}
        <div className={`erf-player${view === 'cutout' ? ' is-checker' : ''}`}>
          {src ? <video key={src} src={src} controls autoPlay playsInline data-testid="erf-video" /> : <p className="erf-note">This clip has no file to play.</p>}
        </div>
      </div>
    </div>
  );
}

function ClipCard({ clip, onPlay, onRemoveGreen, onMove, onDelete, busy }) {
  const [strength, setStrength] = useState(clip.key_strength || 'medium');
  const st = STATUS[clip.key_status] || STATUS.none;
  const meta = [clipLength(clip.duration_seconds), clipSize(clip.file_size_bytes), clip.width && clip.height ? `${clip.width}×${clip.height}` : null].filter(Boolean);
  const working = clip.key_status === 'queued' || clip.key_status === 'processing';
  return (
    <li className="erf-clip" data-testid="erf-clip">
      <button type="button" className="erf-thumb" onClick={() => onPlay(clip)} aria-label={`Play ${clip.label || 'clip'}`}>
        {clip.thumbnail_url ? <img src={clip.thumbnail_url} alt="" loading="lazy" /> : <Film size={28} aria-hidden />}
        <span className="erf-play"><Play size={16} aria-hidden /></span>
        {clipLength(clip.duration_seconds) && <span className="erf-len">{clipLength(clip.duration_seconds)}</span>}
      </button>
      <div className="erf-clip-body">
        <p className="erf-clip-name" title={clip.original_filename || ''}>{clip.label || clip.original_filename || 'Untitled clip'}</p>
        {clip.performer === 'guest' && clip.guest_name && <p className="erf-guest"><UserRound size={13} aria-hidden /> {clip.guest_name}</p>}
        {meta.length > 0 && <p className="erf-meta">{meta.join(' · ')}</p>}
        <span className={`erf-status ${st.tone}`} data-testid="erf-status">
          <st.Icon size={13} aria-hidden className={clip.key_status === 'processing' ? 'erf-spin' : undefined} /> {st.label}
        </span>
        {clip.key_status === 'failed' && clip.key_error && <p className="erf-error">{clip.key_error}</p>}
        <div className="erf-clip-actions">
          {!working && (
            <span className="erf-green">
              <select value={strength} onChange={(e) => setStrength(e.target.value)} aria-label="How much green to remove" disabled={busy}>
                {STRENGTHS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button type="button" className="erf-btn" onClick={() => onRemoveGreen(clip, strength)} disabled={busy}>
                {clip.key_status === 'none' ? <WandSparkles size={14} aria-hidden /> : <RefreshCw size={14} aria-hidden />}
                {clip.key_status === 'none' ? 'Remove green' : clip.key_status === 'failed' ? 'Retry' : 'Redo'}
              </button>
            </span>
          )}
          <select className="erf-move" value={clip.performer} onChange={(e) => onMove(clip, e.target.value)} aria-label="Who is in this clip" disabled={busy}>
            {PERFORMERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button type="button" className="erf-icon-btn is-danger" onClick={() => onDelete(clip)} aria-label={`Delete ${clip.label || 'clip'}`} disabled={busy}>
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

function Lane({ performer, clips, uploads, onFiles, busyId, ...handlers }) {
  const inputRef = useRef(null);
  const [green, setGreen] = useState(performer.greenByDefault);
  const [guestName, setGuestName] = useState('');
  const [over, setOver] = useState(false);
  const total = clips.reduce((n, c) => n + (Number(c.duration_seconds) || 0), 0);
  const send = (files) => {
    const list = [...(files || [])].filter((f) => (f.type || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i.test(f.name));
    if (list.length) onFiles(performer.key, list, { greenScreen: green, guestName: performer.key === 'guest' ? guestName.trim() : '' });
  };
  return (
    <section className={`erf-lane is-${performer.key}`} data-testid={`erf-lane-${performer.key}`} aria-label={`${performer.label} clips`}>
      <header className="erf-lane-head">
        <h3 className="erf-lane-title">{performer.label}</h3>
        <span className="erf-lane-count">{clips.length} {clips.length === 1 ? 'clip' : 'clips'}{total ? ` · ${clipLength(total)}` : ''}</span>
      </header>
      <div
        className={`erf-drop${over ? ' is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer?.files); }}
      >
        <Upload size={22} aria-hidden />
        <p className="erf-drop-text">Drop raw clips here</p>
        <button type="button" className="erf-btn is-primary" onClick={() => inputRef.current?.click()}>Choose clips</button>
        <input ref={inputRef} type="file" accept="video/*" multiple hidden data-testid={`erf-input-${performer.key}`}
          onChange={(e) => { send(e.target.files); e.target.value = ''; }} />
        {performer.key === 'guest' && (
          <input className="erf-guest-input" type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest's name (optional)" aria-label="Guest's name" />
        )}
        <label className="erf-check">
          <input type="checkbox" checked={green} onChange={(e) => setGreen(e.target.checked)} />
          Filmed on a green screen: remove the green
        </label>
      </div>
      {uploads.length > 0 && (
        <ul className="erf-uploads">
          {uploads.map((u) => (
            <li key={u.id} className={u.error ? 'is-failed' : ''}>
              <span className="erf-upload-name">{u.name}</span>
              {u.error ? <span className="erf-error">{u.error}</span> : (
                <span className="erf-bar" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}>
                  <span style={{ width: `${u.progress}%` }} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {clips.length === 0 && uploads.length === 0 ? <p className="erf-note">No {performer.label} clips yet.</p> : (
        <ul className="erf-clips">
          {clips.map((c) => <ClipCard key={c.id} clip={c} busy={busyId === c.id} {...handlers} />)}
        </ul>
      )}
    </section>
  );
}

export default function EpisodeRawFootageTab({ episode }) {
  const episodeId = episode?.id;
  const [clips, setClips] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      setClips(await rawClipsApi.list(episodeId));
      setError(null);
    } catch (err) {
      console.error('[RawFootage] load failed:', err);
      setError('Could not load the clips.');
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  // While a clip waits on green removal, check back every few seconds.
  useEffect(() => {
    if (!anyKeying(clips)) return undefined;
    const t = setTimeout(load, POLL_MS);
    return () => clearTimeout(t);
  }, [clips, load]);

  const onFiles = async (performer, files, opts) => {
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setUploads((u) => [...u, { id, performer, name: file.name, progress: 0, error: null }]);
      try {
        const row = await rawClipsApi.upload(episodeId, file, { performer, ...opts }, (p) => {
          setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x)));
        });
        if (row) setClips((c) => [...c, row]);
        setUploads((u) => u.filter((x) => x.id !== id));
      } catch (err) {
        console.error('[RawFootage] upload failed:', err);
        const message = err?.response?.status === 413 ? 'Too big to upload' : (err?.response?.data?.error || 'Upload failed');
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: message } : x)));
      }
    }
  };

  const act = async (clip, fn, failMessage) => {
    setBusyId(clip.id);
    try {
      const row = await fn();
      if (row) setClips((c) => c.map((x) => (x.id === clip.id ? { ...x, ...row } : x)));
      setError(null);
    } catch (err) {
      console.error('[RawFootage] action failed:', err);
      setError(err?.response?.data?.error || failMessage);
    } finally {
      setBusyId(null);
    }
  };

  const handlers = {
    onPlay: setPlaying,
    onRemoveGreen: (clip, strength) => act(clip, () => rawClipsApi.removeGreen(episodeId, clip.id, strength), 'Could not start removing the green.'),
    onMove: (clip, performer) => act(clip, () => rawClipsApi.update(episodeId, clip.id, { performer }), 'Could not move the clip.'),
    onDelete: async (clip) => {
      if (!window.confirm(`Delete "${clip.label || 'this clip'}" from the episode? The file stays in storage.`)) return;
      setBusyId(clip.id);
      try {
        await rawClipsApi.remove(episodeId, clip.id);
        setClips((c) => c.filter((x) => x.id !== clip.id));
      } catch (err) {
        console.error('[RawFootage] delete failed:', err);
        setError('Could not delete the clip.');
      } finally {
        setBusyId(null);
      }
    },
  };

  return (
    <div className="erf">
      <header className="erf-head">
        <div>
          <h2 className="erf-title">Raw footage</h2>
          <p className="erf-sub">The unedited clips for this episode. A green-screen clip gets a copy with the background removed; the original is always kept.</p>
        </div>
        <span className="erf-total">{clips.length} {clips.length === 1 ? 'clip' : 'clips'}</span>
      </header>
      {error && (
        <div className="erf-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="erf-icon-btn" onClick={() => setError(null)} aria-label="Dismiss"><X size={16} aria-hidden /></button>
        </div>
      )}
      {loading ? <p className="erf-note">Loading clips…</p> : (
        <div className="erf-lanes">
          {PERFORMERS.map((p) => (
            <Lane key={p.key} performer={p} busyId={busyId}
              clips={clips.filter((c) => c.performer === p.key)}
              uploads={uploads.filter((u) => u.performer === p.key)}
              onFiles={onFiles} {...handlers} />
          ))}
        </div>
      )}
      {playing && <ClipPlayer clip={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
