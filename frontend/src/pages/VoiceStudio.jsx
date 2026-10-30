/**
 * Voice Studio (B2; Evoni, 2026-10-28; design read
 * docs/reads/2026-10-27-voice-studio-timeline-design.md, Revision 7, §5.1,
 * R5.2, R6.2): an episode's spoken lines by beat and character, each line's
 * takes and approval, recording or uploading a take, auditioning, approving,
 * withdrawing and re-confirming. Production → Voice on the episode page
 * (Evoni, 2026-10-30), `embedded`; /episodes/:episodeId/voice, the page it
 * was, lands there (VoiceStudioRedirect), keeping ?beat= and ?line=.
 *
 * Two tabs (S1; Evoni's mockup and rulings, 2026-10-30), only ones that
 * work: Needs Attention (the default: beat list, the beat's lines, the open
 * line's takes and approval, and what waits for a person) and Dialogue
 * Library (every line of this episode, its takes, approved take and
 * history). ?vtab= keeps the tab in the episode page's URL; ?beat= and
 * ?line= survive switching. Voice Settings comes with S3. No permanent
 * scene-thumbnail strip.
 *
 * Everything shown comes from one server read (GET …/studio), so lines,
 * takes and approval states belong to the same saved script; after any
 * change the page reads it again. The server judges every line and
 * approval (the one rule); the page never restores an old approval or puts
 * another take in its place. Only a current approval plays.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { voiceStudioApi, explainError } from '../lib/voiceStudioApi';
import { arrange } from '../lib/voiceStudioView';
import LineDetail from '../components/VoiceStudio/LineDetail';
import { ReviewPanel, AttentionList, UnassignedTakes } from '../components/VoiceStudio/BeatReview';
import useAudition from '../components/VoiceStudio/useAudition';
import BeatList from '../components/VoiceStudio/BeatList';
import DialogueLibrary from '../components/VoiceStudio/DialogueLibrary';
import './VoiceStudio.css';

// The tabs that work today (Voice Settings arrives with S3; no empty tab before then).
const TABS = [
  { key: 'attention', label: 'Needs Attention' },
  { key: 'library', label: 'Dialogue Library' },
];

const STATUS_LABEL = {
  approved: 'Approved', review: 'Needs review', outdated: 'Outdated', takes: 'Takes, none approved', none: 'No take', prime: "Prime's take", action: 'Not spoken',
};

function Banner({ message, onReload, onClose }) {
  if (!message) return null;
  const tone = message.tone || (message.stale || message.code ? 'warn' : 'ok');
  return (
    <div className={`vs-banner vs-banner--${tone}`} role={tone === 'ok' ? 'status' : 'alert'} data-testid="vs-banner">
      {tone === 'ok' ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
      <span>{message.message}</span>
      {message.stale && <button type="button" className="vs-btn vs-btn--gold" onClick={onReload}>Reload</button>}
      <button type="button" className="vs-btn vs-btn--quiet" aria-label="Dismiss" onClick={onClose}>×</button>
    </div>
  );
}

/** /episodes/:episodeId/voice → the episode's Voice tab, with the beat and line asked for. */
export function VoiceStudioRedirect() {
  const { episodeId } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams({ tab: 'voice' });
  for (const k of ['beat', 'line']) if (params.get(k) != null) next.set(k, params.get(k));
  return <Navigate to={`/episodes/${encodeURIComponent(episodeId)}?${next}`} replace />;
}

/** embedded: shown in the episode page's Voice tab (no way back, a smaller heading). */
export default function VoiceStudio({ episodeId: givenId = null, embedded = false } = {}) {
  const routeParams = useParams();
  const episodeId = givenId || routeParams.episodeId;
  const Heading = embedded ? 'h2' : 'h1';
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [speaker, setSpeaker] = useState('all');
  const audition = useAudition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(await voiceStudioApi.view(episodeId));
      setLoadError(null);
    } catch (err) {
      console.error('[VoiceStudio] the studio did not load:', err);
      setLoadError(explainError(err, "Voice Studio couldn't load."));
    } finally { setLoading(false); }
  }, [episodeId]);
  useEffect(() => { load(); }, [load]);

  const arranged = useMemo(() => (view ? arrange(view) : null), [view]);
  const usableBeats = arranged?.beats || [];
  const beatParam = params.get('beat');
  const beat = usableBeats.find((b) => String(b.beat_number) === beatParam) || usableBeats[0] || null;
  const lineParam = params.get('line');
  const line = beat && lineParam != null ? beat.lines.find((l) => String(l.line_index) === lineParam) || null : null;

  // Beat and line choices replace the URL; a tab switch adds to the history, so Back returns to the tab before.
  const choose = (next, { push = false } = {}) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) { if (v == null) p.delete(k); else p.set(k, String(v)); }
    setParams(p, { replace: !push });
  };
  const reload = async () => { setMessage(null); audition.stop(); await load(); };
  const changed = async () => { audition.stop(); await load(); };

  if (loading && !view) return <div className={`vs-page${embedded ? ' vs-page--embedded' : ''}`}><p className="vs-note" role="status">Loading Voice Studio…</p></div>;
  if (loadError && !view) {
    const off = loadError.code === 'VOICE_STUDIO_OFF';
    return (
      <div className={`vs-page${embedded ? ' vs-page--embedded' : ''}`}>
        {!embedded && <Link to={`/episodes/${episodeId}`} className="vs-back"><ArrowLeft size={14} /> Episode</Link>}
        <div className="vs-empty" role="alert" data-testid="vs-load-error">
          <Heading>Voice Studio</Heading>
          <p>{off ? "Voice Studio isn't switched on yet. Until it is, the Teleprompter keeps using the voice clips recorded on the Script tab." : loadError.message}</p>
          {!off && <button type="button" className="vs-btn" onClick={reload}><RefreshCw size={14} /> Try again</button>}
        </div>
      </div>
    );
  }

  const ep = view.episode || {};
  const title = ep.title || (ep.episode_number ? `Episode ${ep.episode_number}` : 'Episode');
  const { totals } = arranged;
  const lines = beat ? beat.lines.filter((l) => speaker === 'all' || l.speaker_key === speaker) : [];
  const vtab = params.get('vtab') === 'library' ? 'library' : 'attention';
  const toCheck = totals.review + totals.attention + totals.outdated;
  const openLine = (l) => choose({ vtab: null, beat: l.beat_number, line: l.line_index }, { push: true });

  return (
    <div className={`vs-page${embedded ? ' vs-page--embedded' : ''}`} data-testid="vs-page">
      <header className="vs-head">
        {!embedded && <Link to={`/episodes/${episodeId}`} className="vs-back"><ArrowLeft size={14} /> {title}</Link>}
        <Heading>Voice Studio</Heading>
        <button type="button" className="vs-btn vs-btn--quiet vs-reload" onClick={reload} disabled={loading}><RefreshCw size={14} /> Reload</button>
        <p className="vs-counts" data-testid="vs-counts">
          <span className="vs-stat"><strong>{totals.approved}/{totals.spoken}</strong> spoken lines approved</span>
          {totals.review > 0 && <span className="vs-badge vs-badge--warn">{totals.review} need review</span>}
          {(totals.attention + totals.outdated) > 0 && <span className="vs-badge vs-badge--bad">{totals.attention + totals.outdated} need attention</span>}
          {!view.can_edit && <span className="vs-badge vs-badge--muted">Read only</span>}
        </p>
      </header>

      <div className="vs-tabs" role="tablist" aria-label="Voice Studio">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`vs-tab-${t.key}`} aria-selected={vtab === t.key} aria-controls={`vs-panel-${t.key}`}
            className={`vs-tab${vtab === t.key ? ' vs-tab--on' : ''}`} onClick={() => choose({ vtab: t.key === 'attention' ? null : t.key }, { push: true })} data-testid={`vs-tab-${t.key}`}>
            {t.label}
            {t.key === 'attention' && toCheck > 0 && <span className="vs-tab-count" aria-label={`${toCheck} to check`}>{toCheck}</span>}
          </button>
        ))}
      </div>

      <Banner message={message} onReload={reload} onClose={() => setMessage(null)} />

      {vtab === 'library' ? (
        <div role="tabpanel" id="vs-panel-library" aria-labelledby="vs-tab-library">
          <DialogueLibrary episodeId={episodeId} arranged={arranged} statusLabel={STATUS_LABEL} audition={audition} onOpenLine={openLine} />
        </div>
      ) : (
        <div role="tabpanel" id="vs-panel-attention" aria-labelledby="vs-tab-attention">
          {!usableBeats.length ? (
            <div className="vs-empty" data-testid="vs-empty">
              <p>This episode has no script lines yet. Write the script in the Script tab, save it, then come back to record its lines.</p>
              <Link className="vs-btn" to={`/episodes/${episodeId}?tab=scripts`}>Open the Script tab</Link>
            </div>
          ) : (
            <div className="vs-studio">
              <BeatList beats={usableBeats} beat={beat} onChoose={(n) => choose({ beat: n, line: null })} />

              <div className="vs-col vs-col--lines">
                <div className="vs-beat-head">
                  <h3 className="vs-beat-title">Beat {beat?.beat_number ?? '—'} <span className="vs-faint">· {beat?.counts.spoken ?? 0} spoken {beat?.counts.spoken === 1 ? 'line' : 'lines'}</span></h3>
                  {arranged.speakers.length > 1 && (
                    <div className="vs-speakers" role="group" aria-label="Character">
                      <button type="button" className={`vs-chip${speaker === 'all' ? ' vs-chip--on' : ''}`} onClick={() => setSpeaker('all')}>Everyone</button>
                      {arranged.speakers.map((sp) => (
                        <button key={sp.key} type="button" className={`vs-chip${speaker === sp.key ? ' vs-chip--on' : ''}`} onClick={() => setSpeaker(sp.key)}>{sp.name}</button>
                      ))}
                    </div>
                  )}
                </div>

                {beat && beat.duplicate && <p className="vs-warn" role="alert">The script has two beats numbered {beat.beat_number}, so its lines can&apos;t be tied safely. Fix the beat numbers in the Script tab.</p>}

                {beat && (
                  <>
                    <ReviewPanel episodeId={episodeId} beat={beat} scriptRevision={view.script_revision} scriptSeq={view.script_seq} canEdit={view.can_edit}
                      onChanged={changed} onMessage={setMessage} onOpenLine={(i) => choose({ line: i })} />
                    <AttentionList episodeId={episodeId} beat={beat} scriptRevision={view.script_revision} canEdit={view.can_edit} onChanged={changed} onMessage={setMessage} />
                    <UnassignedTakes drifted episodeId={episodeId} takes={beat.driftedTakes} line={line} beat={beat} scriptRevision={view.script_revision}
                      canEdit={view.can_edit} audition={audition} onChanged={changed} onMessage={setMessage} />
                  </>
                )}

                <div className="vs-table" role="group" aria-label={`Beat ${beat?.beat_number} lines`}>
                  <div className="vs-table-head" aria-hidden="true"><span>Line</span><span>Status</span></div>
                  <ul className="vs-lines">
                    {lines.map((l) => (
                      <li key={l.key}>
                        <button type="button" className={`vs-line vs-line--${l.status}${line && line.key === l.key ? ' vs-line--on' : ''}`}
                          onClick={() => choose({ line: l.line_index })} aria-current={line && line.key === l.key ? 'true' : undefined} data-testid={`vs-line-${l.key}`}>
                          <span className="vs-line-who">{l.prime ? 'PRIME' : l.spoken ? (l.speaker_written || l.speaker_key) : '—'}</span>
                          <span className="vs-line-words">{l.words}</span>
                          <span className={`vs-line-status vs-line-status--${l.status}`}>{STATUS_LABEL[l.status]}{l.status === 'takes' ? ` (${l.takes.length})` : ''}</span>
                        </button>
                      </li>
                    ))}
                    {!lines.length && <li className="vs-note">No lines for this character in this beat.</li>}
                  </ul>
                </div>
              </div>

              <div className={`vs-col vs-col--detail${line ? ' is-open' : ''}`}>
                {line ? (
                  <>
                    <button type="button" className="vs-btn vs-btn--quiet vs-sheet-close" onClick={() => choose({ line: null })}>
                      <X size={14} aria-hidden="true" /> Back to the lines
                    </button>
                    <LineDetail key={line.key} episodeId={episodeId} line={line} beat={beat} scriptRevision={view.script_revision}
                      canEdit={view.can_edit} audition={audition} onChanged={changed} onMessage={setMessage} />
                  </>
                ) : (
                  <p className="vs-note vs-pick">Choose a line to hear its takes, record or upload one, and approve it.</p>
                )}
                <UnassignedTakes episodeId={episodeId} takes={arranged.unassigned} line={line} beat={beat} scriptRevision={view.script_revision}
                  canEdit={view.can_edit} audition={audition} onChanged={changed} onMessage={setMessage} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
