/**
 * EventFlowStrip — where the event goes next, under the Event Package's
 * header (Evoni, 2026-10-25: "What else can we improve on the event page
 * and how it flows?" … "I want them all"): one line of clashes when there
 * are any, beat 14's preview, the episode's status once it exists, and two
 * actions, Fill what's missing (AI drafts, reviewed in FillMissingPanel)
 * and Make a follow-up event. The page owns the hooks (useEventActions,
 * useFillMissing, useFollowUpEvent) and hands them in.
 */
import { AlertTriangle, AlertCircle, Loader2, Sparkles, CopyPlus } from 'lucide-react';
import Beat14Preview from './Beat14Preview';
import EpisodeStatusCard from './EpisodeStatusCard';
import FillMissingPanel from './FillMissingPanel';
import './EventFlow.css';

export default function EventFlowStrip({ showId, used, lockEpisode, episodeId, flow, fill, followUp }) {
  const lines = flow?.clashes?.lines || [];
  return (
    <section className="eff-strip" aria-label="What comes next" data-testid="event-flow-strip">
      {lines.length > 0 && (
        <p className="eff-clash-line" role="note" data-testid="clash-summary">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{lines.length === 1 ? lines[0].text : `${lines.length} things to check: ${lines.map((l) => l.text.replace(/\.$/, '')).join(' · ')}.`}</span>
        </p>
      )}
      <div className="eff-cards">
        {flow?.beat14 && <Beat14Preview beat14={flow.beat14} episodeId={episodeId} />}
        {episodeId && <EpisodeStatusCard key={episodeId} showId={showId} episodeId={episodeId} fallback={lockEpisode} />}
      </div>
      <div className="eff-actions">
        {!used && fill.status !== 'review' && (
          <button type="button" className="epp-btn epp-btn-small" data-testid="fill-missing" onClick={fill.ask}
            disabled={fill.status === 'loading'} aria-busy={fill.status === 'loading'}>
            {fill.status === 'loading'
              ? <><Loader2 size={13} className="epp-spin-icon" aria-hidden="true" /> Drafting…</>
              : <><Sparkles size={13} aria-hidden="true" /> Fill what&apos;s missing</>}
          </button>
        )}
        <button type="button" className="epp-btn epp-btn-small" data-testid="follow-up-event" onClick={followUp.create}
          disabled={followUp.creating} title={`Creates “${followUp.preview}” with the same host, brand and deal`}>
          {followUp.creating
            ? <><Loader2 size={13} className="epp-spin-icon" aria-hidden="true" /> Creating…</>
            : <><CopyPlus size={13} aria-hidden="true" /> Make a follow-up event</>}
        </button>
      </div>
      {fill.status === 'error' && (
        <p className="eff-error" role="alert" data-testid="fill-missing-error"><AlertCircle size={13} aria-hidden="true" /> {fill.error}</p>
      )}
      {fill.status === 'review' && !used && <FillMissingPanel fill={fill} />}
    </section>
  );
}
