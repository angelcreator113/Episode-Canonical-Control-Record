/**
 * Files › Style photos (Evoni, 2026-10-22: "i dont want the uploads in the
 * style page move them to the files tab"): every photo the Style Page uses
 * is uploaded and kept here, one folder per spot (lib/stylePhotoFolders).
 * The Style Page only picks from Files. Photos upload to To sort, or straight
 * into a folder; each can be filed in another folder, filed as a character
 * pose (Lala · Front …), or deleted. A folder that holds one photo (Hero,
 * Front …) sends the photo it had back to To sort when another is filed there.
 *
 * Lighter cards (2026-10-22): the photo shows; "File as" and Delete are
 * behind "⋯" (CardMenu). An empty folder is a small "+ Hero" chip (AddChip);
 * To sort always shows in full.
 *
 * Data: the Lookbook routes (lib/lookbookApi); a folder is a photo's category.
 * Filing as a pose: POST /api/v1/episode-poses/:id/from-lookbook.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Trash2, X } from 'lucide-react';
import { lookbookApi } from '../../lib/lookbookApi';
import { CHARACTERS, POSES, PHOTO_ACCEPT, episodePosesApi } from '../../lib/episodePosesApi';
import { STYLE_FOLDERS, filesIn } from '../../lib/stylePhotoFolders';
import { AddChip, CardMenu } from './FileCardParts';
import './EpisodePosesPanel.css';
import './EpisodeStylePhotosPanel.css';

const LOOKBOOK_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';
// "File as": a folder, or a pose ("pose:lala:front").
const POSE_TARGETS = CHARACTERS.flatMap((c) => POSES.map((p) => ({ value: `pose:${c.key}:${p.key}`, label: `${c.label} · ${p.label}` })));

function Folder({ folder, photos, busy, onFiles, onFile, onDelete }) {
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
          <li key={p.id} className="epp-card is-light" data-testid={`esph-photo-${p.id}`}>
            <div className="epp-frame">
              <img src={p.image_url} alt={p.file_name || `${folder.label} photo`} loading="lazy" />
              <CardMenu>
                <label className="esph-file-as">
                  <span>File as</span>
                  <select value={folder.key} onChange={(e) => onFile(p, e.target.value)} aria-label="File as" disabled={busy}>
                    <optgroup label="Style photos">
                      {STYLE_FOLDERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </optgroup>
                    <optgroup label="Character poses">
                      {POSE_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </optgroup>
                  </select>
                </label>
                <button type="button" className="epp-menu-item is-danger" onClick={() => onDelete(p)} disabled={busy} aria-label="Delete this photo">
                  <Trash2 size={15} aria-hidden /> Delete
                </button>
              </CardMenu>
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

export default function EpisodeStylePhotosPanel({ episode, reloadKey = 0, onCount, onFiledAsPose }) {
  const episodeId = episode?.id;
  const [lb, setLb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

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
  // reloadKey: the Files tab's shared drop zone asks again after an upload.
  useEffect(() => { load(); }, [load, reloadKey]);

  const total = STYLE_FOLDERS.reduce((n, f) => n + filesIn(lb, f.key).length, 0);
  useEffect(() => { if (onCount && lb) onCount(total); }, [total, lb, onCount]);

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
  const onFile = (photo, target) => {
    if (target.startsWith('pose:')) {
      const [, characterKey, pose] = target.split(':');
      const label = POSE_TARGETS.find((t) => t.value === target)?.label || 'a pose';
      run(async () => {
        await episodePosesApi.fromLookbook(episodeId, photo.id, { characterKey, pose });
        setNote(`Filed as ${label} in Character poses. It is being processed there.`);
        if (onFiledAsPose) onFiledAsPose();
        return lookbookApi.get(episodeId);
      });
      return;
    }
    setNote(null);
    run(() => lookbookApi.move(episodeId, photo.id, { category: target }));
  };
  const onDelete = (photo) => {
    if (!window.confirm('Delete this photo? It comes off the Style Page too.')) return;
    run(() => lookbookApi.remove(episodeId, photo.id));
  };

  const shown = STYLE_FOLDERS.filter((f) => f.key === 'unsorted' || filesIn(lb, f.key).length);
  const empty = STYLE_FOLDERS.filter((f) => f.key !== 'unsorted' && !filesIn(lb, f.key).length);
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
      {note && <p className="epp-note" role="status" data-testid="esph-note">{note}</p>}
      {loading ? <p className="epp-empty">Loading photos…</p> : (
        <div className="esph-folders">
          {shown.map((f) => (
            <Folder key={f.key} folder={f} photos={filesIn(lb, f.key)} busy={busy} onFiles={onFiles} onFile={onFile} onDelete={onDelete} />
          ))}
          {empty.length > 0 && (
            <div className="epp-empty-row esph-empty" data-testid="esph-empty">
              <span className="epp-empty-label">Empty folders:</span>
              {empty.map((f) => (
                <AddChip key={f.key} label={f.label} accept={PHOTO_ACCEPT} multiple={!f.single} disabled={busy}
                  testId={`esph-${f.key}`} inputTestId={`esph-input-${f.key}`}
                  onFiles={(files) => { const list = [...(files || [])]; const good = list.filter((x) => LOOKBOOK_TYPES.includes(x.type)); onFiles(f, good, list.length - good.length); }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
