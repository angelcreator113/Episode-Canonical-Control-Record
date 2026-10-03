/**
 * Production coverage (docs/EVENT_EPISODE_FLOW.md §8(o) item 2; Evoni,
 * 2026-10-03, episode creation step 8): per canonical beat, Environment,
 * JustAWoman clip, Lala clip and Interface, each required, not required or
 * decided per episode, and whether it is met. One Continue opens where the
 * first missing thing is made: the Scenes tab for a set, the Overlays tab
 * for an interface asset.
 *
 * Reads GET /episode-brief/:episodeId/production-coverage and the episode's
 * performance clips (GET /episode-brief/:episodeId/performance-clips, the
 * clip home). A required JustAWoman or Lala cell opens the attach form: pick
 * one of the episode's video assets or paste a URL, then Save (PUT) or
 * Remove (DELETE); coverage reloads after either.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

const INDICATORS = [
  { key: 'environment', short: 'Set' },
  { key: 'host', short: 'JAW' },
  { key: 'character', short: 'Lala' },
  { key: 'interface', short: 'UI' },
];
const CONTINUE_TAB = { environment: 'scenes', interface: 'overlays' };
const PERFORMER = { host: 'justawoman', character: 'lala' };
const PERFORMER_NAME = { justawoman: 'JustAWoman', lala: 'Lala' };
const TEAL = '#2F7F76';
const PINK = '#C06E87';

const isVideo = (a) => a && (a.media_type === 'video' || /^video\//.test(a.content_type || ''));
const fieldStyle = { padding: '3px 6px', borderRadius: 6, border: '1px solid #F5D5DF', fontSize: 12, minWidth: 0, background: '#fff' };
const buttonStyle = (bg) => ({ padding: '3px 10px', borderRadius: 6, border: 'none', background: bg, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' });

/**
 * The attach form for one beat and performer. clip is the live clip there,
 * or null. Loads the episode's video assets once it opens.
 */
function ClipForm({ episodeId, target, clip, onDone, onCancel }) {
  const [assets, setAssets] = useState(null);
  const [assetId, setAssetId] = useState(clip?.asset_id || '');
  const [videoUrl, setVideoUrl] = useState(clip?.video_url || '');
  const [label, setLabel] = useState(clip?.label || '');
  const [approved, setApproved] = useState(clip?.status === 'approved');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/assets?episode_id=${episodeId}&limit=100`)
      .then((res) => { if (!cancelled) setAssets((res.data?.data || []).filter(isVideo)); })
      .catch((err) => {
        console.error('[ProductionCoverage] asset load failed:', err);
        if (!cancelled) setAssets([]);
      });
    return () => { cancelled = true; };
  }, [episodeId]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/api/v1/episode-brief/${episodeId}/performance-clips`, {
        canonical_beat_number: target.beat_number,
        performer: target.performer,
        asset_id: assetId || null,
        video_url: assetId ? null : (videoUrl.trim() || null),
        label: label.trim() || null,
        status: approved ? 'approved' : 'draft',
      });
      onDone();
    } catch (err) {
      console.error('[ProductionCoverage] clip save failed:', err);
      setError(err.response?.data?.error || 'The clip could not be saved.');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/v1/episode-brief/${episodeId}/performance-clips/${clip.id}`);
      onDone();
    } catch (err) {
      console.error('[ProductionCoverage] clip remove failed:', err);
      setError(err.response?.data?.error || 'The clip could not be removed.');
      setBusy(false);
    }
  };

  const canSave = !busy && (assetId || videoUrl.trim());
  return (
    <div data-testid="clip-form" style={{ marginTop: 8, padding: 8, borderRadius: 8, background: '#fff', border: '1px solid #CFE8E4' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        {PERFORMER_NAME[target.performer]} clip · Beat {target.beat_number} · {target.beat_name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>Episode video</span>
          <select
            data-testid="clip-asset" value={assetId} disabled={assets === null}
            onChange={(e) => setAssetId(e.target.value)} style={fieldStyle}
          >
            <option value="">{assets === null ? 'Loading…' : (assets.length ? 'None (use a URL)' : 'No episode videos uploaded')}</option>
            {(assets || []).map((a) => <option key={a.id} value={a.id}>{a.name || a.file_name || a.id}</option>)}
          </select>
        </label>
        {!assetId && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>Or a video URL</span>
            <input data-testid="clip-url" type="url" value={videoUrl} placeholder="https://…" onChange={(e) => setVideoUrl(e.target.value)} style={fieldStyle} />
          </label>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>Label (optional)</span>
          <input data-testid="clip-label" type="text" maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} style={fieldStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input data-testid="clip-approved" type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          <span>Approved</span>
        </label>
      </div>
      {error && <div data-testid="clip-error" style={{ marginTop: 6, color: PINK }}>{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <button type="button" data-testid="clip-save" disabled={!canSave} onClick={save} style={{ ...buttonStyle(TEAL), opacity: canSave ? 1 : 0.5 }}>
          {clip ? 'Save clip' : 'Attach clip'}
        </button>
        {clip && <button type="button" data-testid="clip-remove" disabled={busy} onClick={remove} style={buttonStyle(PINK)}>Remove</button>}
        <button type="button" data-testid="clip-cancel" disabled={busy} onClick={onCancel} style={{ ...buttonStyle('transparent'), color: '#7a6d62' }}>Cancel</button>
      </div>
    </div>
  );
}

function cell(ind) {
  if (ind.requirement === 'not_required') return { mark: '—', title: 'Not required', color: '#b8b0a6' };
  if (ind.requirement === 'per_episode' && ind.met !== true) return { mark: 'ep', title: 'Decided per episode', color: '#7a6d62' };
  if (ind.met === true) return { mark: '✓', title: ind.text || 'Ready', color: TEAL };
  if (ind.met === null) return { mark: '?', title: ind.text || 'Not tracked yet', color: '#7a6d62' };
  return { mark: '○', title: ind.text || 'Missing', color: PINK };
}

export default function ProductionCoveragePanel({ episodeId }) {
  const [coverage, setCoverage] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [clips, setClips] = useState([]);
  const [target, setTarget] = useState(null);

  const load = useCallback(() => {
    if (!episodeId) return () => {};
    let cancelled = false;
    api.get(`/api/v1/episode-brief/${episodeId}/production-coverage`)
      .then((res) => { if (!cancelled) setCoverage(res.data?.data || null); })
      .catch((err) => {
        console.error('[ProductionCoverage] load failed:', err);
        if (!cancelled) setFailed(true);
      });
    api.get(`/api/v1/episode-brief/${episodeId}/performance-clips`)
      .then((res) => { if (!cancelled) setClips(Array.isArray(res.data?.data) ? res.data.data : []); })
      .catch((err) => console.error('[ProductionCoverage] clip list failed:', err));
    return () => { cancelled = true; };
  }, [episodeId]);

  useEffect(() => load(), [load]);

  const clipFor = (t) => (t ? clips.find((c) => Number(c.canonical_beat_number) === t.beat_number && c.performer === t.performer) || null : null);
  const openClip = (beatNumber, beatName, key) => setTarget({ beat_number: beatNumber, beat_name: beatName, performer: PERFORMER[key] });

  if (failed) return <div data-testid="coverage-failed" style={{ fontSize: 12, color: PINK, marginBottom: 8 }}>Production coverage could not be loaded.</div>;
  if (!coverage) return null;
  const { required, met, untracked, covered, total, next, beats } = coverage;
  const tab = next ? CONTINUE_TAB[next.indicator] : null;
  const nextIsClip = next && PERFORMER[next.indicator];

  return (
    <div data-testid="production-coverage" style={{
      marginBottom: 8, padding: '8px 10px', borderRadius: 8,
      background: '#FBEFF3', border: '1px solid #F5D5DF', fontSize: 12, color: '#2C2C2C',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline' }}>
        <strong>Production coverage</strong>
        <span data-testid="coverage-summary">
          {met} of {required} required ready{untracked ? ` · ${untracked} not tracked yet` : ''} · {covered} of {total} beats covered
        </span>
      </div>
      {next ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span data-testid="coverage-next" style={{ flex: '1 1 180px', minWidth: 0 }}>
            <strong>Next:</strong> Beat {next.beat_number} · {next.beat_name}: {next.label}{next.text ? ` (${next.text})` : ''}
          </span>
          {tab && (
            <a
              data-testid="coverage-continue" href={`/episodes/${episodeId}?tab=${tab}`}
              style={{ padding: '3px 10px', borderRadius: 6, background: TEAL, color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
            >
              Continue →
            </a>
          )}
          {nextIsClip && (
            <button
              type="button" data-testid="coverage-attach-next" onClick={() => openClip(next.beat_number, next.beat_name, next.indicator)}
              style={buttonStyle(TEAL)}
            >
              Attach clip →
            </button>
          )}
        </div>
      ) : (
        <div data-testid="coverage-next-none" style={{ marginTop: 6, color: TEAL }}>Everything that can be checked is ready.</div>
      )}
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="coverage-toggle"
        style={{ marginTop: 6, padding: 0, border: 'none', background: 'none', color: TEAL, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
      >
        {open ? 'Hide beats' : 'Show beats'}
      </button>
      {open && (
        <table data-testid="coverage-grid" style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontWeight: 600, padding: '2px 4px' }}>Beat</th>
              {INDICATORS.map((i) => <th key={i.key} style={{ fontWeight: 600, padding: '2px 4px' }}>{i.short}</th>)}
            </tr>
          </thead>
          <tbody>
            {beats.map((b) => (
              <tr key={b.number} data-testid={`coverage-beat-${b.number}`} data-covered={b.covered ? 'true' : 'false'}>
                <td style={{ padding: '2px 4px' }}>{b.number}. {b.name}</td>
                {INDICATORS.map((i) => {
                  const ind = b.indicators[i.key];
                  const c = cell(ind);
                  const attachable = PERFORMER[i.key] && ind.requirement === 'required';
                  return (
                    <td key={i.key} title={c.title} data-testid={`coverage-${b.number}-${i.key}`} style={{ textAlign: 'center', color: c.color, fontWeight: 700, padding: '2px 4px' }}>
                      {attachable ? (
                        <button
                          type="button" data-testid={`coverage-attach-${b.number}-${i.key}`}
                          aria-label={`${ind.met === true ? 'Change' : 'Attach'} ${PERFORMER_NAME[PERFORMER[i.key]]} clip for beat ${b.number}`}
                          onClick={() => openClip(b.number, b.name, i.key)}
                          style={{ padding: '0 4px', border: `1px solid ${c.color}`, borderRadius: 4, background: 'none', color: c.color, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                        >
                          {c.mark}
                        </button>
                      ) : c.mark}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {target && (
        <ClipForm
          key={`${target.beat_number}:${target.performer}`}
          episodeId={episodeId} target={target} clip={clipFor(target)}
          onCancel={() => setTarget(null)}
          onDone={() => { setTarget(null); load(); }}
        />
      )}
    </div>
  );
}
