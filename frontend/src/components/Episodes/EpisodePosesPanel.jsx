/**
 * Files › Character poses (Evoni, 2026-10-20): photos of Lala and
 * JustAWoman for this episode, labelled Front, Back, Side or Glamour. Drop
 * photos on a pose to upload them. Each one is enhanced (colour and light,
 * upscaled when small) and has its background removed on the server, in the
 * background; the original is always kept. A pose can hold several photos:
 * the starred one is its default, the one the thumbnail editor picks first.
 * Each photo shows before and after, can be starred, moved to another pose,
 * processed again, or deleted.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, Star, Trash2, RefreshCw, X, Loader, CircleCheck, CircleAlert, Clock, ImageOff,
} from 'lucide-react';
import {
  episodePosesApi, CHARACTERS, POSES, PHOTO_ACCEPT, isPhoto, anyProcessing, photosFor, stepsNote,
} from '../../lib/episodePosesApi';
import './EpisodePosesPanel.css';

const POLL_MS = 3000;

const STATUS = {
  queued: { label: 'Waiting', Icon: Clock, tone: 'is-wait' },
  processing: { label: 'Removing background…', Icon: Loader, tone: 'is-wait' },
  ready: { label: 'Ready', Icon: CircleCheck, tone: 'is-done' },
  failed: { label: "Couldn't finish", Icon: CircleAlert, tone: 'is-failed' },
};

function PhotoCard({ photo, onStar, onMove, onReprocess, onDelete, busy }) {
  const ready = photo.status === 'ready' && photo.final_url;
  const [view, setView] = useState('after');
  const showAfter = ready && view === 'after';
  const src = showAfter ? photo.final_url : (photo.enhanced_url || photo.original_url);
  const st = STATUS[photo.status] || STATUS.queued;
  const working = photo.status === 'queued' || photo.status === 'processing';
  const note = stepsNote(photo.steps);
  const name = photo.original_filename || 'photo';
  return (
    <li className={`epp-card${photo.is_default ? ' is-default' : ''}`} data-testid={`epp-photo-${photo.id}`}>
      <div className={`epp-frame${showAfter ? ' is-checker' : ''}`}>
        {src ? <img src={src} alt={showAfter ? `${name}, background removed` : name} loading="lazy" /> : <ImageOff size={24} aria-hidden />}
        <button type="button" className={`epp-star${photo.is_default ? ' is-on' : ''}`} onClick={() => !photo.is_default && onStar(photo)}
          aria-pressed={photo.is_default} disabled={busy}
          aria-label={photo.is_default ? 'The default for this pose' : 'Make this the default for this pose'}
          title={photo.is_default ? 'Default for this pose' : 'Make default'}>
          <Star size={15} aria-hidden />
        </button>
      </div>
      {ready && (
        <div className="epp-toggle" role="group" aria-label="Which version">
          <button type="button" className={view === 'before' ? 'is-on' : ''} aria-pressed={view === 'before'} onClick={() => setView('before')}>Before</button>
          <button type="button" className={view === 'after' ? 'is-on' : ''} aria-pressed={view === 'after'} onClick={() => setView('after')}>After</button>
        </div>
      )}
      <span className={`epp-status ${st.tone}`} data-testid="epp-status">
        <st.Icon size={12} aria-hidden className={photo.status === 'processing' ? 'epp-spin' : undefined} /> {st.label}
      </span>
      {photo.status === 'failed' && photo.error && <p className="epp-error">{photo.error}</p>}
      {note && <p className="epp-note">{note}</p>}
      <div className="epp-actions">
        <select value={photo.pose} onChange={(e) => onMove(photo, e.target.value)} aria-label="Which pose this is" disabled={busy || working}>
          {POSES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {!working && (
          <button type="button" className="epp-icon-btn" onClick={() => onReprocess(photo)} disabled={busy}
            aria-label={photo.status === 'failed' ? 'Retry' : 'Process again'} title={photo.status === 'failed' ? 'Retry' : 'Process again'}>
            <RefreshCw size={15} aria-hidden />
          </button>
        )}
        <button type="button" className="epp-icon-btn is-danger" onClick={() => onDelete(photo)} disabled={busy} aria-label="Delete this photo" title="Delete">
          <Trash2 size={15} aria-hidden />
        </button>
      </div>
    </li>
  );
}

function PoseRow({ character, pose, photos, uploads, onFiles, busyId, ...handlers }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const send = (files) => {
    const list = [...(files || [])];
    const good = list.filter(isPhoto);
    onFiles(character.key, pose.key, good, list.length - good.length);
  };
  return (
    <section className="epp-pose" data-testid={`epp-${character.key}-${pose.key}`} aria-label={`${character.label}, ${pose.label}`}>
      <header className="epp-pose-head">
        <h4 className="epp-pose-title">{pose.label}</h4>
        <span className="epp-pose-count">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
      </header>
      <ul className="epp-strip">
        {photos.map((p) => <PhotoCard key={p.id} photo={p} busy={busyId === p.id} {...handlers} />)}
        {uploads.map((u) => (
          <li key={u.id} className={`epp-card is-uploading${u.error ? ' is-failed' : ''}`}>
            <span className="epp-upload-name">{u.name}</span>
            {u.error ? <span className="epp-error">{u.error}</span> : (
              <span className="epp-bar" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}>
                <span style={{ width: `${u.progress}%` }} />
              </span>
            )}
          </li>
        ))}
        <li
          className={`epp-drop${over ? ' is-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer?.files); }}
        >
          <button type="button" className="epp-add" onClick={() => inputRef.current?.click()}>
            <Upload size={18} aria-hidden />
            <span>Add {pose.label.toLowerCase()} photos</span>
          </button>
          <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} multiple hidden data-testid={`epp-input-${character.key}-${pose.key}`}
            onChange={(e) => { send(e.target.files); e.target.value = ''; }} />
        </li>
      </ul>
    </section>
  );
}

export default function EpisodePosesPanel({ episode }) {
  const episodeId = episode?.id;
  const [photos, setPhotos] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      setPhotos(await episodePosesApi.list(episodeId));
      setError(null);
    } catch (err) {
      console.error('[Poses] load failed:', err);
      setError('Could not load the photos.');
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { load(); }, [load]);

  // While a photo is being processed, check back every few seconds.
  useEffect(() => {
    if (!anyProcessing(photos)) return undefined;
    const t = setTimeout(load, POLL_MS);
    return () => clearTimeout(t);
  }, [photos, load]);

  const onFiles = async (characterKey, pose, files, skipped) => {
    if (skipped) setError(`${skipped === 1 ? 'One file was' : `${skipped} files were`} skipped: use JPG, PNG or WebP photos.`);
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setUploads((u) => [...u, { id, characterKey, pose, name: file.name, progress: 0, error: null }]);
      try {
        const row = await episodePosesApi.upload(episodeId, file, { characterKey, pose }, (p) => {
          setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x)));
        });
        if (row) setPhotos((list) => [...list, row]);
        setUploads((u) => u.filter((x) => x.id !== id));
      } catch (err) {
        console.error('[Poses] upload failed:', err);
        const message = err?.response?.status === 413 ? 'Too big to upload (25 MB at most)' : (err?.response?.data?.error || 'Upload failed');
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: message } : x)));
      }
    }
  };

  // Starring and moving change other photos too (one default per pose), so they reload the list.
  const act = async (photo, fn, failMessage, { reload = false } = {}) => {
    setBusyId(photo.id);
    try {
      const row = await fn();
      if (reload) await load();
      else if (row) setPhotos((list) => list.map((x) => (x.id === photo.id ? { ...x, ...row } : x)));
      setError(null);
    } catch (err) {
      console.error('[Poses] action failed:', err);
      setError(err?.response?.data?.error || failMessage);
    } finally {
      setBusyId(null);
    }
  };

  const handlers = {
    onStar: (photo) => act(photo, () => episodePosesApi.update(episodeId, photo.id, { is_default: true }), 'Could not make it the default.', { reload: true }),
    onMove: (photo, pose) => act(photo, () => episodePosesApi.update(episodeId, photo.id, { pose }), 'Could not move the photo.', { reload: true }),
    onReprocess: (photo) => act(photo, () => episodePosesApi.reprocess(episodeId, photo.id), 'Could not start processing the photo again.'),
    onDelete: async (photo) => {
      if (!window.confirm('Delete this photo from the episode? The file stays in storage.')) return;
      setBusyId(photo.id);
      try {
        await episodePosesApi.remove(episodeId, photo.id);
        setPhotos((list) => list.filter((x) => x.id !== photo.id));
      } catch (err) {
        console.error('[Poses] delete failed:', err);
        setError('Could not delete the photo.');
      } finally {
        setBusyId(null);
      }
    },
  };

  return (
    <div className="epp" data-testid="epp">
      <header className="epp-head">
        <div>
          <h2 className="epp-title">Character poses</h2>
          <p className="epp-sub">Photos of Lala and JustAWoman for this episode. Each one is enhanced and has its background removed; the original is always kept. The starred photo of a pose is the one the thumbnail editor picks first.</p>
        </div>
        <span className="epp-total">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
      </header>
      {error && (
        <div className="epp-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="epp-icon-btn" onClick={() => setError(null)} aria-label="Dismiss"><X size={16} aria-hidden /></button>
        </div>
      )}
      {loading ? <p className="epp-empty">Loading photos…</p> : (
        <div className="epp-columns">
          {CHARACTERS.map((c) => (
            <section key={c.key} className={`epp-character is-${c.key}`} data-testid={`epp-character-${c.key}`} aria-label={`${c.label} poses`}>
              <h3 className="epp-character-title">{c.label}</h3>
              {POSES.map((p) => (
                <PoseRow key={p.key} character={c} pose={p} busyId={busyId} onFiles={onFiles}
                  photos={photosFor(photos, c.key, p.key)}
                  uploads={uploads.filter((u) => u.characterKey === c.key && u.pose === p.key)}
                  {...handlers} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
