/**
 * Files › Style photos (Evoni, 2026-10-22: "i dont want the uploads in the
 * style page move them to the files tab"): every photo the Style Page uses
 * is uploaded and kept here, one folder per spot (lib/stylePhotoFolders).
 * The Style Page only picks from Files. Photos upload to To sort, or straight
 * into a folder; each can be moved to another folder or deleted. A folder
 * that holds one photo (Hero, Front …) sends the photo it had back to
 * To sort when another is filed there.
 *
 * Data: the Lookbook routes (lib/lookbookApi); a folder is a photo's category.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Trash2, X } from 'lucide-react';
import { lookbookApi } from '../../lib/lookbookApi';
import { PHOTO_ACCEPT } from '../../lib/episodePosesApi';
import { STYLE_FOLDERS, filesIn } from '../../lib/stylePhotoFolders';
import './EpisodePosesPanel.css';
import './EpisodeStylePhotosPanel.css';

const LOOKBOOK_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

function Folder({ folder, photos, busy, onFiles, onMove, onDelete }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const full = folder.max ? photos.length >= folder.max : false;
  const send = (files) => {
    const list = [...(files || [])];
    const good = list.filter((f) => LOOKBOOK_TYPES.includes(f.type));
    onFiles(folder, good, list.length - good.length);
  };
  return (
    <section className="epp-pose esph-folder" data-testid={`esph-${folder.key}`} aria-label={folder.label}>
      <header className="epp-pose-head">
        <h4 className="epp-pose-title">{folder.label}</h4>
        <span className="epp-pose-count">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}{folder.single ? ' · holds 1' : folder.max ? ` · up to ${folder.max}` : ''}
        </span>
      </header>
      <ul className="epp-strip">
        {photos.map((p) => (
          <li key={p.id} className="epp-card" data-testid={`esph-photo-${p.id}`}>
            <div className="epp-frame"><img src={p.image_url} alt={p.file_name || `${folder.label} photo`} loading="lazy" /></div>
            <div className="epp-actions">
              <select value={folder.key} onChange={(e) => onMove(p, e.target.value)} aria-label="Which folder" disabled={busy}>
                {STYLE_FOLDERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <button type="button" className="epp-icon-btn is-danger" onClick={() => onDelete(p)} disabled={busy} aria-label="Delete this photo" title="Delete">
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          </li>
        ))}
        {!full && (
          <li
            className={`epp-drop${over ? ' is-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer?.files); }}
          >
            <button type="button" className="epp-add" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload size={18} aria-hidden />
              <span>{folder.single && photos.length ? `Replace ${folder.label.toLowerCase()}` : `Add ${folder.label === 'To sort' ? 'photos' : folder.label.toLowerCase()}`}</span>
            </button>
            <input ref={inputRef} type="file" accept={PHOTO_ACCEPT} multiple={!folder.single} hidden data-testid={`esph-input-${folder.key}`}
              onChange={(e) => { send(e.target.files); e.target.value = ''; }} />
          </li>
        )}
      </ul>
      {folder.hint && <p className="epp-note">{folder.hint}</p>}
    </section>
  );
}

export default function EpisodeStylePhotosPanel({ episode }) {
  const episodeId = episode?.id;
  const [lb, setLb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      setLb(await lookbookApi.get(episodeId));
      setError(null);
    } catch (err) {
      console.error('[StylePhotos] load failed:', err);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [episodeId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next && next.images) setLb(next);
      setError(null);
    } catch (err) {
      console.error('[StylePhotos] save failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const onFiles = (folder, files, skipped) => {
    if (skipped) setError(`${skipped === 1 ? 'One file was' : `${skipped} files were`} skipped: use PNG, JPEG or WebP photos.`);
    if (!files.length) return;
    const room = folder.single ? 1 : folder.max ? folder.max - filesIn(lb, folder.key).length : files.length;
    const category = folder.key === 'unsorted' ? undefined : folder.key;
    run(() => lookbookApi.upload(episodeId, files.slice(0, Math.max(0, room)), category));
  };
  const onMove = (photo, key) => run(() => lookbookApi.move(episodeId, photo.id, { category: key }));
  const onDelete = (photo) => {
    if (!window.confirm('Delete this photo? It comes off the Style Page too.')) return;
    run(() => lookbookApi.remove(episodeId, photo.id));
  };

  const total = STYLE_FOLDERS.reduce((n, f) => n + filesIn(lb, f.key).length, 0);
  return (
    <div className="epp esph" data-testid="esph">
      <header className="epp-head">
        <div>
          <h2 className="epp-title">Style photos</h2>
          <p className="epp-sub">The photos for the Style Page, one folder per spot. Upload them here; on the Style Page, tap a spot and choose from Files. A folder that holds one photo sends the one it had back to To sort.</p>
        </div>
        <span className="epp-total">{total} {total === 1 ? 'photo' : 'photos'}</span>
      </header>
      {error && (
        <div className="epp-alert" role="alert">
          <span>{error}</span>
          <button type="button" className="epp-icon-btn" onClick={() => setError(null)} aria-label="Dismiss"><X size={16} aria-hidden /></button>
        </div>
      )}
      {loading ? <p className="epp-empty">Loading photos…</p> : (
        <div className="esph-folders">
          {STYLE_FOLDERS.map((f) => (
            <Folder key={f.key} folder={f} photos={filesIn(lb, f.key)} busy={busy} onFiles={onFiles} onMove={onMove} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
