/**
 * Assets → Files: the episode's raw, unedited video clips (Evoni,
 * 2026-10-17), in three lanes by who is on camera: Lala, JustAWoman and
 * Guest. Drop clips on a lane to upload them. A clip filmed on a green
 * screen gets a cut-out with the green removed, made on the server in the
 * background (on by default for Lala); the original is always kept. Each
 * clip plays as the original or the cut-out, can redo the green removal at
 * another strength, be linked to a scene (Production plays it there), move
 * to another lane, or be deleted.
 *
 * Where a clip starts and ends (Evoni, 2026-10-28): a full-episode take
 * with beat markers says which beats it covers and where it ended ("Beats
 * 10 → 14 · ended in beat 14 · Cliffhanger"); any other clip linked to a
 * scene gets an "Ends on" picker beside it, so a card reads "Beat 1 → Beat
 * 11" (end_beat_number; until its database update runs, choosing one says
 * so plainly). Two clips of the same person covering the same beats each
 * say so ("Overlaps Full episode · take 1 on beats 10–11"). Every upload is
 * measured in the browser first (rawClipsApi.upload, lib/videoProbe), so a
 * phone video shows its length, size and picture.
 *
 * The beats a clip covers, asked when it is uploaded (Evoni, 2026-10-30;
 * Voice plan V1): each lane's drop area has "Starts in" and "Ends in", sent
 * with every clip dropped there (rawClipsApi.upload: beat_number,
 * end_beat_number). Both can be left unset and changed on the card later.
 * When the server can't keep the end beat yet (its database update hasn't
 * run), the clip is still saved and the lane says so.
 */
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Upload, Film, Trash2, Play, Square, WandSparkles, X, Loader, CircleCheck, CircleAlert, Clock, RefreshCw, UserRound, ListOrdered, Copy, Layers, MoveRight,
} from 'lucide-react';
import { rawClipsApi, abortUpload, PERFORMERS, STRENGTHS, clipLength, clipSize, anyKeying, keyingProgress, sceneChoices, uploadErrorMessage, uploadBeats, uploadEndChoices, endBeatNotKept } from '../../lib/rawClipsApi';
import { isCancelled } from '../../lib/chunkedUpload';
import { fileSignature, keepUpload, unfinishedUploads, sentPercent } from '../../lib/uploadResume';
import useWakeLock from '../../hooks/useWakeLock';
import { clipMarks } from '../../lib/assembleTakes';
import { clipRange, rangeText, rangeOverlaps, overlapText, beatNames } from '../../lib/clipRange';
import { youtubeChapters, draftDescription } from '../../lib/youtubeChapters';
import { copyText } from './ScriptReadActions';
import { voiceFootageApi, voiceLane, voiceLine } from '../../lib/voiceFootageApi';
import AuthContext from '../../contexts/AuthContext';
import { isAdmin } from '../../utils/authGroups';
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

// A copyable block: its text in a read-only box and a Copy button.
function CopyBlock({ label, text, testId }) {
  const [said, setSaid] = useState(null);
  const copy = async () => {
    const ok = await copyText(text);
    setSaid(ok ? 'Copied' : 'Could not copy. Select the text and copy it instead.');
    setTimeout(() => setSaid(null), 2500);
  };
  return (
    <div className="erf-copy" data-testid={testId}>
      <div className="erf-copy-head">
        <h4 className="erf-copy-title">{label}</h4>
        <button type="button" className="erf-btn" onClick={copy} disabled={!text} data-testid={`${testId}-copy`}><Copy size={14} aria-hidden /> Copy</button>
      </div>
      <textarea className="erf-copy-text" readOnly value={text} rows={Math.min(14, Math.max(3, text.split('\n').length))} aria-label={label} onFocus={(e) => e.target.select()} />
      {said && <p className="erf-copy-said" role="status">{said}</p>}
    </div>
  );
}

// YouTube chapters for a whole-episode take, from its beat markers, and a
// draft description to paste under the video (lib/youtubeChapters).
function ChaptersSheet({ clip, episode, names, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const ch = youtubeChapters(clipMarks(clip), { names, duration: clip.duration_seconds });
  const description = draftDescription({ title: episode?.title, synopsis: episode?.description || episode?.logline, chapters: ch });
  return (
    <div className="erf-modal" role="dialog" aria-modal="true" aria-label="YouTube chapters" onClick={onClose}>
      <div className="erf-modal-card erf-chapters" onClick={(e) => e.stopPropagation()} data-testid="erf-chapters">
        <div className="erf-modal-head">
          <h3 className="erf-modal-title">YouTube chapters · {clip.label || 'Full episode'}</h3>
          <button type="button" className="erf-icon-btn" onClick={onClose} aria-label="Close"><X size={18} aria-hidden /></button>
        </div>
        <p className="erf-sub">Made from where each beat started in this take. Paste them into the video’s description on YouTube; the times only line up if the video is this take, uncut.</p>
        {ch.notes.length > 0 && (
          <ul className={`erf-chapter-notes${ch.ok ? '' : ' is-warn'}`} data-testid="erf-chapter-notes">
            {ch.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
        <div className="erf-copies">
          <CopyBlock label="Chapters" text={ch.text} testId="erf-chapters-list" />
          <CopyBlock label="Draft description" text={description} testId="erf-chapters-description" />
        </div>
      </div>
    </div>
  );
}

// The voice line's icon by tone (words carry the meaning; the icon only echoes it).
const VOICE_ICON = { none: Clock, wait: Clock, busy: Loader, ok: CircleCheck, bad: CircleAlert };

/**
 * Voice from footage (V2), on a Lala clip's card, for admins only while it
 * is switched on: where the clip's voice is, and Prepare Voice when it has
 * none yet (footage from before V2, such as 4481.mp4) or after a failure.
 */
function VoiceLine({ clip, job, onPrepareVoice, busy }) {
  const line = voiceLine(job);
  const Icon = VOICE_ICON[line.tone] || Clock;
  return (
    <div className={`erf-voice is-${line.tone}`} data-testid="erf-voice">
      <span className="erf-voice-text"><Icon size={13} aria-hidden className={line.tone === 'busy' ? 'erf-spin' : undefined} /> {line.text}</span>
      {line.canPrepare && (
        <button type="button" className="erf-btn" onClick={() => onPrepareVoice(clip)} disabled={busy} data-testid="erf-prepare-voice">
          <WandSparkles size={14} aria-hidden /> Prepare Voice
        </button>
      )}
    </div>
  );
}

function ClipCard({ clip, scenes, names, overlaps = [], onPlay, onChapters, onRemoveGreen, onStopGreen, onMove, onLink, onEndBeat, onDelete, busy, voice = null, onPrepareVoice }) {
  const [strength, setStrength] = useState(clip.key_strength || 'medium');
  const st = STATUS[clip.key_status] || STATUS.none;
  const keying = keyingProgress(clip);
  const meta = [clipLength(clip.duration_seconds), clipSize(clip.file_size_bytes), clip.width && clip.height ? `${clip.width}×${clip.height}` : null].filter(Boolean);
  const working = clip.key_status === 'queued' || clip.key_status === 'processing';
  // A full-episode take with markers says its beats itself; any other clip
  // linked to a beat can say which beat it ends on.
  const byMarks = clipRange(clip)?.source === 'marks';
  const hasMarks = byMarks && clipMarks(clip).length > 0;
  const range = rangeText(clip, names);
  const start = clip.beat_number == null || clip.beat_number === '' ? null : Number(clip.beat_number);
  const endChoices = start != null && !byMarks ? scenes.filter((sc) => sc.value > start) : [];
  const end = Number(clip.end_beat_number) > start ? Number(clip.end_beat_number) : '';
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
        {range && <p className="erf-range" data-testid="erf-range"><MoveRight size={13} aria-hidden /> {range}</p>}
        {overlaps.map((o) => (
          <p key={o.clip.id} className="erf-overlap" data-testid="erf-overlap"><Layers size={13} aria-hidden /> {overlapText(o)}</p>
        ))}
        <span className={`erf-status ${st.tone}`} data-testid="erf-status">
          <st.Icon size={13} aria-hidden className={clip.key_status === 'processing' ? 'erf-spin' : undefined} /> {st.label}
        </span>
        {keying && (
          <div className="erf-progress" data-testid="erf-progress">
            {keying.percent != null && <progress className="erf-progress-bar" max="100" value={keying.percent} aria-label="Green removal progress" />}
            <span>{keying.text}</span>
          </div>
        )}
        {clip.key_status === 'failed' && clip.key_error && <p className="erf-error">{clip.key_error}</p>}
        {voice && voiceLane(clip.performer) && <VoiceLine clip={clip} job={voice[clip.id]} onPrepareVoice={onPrepareVoice} busy={busy} />}
        <div className="erf-clip-actions">
          {hasMarks && (
            <button type="button" className="erf-btn" onClick={() => onChapters(clip)} data-testid="erf-chapters-open" title="Chapters and a draft description for YouTube, from this take's beat markers">
              <ListOrdered size={14} aria-hidden /> YouTube chapters
            </button>
          )}
          {working && (
            <button type="button" className="erf-btn" onClick={() => onStopGreen(clip)} disabled={busy} data-testid="erf-stop-green">
              <Square size={14} aria-hidden /> Stop
            </button>
          )}
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
          <select className="erf-scene" value={clip.beat_number ?? ''} onChange={(e) => onLink(clip, e.target.value === '' ? null : Number(e.target.value))} aria-label="Which scene this clip is for" disabled={busy}>
            <option value="">No scene yet</option>
            {scenes.map((sc) => <option key={sc.value} value={sc.value}>{sc.label}</option>)}
          </select>
          {endChoices.length > 0 && (
            <select className="erf-scene erf-end" value={end} onChange={(e) => onEndBeat(clip, e.target.value === '' ? null : Number(e.target.value))}
              aria-label="Which beat this clip ends on" disabled={busy} data-testid="erf-end-beat">
              <option value="">Ends in the same beat</option>
              {endChoices.map((sc) => <option key={sc.value} value={sc.value}>Ends on {sc.label}</option>)}
            </select>
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

function Lane({ performer, clips, uploads, onFiles, onResume, onCancel, busyId, scenes, names, overlaps, ...handlers }) {
  const inputRef = useRef(null);
  const [green, setGreen] = useState(performer.greenByDefault);
  const [guestName, setGuestName] = useState('');
  const [over, setOver] = useState(false);
  // The beats the next clips cover: '' (not set) or a beat number.
  const [startBeat, setStartBeat] = useState('');
  const [endBeat, setEndBeat] = useState('');
  const endChoices = uploadEndChoices(scenes, startBeat);
  const total = clips.reduce((n, c) => n + (Number(c.duration_seconds) || 0), 0);
  const send = (files) => {
    const list = [...(files || [])].filter((f) => (f.type || '').startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i.test(f.name));
    if (list.length) {
      onFiles(performer.key, list, {
        greenScreen: green, guestName: performer.key === 'guest' ? guestName.trim() : '', ...uploadBeats(startBeat, endBeat),
      });
    }
  };
  const chooseStart = (value) => {
    setStartBeat(value);
    // An end before the new start no longer makes sense.
    if (value === '' || (endBeat !== '' && Number(endBeat) <= Number(value))) setEndBeat('');
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
        <div className="erf-upload-beats" role="group" aria-label={`Beats the next ${performer.label} clips cover`} data-testid={`erf-upload-beats-${performer.key}`}>
          <label className="erf-upload-beat">
            <span>Starts in</span>
            <select value={startBeat} onChange={(e) => chooseStart(e.target.value)} data-testid={`erf-upload-start-${performer.key}`}>
              <option value="">Not set yet</option>
              {scenes.map((sc) => <option key={sc.value} value={sc.value}>{sc.label}</option>)}
            </select>
          </label>
          <label className="erf-upload-beat">
            <span>Ends in</span>
            <select value={endBeat} onChange={(e) => setEndBeat(e.target.value)} disabled={startBeat === ''} data-testid={`erf-upload-end-${performer.key}`}>
              <option value="">{startBeat === '' ? 'Pick where it starts' : 'The same beat'}</option>
              {endChoices.map((sc) => <option key={sc.value} value={sc.value}>{sc.label}</option>)}
            </select>
          </label>
        </div>
      </div>
      {uploads.length > 0 && (
        <ul className="erf-uploads">
          {uploads.map((u) => (
            <li key={u.id} className={u.error ? 'is-failed' : ''} data-testid="erf-upload">
              <span className="erf-upload-name">{u.name}{u.resumed && !u.error ? ' · carrying on' : ''}</span>
              {u.error ? <span className="erf-error">{u.error}{u.canResume ? ` ${u.progress}% is already sent.` : ''}</span> : (
                <span className="erf-bar" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}>
                  <span style={{ width: `${u.progress}%` }} />
                </span>
              )}
              <span className="erf-upload-actions">
                {u.error && u.canResume && (
                  <button type="button" className="erf-btn is-primary" onClick={() => onResume(u.id)} data-testid="erf-upload-resume">
                    <RefreshCw size={14} aria-hidden /> Resume
                  </button>
                )}
                <button type="button" className="erf-btn" onClick={() => onCancel(u.id)} data-testid="erf-upload-cancel">
                  <X size={14} aria-hidden /> {u.error ? 'Dismiss' : 'Cancel'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {clips.length === 0 && uploads.length === 0 ? <p className="erf-note">No {performer.label} clips yet.</p> : (
        <ul className="erf-clips">
          {clips.map((c) => <ClipCard key={c.id} clip={c} scenes={scenes} names={names} overlaps={overlaps.get(c.id) || []} busy={busyId === c.id} {...handlers} />)}
        </ul>
      )}
    </section>
  );
}

export default function EpisodeRawFootageTab({ episode, onCount }) {
  const episodeId = episode?.id;
  const [clips, setClips] = useState([]);
  // The Files tab shows how many clips there are on its Footage tab.
  useEffect(() => { if (onCount) onCount(clips.length); }, [clips.length, onCount]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [chapters, setChapters] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [beats, setBeats] = useState([]);
  // Voice from footage (V2): each clip's latest voice job, for admins while it is on; null otherwise.
  const admin = isAdmin(useContext(AuthContext)?.user);
  const [voice, setVoice] = useState(null);

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

  const loadVoice = useCallback(async () => {
    if (!episodeId || !admin) { setVoice(null); return; }
    try {
      setVoice(await voiceFootageApi.status(episodeId));
    } catch (err) {
      console.error('[RawFootage] voice status not read:', err);
    }
  }, [episodeId, admin]);
  useEffect(() => { loadVoice(); }, [loadVoice]);
  // While a clip's voice is queued or being prepared, check back every few seconds.
  useEffect(() => {
    if (!voice || !Object.values(voice).some((j) => j.status === 'queued' || j.status === 'running')) return undefined;
    const t = setTimeout(loadVoice, POLL_MS);
    return () => clearTimeout(t);
  }, [voice, loadVoice]);

  // The scene names for the Scene picker; without them it offers Beats 1-14.
  useEffect(() => {
    if (!episodeId) return undefined;
    let live = true;
    rawClipsApi.beats(episodeId)
      .then((b) => { if (live) setBeats(b); })
      .catch((err) => console.error('[RawFootage] could not load the scenes:', err));
    return () => { live = false; };
  }, [episodeId]);
  const scenes = sceneChoices(beats);
  const names = beatNames(beats);
  const overlaps = rangeOverlaps(clips);

  // While a clip waits on green removal, check back every few seconds.
  useEffect(() => {
    if (!anyKeying(clips)) return undefined;
    const t = setTimeout(load, POLL_MS);
    return () => clearTimeout(t);
  }, [clips, load]);

  // Uploads that did not finish, kept on this device (a reload, a dropped
  // connection; Evoni, 2026-10-31): choosing the same file again carries on.
  const [unfinished, setUnfinished] = useState([]);
  useEffect(() => { if (episodeId) setUnfinished(unfinishedUploads(episodeId)); }, [episodeId]);
  // Per upload: its file, fields, what was sent, and how to stop it.
  const running = useRef(new Map());
  const uploading = uploads.some((u) => !u.error);
  // Keep the screen on while uploading (a locked phone pauses the page),
  // and ask before leaving the page.
  useWakeLock(uploading);
  useEffect(() => {
    if (!uploading) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  const patchUpload = (id, patch) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const runUpload = async (id) => {
    const job = running.current.get(id);
    if (!job) return;
    const controller = new AbortController();
    job.controller = controller;
    patchUpload(id, { error: null, canResume: false, progress: job.state ? sentPercent(job.state) : 0 });
    try {
      const row = await rawClipsApi.upload(episodeId, job.file, { performer: job.performer, ...job.opts }, (p) => patchUpload(id, { progress: p }), {
        resume: job.state,
        signal: controller.signal,
        onState: (st) => {
          job.state = st;
          keepUpload(episodeId, job.signature, st ? { name: job.file.name, performer: job.performer, state: st } : null);
        },
      });
      running.current.delete(id);
      keepUpload(episodeId, job.signature, null);
      setUnfinished((list) => list.filter((e) => e.signature !== job.signature));
      if (row) setClips((c) => [...c, row]);
      setUploads((u) => u.filter((x) => x.id !== id));
      if (endBeatNotKept(row, job.opts)) setError(`${job.file.name} is saved, but the beat it ends on wasn't kept: the database update that adds it (20261028120000) hasn't run yet. You can set it on the clip once it has.`);
    } catch (err) {
      if (isCancelled(err)) return; // Cancel has already tidied up.
      console.error('[RawFootage] upload failed:', err);
      if (err?.resume) job.state = err.resume;
      const message = err?.response?.status === 413 ? 'Too big to upload' : uploadErrorMessage(err);
      // How much is really kept on the server: the parts sent, not the last part's bar.
      patchUpload(id, { error: message, canResume: Boolean(job.state?.uploadId), progress: job.state ? sentPercent(job.state) : 0 });
    }
  };

  const onFiles = async (performer, files, opts) => {
    for (const file of files) {
      // The same file (name and size) already in this lane: ask first.
      const twin = clips.find((c) => c.performer === performer && c.original_filename === file.name && Number(c.file_size_bytes) === file.size);
      if (twin && !window.confirm(`"${file.name}" is already in this lane (same name and size). Upload it again?`)) continue;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const signature = fileSignature(file);
      const saved = unfinished.find((e) => e.signature === signature);
      running.current.set(id, { file, performer, opts, signature, state: saved?.state || null });
      setUploads((u) => [...u, { id, performer, name: file.name, progress: saved ? sentPercent(saved.state) : 0, error: null, resumed: Boolean(saved) }]);
      // eslint-disable-next-line no-await-in-loop
      await runUpload(id);
    }
  };

  const onResume = (id) => runUpload(id);

  const onCancel = (id) => {
    const job = running.current.get(id);
    running.current.delete(id);
    setUploads((u) => u.filter((x) => x.id !== id));
    if (!job) return;
    job.controller?.abort();
    keepUpload(episodeId, job.signature, null);
    setUnfinished((list) => list.filter((e) => e.signature !== job.signature));
    if (job.state?.uploadId) abortUpload(episodeId, job.state.uploadId);
  };

  const onForget = (entry) => {
    keepUpload(episodeId, entry.signature, null);
    setUnfinished((list) => list.filter((e) => e.signature !== entry.signature));
    abortUpload(episodeId, entry.state?.uploadId);
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
    voice,
    onPrepareVoice: (clip) => act(clip, async () => {
      const job = await voiceFootageApi.prepare(episodeId, clip.id);
      if (job) setVoice((v) => ({ ...(v || {}), [clip.id]: job }));
      return null;
    }, "Could not start preparing the clip's voice."),
    onPlay: setPlaying,
    onChapters: setChapters,
    onRemoveGreen: (clip, strength) => act(clip, () => rawClipsApi.removeGreen(episodeId, clip.id, strength), 'Could not start removing the green.'),
    onStopGreen: (clip) => {
      if (!window.confirm(`Stop removing the green from "${clip.label || 'this clip'}"? The original stays as it is, and you can press Retry later.`)) return undefined;
      return act(clip, () => rawClipsApi.stopGreen(episodeId, clip.id), 'Could not stop removing the green.');
    },
    onMove: (clip, performer) => act(clip, () => rawClipsApi.update(episodeId, clip.id, { performer }), 'Could not move the clip.'),
    onLink: (clip, beatNumber) => act(clip, () => rawClipsApi.update(episodeId, clip.id, { beat_number: beatNumber }), 'Could not link the clip to the scene.'),
    // The server says plainly when its database update for this hasn't run yet (409).
    onEndBeat: (clip, endBeat) => act(clip, () => rawClipsApi.update(episodeId, clip.id, { end_beat_number: endBeat }), 'Could not save the beat the clip ends on.'),
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
      {unfinished.filter((e) => !uploads.some((u) => !u.error && running.current.get(u.id)?.signature === e.signature)).map((e) => (
        <div key={e.signature} className="erf-alert erf-unfinished" role="status" data-testid="erf-unfinished">
          <span>
            <strong>{e.name}</strong> didn&apos;t finish uploading ({sentPercent(e.state)}% sent). Choose the same file again in its lane to carry on from there.
          </span>
          <button type="button" className="erf-btn" onClick={() => onForget(e)} data-testid="erf-unfinished-forget">Forget it</button>
        </div>
      ))}
      {loading ? <p className="erf-note">Loading clips…</p> : (
        <div className="erf-lanes">
          {PERFORMERS.map((p) => (
            <Lane key={p.key} performer={p} busyId={busyId} scenes={scenes} names={names} overlaps={overlaps}
              clips={clips.filter((c) => c.performer === p.key)}
              uploads={uploads.filter((u) => u.performer === p.key)}
              onFiles={onFiles} onResume={onResume} onCancel={onCancel} {...handlers} />
          ))}
        </div>
      )}
      {playing && <ClipPlayer clip={playing} onClose={() => setPlaying(null)} />}
      {chapters && (
        <ChaptersSheet clip={chapters} episode={episode} onClose={() => setChapters(null)}
          names={Object.fromEntries(beats.filter((b) => b.beat_name).map((b) => [Number(b.beat_number), b.beat_name]))} />
      )}
    </div>
  );
}
