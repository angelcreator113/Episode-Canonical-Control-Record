// frontend/src/components/Teleprompter/PhoneRecorder.jsx
// "Record on this phone" (Rig mode; Evoni, 2026-10-28): she reads off a
// beam-splitter teleprompter, the device under the glass can't film her, so
// the phone behind the glass records. Its camera (the back one by default:
// the phone faces her through the glass; switchable), a small preview, and
// Record / Pause / Stop. Record also starts the prompter (phone_take_start:
// it counts 3-2-1 and scrolls), Stop stops both; when the prompter reaches
// the end of the script it stops, and so does the take here. The beat
// markers of a whole-episode take come from the prompter's state (its beat),
// placed as early as the state's age and the connection allow. The take is
// kept on this phone as it records (lib/takeStore), its parts go up while it
// records (hooks/useLiveUpload), and it is saved to the episode's Files with
// the name, number, performer and start line the prompter sent: as the
// prompter's own takes are. Saving needs this phone to be signed in; without
// that the take can be downloaded.

import { useEffect, useRef, useState } from 'react';
import { Circle, Square, Pause, Play, SwitchCamera, Upload, Download, Trash2, AlertTriangle, CheckCircle2, History, LogIn } from 'lucide-react';
import useTakeRecorder from '../../hooks/useTakeRecorder';
import useWakeLock from '../../hooks/useWakeLock';
import useLiveUpload from '../../hooks/useLiveUpload';
import { takeStore, takeKey, takeWhen } from '../../lib/takeStore';
import { restoredUpload } from '../../lib/liveUpload';
import { rawClipsApi, uploadFields, uploadErrorMessage, abortUpload } from '../../lib/rawClipsApi';
import { withDuration } from '../../lib/takeDuration';
import { probeVideo } from '../../lib/videoProbe';
import { makeThumbnail } from '../../lib/chunkedUpload';
import { takeFileName, downloadBlob } from '../../lib/takeFile';
import { takeExtension, clock } from '../../lib/teleprompterLines';
import { FULL_BITRATE, STOP_BYTES, MARKS_NOT_KEPT, cleanMarks, markTime } from '../../lib/fullEpisodeTake';

export const CAMERA_KEY = 'teleprompter.phoneCamera';
// The prompter sends its state about 150 ms after it changes (useTeleprompterRemote).
export const RIG_SEND_S = 0.15;

const readCamera = () => {
  try { return window.localStorage.getItem(CAMERA_KEY) === 'user' ? 'user' : 'environment'; } catch (err) {
    console.error('[PhoneRecorder] camera choice not read:', err);
    return 'environment';
  }
};
const signedIn = () => {
  try { return !!(window.localStorage.getItem('authToken') || window.localStorage.getItem('token')); } catch (err) {
    console.error('[PhoneRecorder] sign-in not read:', err);
    return false;
  }
};

/**
 * How late a state read now is, in seconds: how long it sat on the server
 * (its age, by the server's clock), half the request's round trip, and the
 * prompter's own sending delay.
 */
export function stateLag({ ageMs = null, rttMs = null } = {}) {
  const age = Number(ageMs) >= 0 ? Number(ageMs) : 0;
  const half = Number(rttMs) > 0 ? Number(rttMs) / 2 : 0;
  return Math.min(5, (age + half) / 1000 + RIG_SEND_S);
}

/** What the prompter said about the take when Record was pressed. */
export function takePlan(state) {
  const s = state || {};
  const scope = s.scope === 'episode' ? 'episode' : 'beat';
  return {
    scope,
    episodeId: s.episodeId || null,
    label: s.takeLabel || null,
    takeNo: Number.isInteger(s.takeNo) ? s.takeNo : null,
    beat: Number.isInteger(s.beat) && s.beat >= 1 && s.beat <= 14 ? s.beat : null,
    startLine: scope === 'beat' && Number.isInteger(s.startLine) ? s.startLine : 0,
    performer: ['justawoman', 'lala', 'guest'].includes(s.performer) ? s.performer : 'justawoman',
    readAs: s.readAs || null,
  };
}

/**
 * state: the prompter's state (the phone's poll). lag: { ageMs, rttMs } of
 * that state. send(command): the remote's command. onRecording(on): the
 * page polls faster while this records.
 */
export default function PhoneRecorder({ state, lag = null, send, onRecording }) {
  const [facing, setFacing] = useState(readCamera);
  const [canSave] = useState(signedIn);
  const [save, setSave] = useState({ status: 'idle', progress: 0, error: null });
  const [notice, setNotice] = useState(null);
  const [offer, setOffer] = useState(null);
  const [plan, setPlan] = useState(null);
  const [marks, setMarks] = useState([]);
  const marksRef = useRef([]);
  const seenRigRef = useRef(false);
  const uploadsRef = useRef({});
  const previewRef = useRef(null);
  const reviewRef = useRef(null);
  const episodeId = state?.episodeId || plan?.episodeId || null;
  const storeKey = `phone:${takeKey(episodeId)}`;

  const keepUpload = (id, st) => {
    if (st) uploadsRef.current[id] = st; else delete uploadsRef.current[id];
    Promise.resolve(takeStore().update(id, { meta: { upload: st } }))
      .catch((err) => console.error('[PhoneRecorder] upload progress not kept with the take:', err));
  };
  const live = useLiveUpload({ episodeId: canSave ? episodeId : null, onState: keepUpload });
  const rec = useTakeRecorder(true, { storeKey, facingMode: facing, listener: live.listener });
  const { take, recording } = rec;
  useWakeLock(true);

  useEffect(() => { onRecording?.(recording); }, [recording, onRecording]);
  useEffect(() => { if (previewRef.current) previewRef.current.srcObject = rec.stream || null; }, [rec.stream]);

  // The take's length in its header; the last parts go up while she reviews it.
  const [playable, setPlayable] = useState(null);
  useEffect(() => {
    if (!take) { setPlayable(null); return undefined; }
    let on = true;
    withDuration(take.blob, take.seconds)
      .then((blob) => {
        if (!on) return;
        setPlayable({ take, blob });
        live.finish(take.id, take.blob, blob);
      })
      .catch((err) => console.error('[PhoneRecorder] the take\'s length was not written:', err));
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take]);
  const finished = async (t) => (playable?.take === t ? playable.blob : withDuration(t.blob, t.seconds));

  // A take kept on this phone and never saved: offered back once.
  useEffect(() => {
    let on = true;
    takeStore().unsaved(storeKey)
      .then((list) => { if (on && list.length) setOffer(list[0]); })
      .catch((err) => console.error('[PhoneRecorder] unsaved takes not looked for:', err));
    return () => { on = false; };
  }, [storeKey]);

  // Beat markers from the prompter's state: each new beat, as early as the
  // state's age and the connection say it was reached.
  useEffect(() => {
    if (!recording || plan?.scope !== 'episode' || !state) return;
    const beat = Number(state.beat);
    const last = marksRef.current[marksRef.current.length - 1];
    if (!Number.isInteger(beat) || beat < 1 || (last && beat <= last.beat)) return;
    const t = markTime(Math.max(last ? last.t : 0, rec.takeTime() - stateLag(lag || {})));
    marksRef.current = [...marksRef.current, { beat, t }];
    setMarks(marksRef.current);
    rec.note({ marks: marksRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, recording]);

  // The prompter ended the take (the end of the script, or Stop there): stop here too.
  useEffect(() => {
    if (!recording) { seenRigRef.current = false; return; }
    if (state?.phoneTake) { seenRigRef.current = true; return; }
    if (seenRigRef.current) {
      seenRigRef.current = false;
      setNotice('The prompter ended the take.');
      rec.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phoneTake, recording]);

  const ready = rec.camera.status === 'ready';
  const rigBusy = !!state?.recording || !!state?.reviewing || !!state?.phoneTake;
  const canStart = ready && !take && !recording && !rec.finishing && !rigBusy && !!state;

  const record = () => {
    if (!canStart) return;
    const p = takePlan(state);
    setPlan(p);
    setNotice(null);
    setSave({ status: 'idle', progress: 0, error: null });
    marksRef.current = p.scope === 'episode' && p.beat ? [{ beat: p.beat, t: 0 }] : [];
    setMarks(marksRef.current);
    const tag = canSave && p.episodeId ? {
      filename: p.scope === 'episode' ? `full-episode-take-${p.takeNo ?? 'x'}` : `beat-${p.beat ?? 'x'}-take-${p.takeNo ?? 'x'}`,
      fields: uploadFields({
        performer: p.performer, label: p.label || undefined, guestName: p.performer === 'guest' ? p.readAs : undefined,
        beatNumber: p.scope === 'beat' ? p.beat : undefined, startLine: p.scope === 'beat' ? p.startLine : undefined,
      }),
    } : null;
    const ok = rec.begin({
      videoBitsPerSecond: p.scope === 'episode' ? FULL_BITRATE : undefined, maxBytes: STOP_BYTES, tag,
      meta: { ...p, phone: true, marks: marksRef.current, label: p.label, takeNo: p.takeNo },
    });
    if (ok) send('phone_take_start');
  };
  const stop = () => { if (!recording) return; rec.stop(); send('phone_take_stop'); };
  const pauseOrResume = () => {
    if (!recording) return;
    if (rec.paused) { if (rec.resume()) send('phone_take_resume'); } else if (rec.pause()) send('phone_take_pause');
  };
  const switchCamera = () => {
    if (recording) return;
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    try { window.localStorage.setItem(CAMERA_KEY, next); } catch (err) { console.error('[PhoneRecorder] camera choice not kept:', err); }
  };

  const label = plan?.label || (take ? `Phone take · ${clock(take.seconds)}` : null);
  const fileName = take ? takeFileName(label || 'Phone take', takeExtension(take.type), take.startedAt || Date.now()) : null;

  const downloadTake = async () => {
    if (!take) return;
    if (downloadBlob(await finished(take), fileName)) setNotice(`Downloaded ${fileName}`);
    else setSave((s) => ({ ...s, status: 'error', error: 'The take could not be downloaded.' }));
  };

  const saveTake = async () => {
    if (!take || !canSave || !plan?.episodeId || save.status === 'saving') return;
    setSave({ status: 'saving', progress: 0, error: null });
    try {
      // Parts still going up from the recording: wait, so nothing goes up twice.
      await live.settled(take.id);
      const blob = await finished(take);
      const file = new File([blob], `${plan.scope === 'episode' ? 'full-episode' : `beat-${plan.beat ?? 'x'}`}-take-${plan.takeNo ?? 'x'}.${takeExtension(take.type)}`, { type: take.type });
      let m = null;
      try { m = await probeVideo(file, { knownSeconds: take.seconds }); } catch (err) { console.error('[PhoneRecorder] the take was not measured; saving it anyway:', err); }
      const kept = cleanMarks(marksRef.current);
      const { stored } = await rawClipsApi.uploadTake(plan.episodeId, file, {
        performer: plan.performer, label: label || undefined, guestName: plan.performer === 'guest' ? plan.readAs : undefined,
        beatNumber: plan.scope === 'beat' ? plan.beat : undefined, startLine: plan.scope === 'beat' ? plan.startLine : undefined,
        beatMarks: plan.scope === 'episode' ? kept : undefined, seconds: take.seconds, width: m?.width, height: m?.height,
      }, (p) => setSave((s) => ({ ...s, progress: p })), {
        resume: uploadsRef.current[take.id] || null,
        onState: (st) => keepUpload(take.id, st),
        thumbnail: m?.thumbnail || (() => makeThumbnail(take.blob)),
      });
      const marksKept = plan.scope !== 'episode' || !stored || stored.has('beat_marks');
      setNotice(marksKept ? `Saved to the episode's Files: ${label}` : MARKS_NOT_KEPT);
      setSave({ status: 'idle', progress: 0, error: null });
      live.forget(take.id);
      rec.discard();
      setPlan(null);
    } catch (err) {
      console.error('[PhoneRecorder] take not saved:', err);
      setSave({ status: 'error', progress: 0, error: uploadErrorMessage(err, { kept: takeStore().available ? 'phone' : 'page' }) });
    }
  };

  const discard = () => {
    if (!take || !window.confirm('Throw this take away? It has not been saved.')) return;
    live.abort(take.id);
    const left = uploadsRef.current[take.id];
    if (left?.uploadId && plan?.episodeId) abortUpload(plan.episodeId, left.uploadId);
    delete uploadsRef.current[take.id];
    rec.discard();
    setPlan(null);
    setSave({ status: 'idle', progress: 0, error: null });
  };

  const reviewOffer = async () => {
    const o = offer;
    setOffer(null);
    const got = await rec.restore(o);
    if (!got) { setNotice('That take could not be opened.'); return; }
    const m = o.meta || {};
    setPlan({ ...takePlan({}), ...m, episodeId: m.episodeId || episodeId });
    marksRef.current = cleanMarks(m.marks);
    setMarks(marksRef.current);
    if (m.upload?.uploadId) uploadsRef.current[o.id] = restoredUpload(m.upload, got.blob?.size) || m.upload;
  };
  const dropOffer = async () => {
    const o = offer;
    if (!o || !window.confirm(`Throw away the take from ${takeWhen(o.startedAt)}? It can't be brought back.`)) return;
    setOffer(null);
    const ep = o.meta?.episodeId || episodeId;
    if (o.meta?.upload?.uploadId && ep) abortUpload(ep, o.meta.upload.uploadId);
    const gone = await takeStore().remove(o.id);
    if (!gone) console.error('[PhoneRecorder] unsaved take not thrown away:', o.id);
  };

  const info = take ? live.info(take.id) : null;
  const savedLive = info && info.status !== 'off' && info.status !== 'aborted' ? info.percent : null;
  const problem = rec.camera.message || rec.error;

  return (
    <section className="tpr-card tpr-recorder" aria-label="Record on this phone" data-testid="tpr-recorder">
      {!take && (
        <div className="tpr-cam">
          {ready ? <video ref={previewRef} className={`tpr-preview${facing === 'user' ? ' is-front' : ''}`} muted autoPlay playsInline aria-label="Camera preview" data-testid="tpr-preview" />
            : <p className="tpr-hint">{rec.camera.status === 'starting' ? 'Opening the camera…' : 'The camera is off.'}</p>}
          {recording && (
            <p className="tpr-rec tpr-rec-badge" role="status" data-testid="tpr-rec-time">
              <span className="tpr-dot" aria-hidden="true" /> {rec.paused ? 'PAUSED' : 'REC'} {clock(rec.elapsed)}
            </p>
          )}
        </div>
      )}
      {problem && <p className="tpr-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {problem}</p>}
      {notice && <p className="tpr-hint is-ok" role="status" data-testid="tpr-rec-notice"><CheckCircle2 size={16} aria-hidden="true" /> {notice}</p>}

      {offer && !take && !recording && (
        <div className="tpr-offer" data-testid="tpr-recover">
          <p className="tpr-hint"><History size={16} aria-hidden="true" /> You have an unsaved take from {takeWhen(offer.startedAt)}{offer.meta?.label ? ` (${offer.meta.label})` : ''}.</p>
          <div className="tpr-row">
            <button type="button" className="tpr-btn is-primary" data-testid="tpr-recover-review" onClick={reviewOffer}>Review it</button>
            <button type="button" className="tpr-btn" data-testid="tpr-recover-drop" onClick={dropOffer}><Trash2 size={18} aria-hidden="true" /> Throw it away</button>
          </div>
        </div>
      )}

      {!take && (
        <>
          {!recording && state?.takeLabel && <p className="tpr-detail" data-testid="tpr-next-take">Next: {state.takeLabel}</p>}
          {!recording && rigBusy && <p className="tpr-hint" data-testid="tpr-rig-busy">The prompter is busy with a take. Wait for it to finish.</p>}
          <div className="tpr-row">
            {recording ? (
              <>
                <button type="button" className="tpr-btn is-rec" data-testid="tpr-phone-stop" onClick={stop}><Square size={24} aria-hidden="true" /><span>Stop</span></button>
                <button type="button" className="tpr-btn" data-testid="tpr-phone-pause" disabled={rec.interrupted === 'ended'} onClick={pauseOrResume}>
                  {rec.paused ? <Play size={24} aria-hidden="true" /> : <Pause size={24} aria-hidden="true" />}<span>{rec.paused ? 'Resume' : 'Pause'}</span>
                </button>
              </>
            ) : (
              <>
                <button type="button" className="tpr-btn is-rec" data-testid="tpr-phone-record" disabled={!canStart} onClick={record}><Circle size={24} aria-hidden="true" /><span>Record</span></button>
                <button type="button" className="tpr-btn" data-testid="tpr-switch-camera" disabled={rec.finishing} onClick={switchCamera}
                  aria-label={facing === 'environment' ? 'Use the front camera' : 'Use the back camera'}>
                  <SwitchCamera size={24} aria-hidden="true" /><span>{facing === 'environment' ? 'Back camera' : 'Front camera'}</span>
                </button>
              </>
            )}
          </div>
          {recording && plan?.scope === 'episode' && marks.length > 0 && <p className="tpr-detail" data-testid="tpr-phone-marks">Beat {marks[marks.length - 1].beat} · {marks.length} {marks.length === 1 ? 'marker' : 'markers'}</p>}
        </>
      )}
      {rec.finishing && <p className="tpr-hint">Putting the take together…</p>}

      {take && (
        <div className="tpr-review" data-testid="tpr-review">
          <p className="tpr-label" data-testid="tpr-review-name">{label} · {clock(take.seconds)}</p>
          <video ref={reviewRef} className="tpr-review-video" src={take.url} controls playsInline data-testid="tpr-review-video" />
          {savedLive != null && save.status !== 'saving' && <p className="tpr-hint" aria-live="polite" data-testid="tpr-live-saved">Saved while recording: {savedLive}%</p>}
          {save.status === 'saving' && <p className="tpr-hint" aria-live="polite" data-testid="tpr-save-progress">{save.progress >= 100 ? 'Finishing…' : `Uploading the take… ${save.progress}%`}</p>}
          {save.status === 'error' && <p className="tpr-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {save.error}</p>}
          {!canSave && (
            <p className="tpr-hint" data-testid="tpr-sign-in"><LogIn size={16} aria-hidden="true" /> Sign in to the app on this phone to save takes to the episode&apos;s Files. You can download this one now.</p>
          )}
          <div className="tpr-row">
            {canSave && plan?.episodeId && (
              <button type="button" className="tpr-btn is-primary" data-testid="tpr-save" disabled={save.status === 'saving'} onClick={saveTake}>
                <Upload size={22} aria-hidden="true" /><span>{save.status === 'error' ? 'Retry' : save.status === 'saving' ? 'Saving…' : 'Save take'}</span>
              </button>
            )}
            <button type="button" className="tpr-btn" data-testid="tpr-download" disabled={save.status === 'saving'} onClick={downloadTake}><Download size={22} aria-hidden="true" /><span>Download</span></button>
            <button type="button" className="tpr-btn" data-testid="tpr-discard" disabled={save.status === 'saving'} onClick={discard}><Trash2 size={22} aria-hidden="true" /><span>Discard</span></button>
          </div>
        </div>
      )}
    </section>
  );
}
