/**
 * The top of the Episode Overview (Evoni's Episode mock, 2026-10-05): the
 * next step, four tiles, the story brief and what Start Episode carried
 * from the event (which was the Planning card, episode creation step 2).
 * The helpers are lib/episodeOverview.js; the Overview owns the data and
 * the brief's saves.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CircleDashed, Pencil, Lock } from 'lucide-react';
import { briefState } from '../../lib/episodeOverview';
import './EpisodeOverviewSummary.css';

export function NextStepBanner({ step, onOpenTab }) {
  if (!step) return null;
  return (
    <section className="eos-next" data-testid="overview-next-step">
      <div className="eos-next-text">
        <span className="eos-next-label">Your next step</span>
        <h2 className="eos-next-title">{step.title}</h2>
        <p className="eos-next-why">{step.why}</p>
      </div>
      <button type="button" className="eos-next-btn" onClick={() => onOpenTab?.(step.tab)} data-testid="overview-next-step-go">
        {step.action} <ArrowRight size={15} aria-hidden="true" />
      </button>
    </section>
  );
}

/** [{ key, label, value, link: { label, tab } , tone }] */
export function OverviewTiles({ tiles, onOpenTab }) {
  return (
    <div className="eos-tiles" data-testid="overview-tiles">
      {tiles.map((t) => (
        <div key={t.key} className={`eos-tile${t.tone ? ` is-${t.tone}` : ''}`} data-testid={`overview-tile-${t.key}`}>
          <span className="eos-tile-label">{t.label}</span>
          <strong className="eos-tile-value">{t.value}</strong>
          {t.link && (
            <button type="button" className="eos-link" onClick={() => onOpenTab?.(t.link.tab)}>{t.link.label}</button>
          )}
          {t.note && <span className="eos-tile-note">{t.note}</span>}
        </div>
      ))}
    </div>
  );
}

const INTENT_LABEL = { slay: 'Slay', pass: 'Pass', safe: 'Safe', fail: 'Fail' };
// Where in the Event Package each item is finished (its section anchor).
const PACKAGE_SECTION = { cast: 'epp-sec-people', location: 'epp-sec-place' };

export function StoryBriefCard({
  brief, draft, setDraft, saveBriefField, saving, locked, synopsis, onEdit, archetypes, intents,
}) {
  // The synopsis is the episode's own; the four creative fields wait for the brief.
  const state = brief ? briefState({ ...brief, ...draft }) : null;
  return (
    <section className="eos-card eos-brief" data-testid="overview-story-brief">
      <div className="eos-card-head">
        <h2 className="eos-card-title">Story brief</h2>
        {state && (
          <span className={`eos-chip ${state.complete ? 'is-complete' : 'is-open'}`} data-testid="overview-brief-state">
            {state.complete ? 'Complete' : `${state.set} of ${state.total} set`}
          </span>
        )}
        {saving && <span className="eos-saving">Saving…</span>}
        {locked && <span className="eos-locked"><Lock size={11} aria-hidden="true" /> Locked</span>}
        <button type="button" className="eos-link eos-edit" onClick={onEdit}><Pencil size={12} aria-hidden="true" /> Edit</button>
      </div>
      <div className="eos-field" data-testid={synopsis ? 'episode-synopsis' : undefined}>
        <span className="eos-field-label">Synopsis (internal)</span>
        {synopsis
          ? <p className="eos-prose">{synopsis}</p>
          : <p className="eos-prose is-empty">No synopsis yet. Edit adds one.</p>}
      </div>
      {brief && (
      <>
      <div className="eos-brief-row">
        <label className="eos-field">
          <span className="eos-field-label">Archetype</span>
          <select
            className="eos-select" value={draft.episode_archetype || ''} disabled={locked}
            onChange={(e) => { setDraft((d) => ({ ...d, episode_archetype: e.target.value })); saveBriefField('episode_archetype', e.target.value || null); }}
          >
            <option value="">Not set</option>
            {archetypes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div className="eos-field">
          <span className="eos-field-label">Designed intent</span>
          <div className="eos-intents" role="group" aria-label="Designed intent">
            {intents.map((i) => {
              const active = draft.designed_intent === i;
              return (
                <button
                  key={i} type="button" disabled={locked} aria-pressed={active}
                  className={`eos-intent${active ? ' is-active' : ''}`}
                  onClick={() => { const next = active ? '' : i; setDraft((d) => ({ ...d, designed_intent: next })); saveBriefField('designed_intent', next || null); }}
                >
                  {INTENT_LABEL[i] || i}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <label className="eos-field">
        <span className="eos-field-label">Narrative purpose</span>
        <textarea
          className="eos-text" rows={2} disabled={locked} value={draft.narrative_purpose || ''}
          placeholder="What this episode does for Lala's story, in a sentence or two"
          onChange={(e) => setDraft((d) => ({ ...d, narrative_purpose: e.target.value }))}
          onBlur={() => brief.narrative_purpose !== draft.narrative_purpose && saveBriefField('narrative_purpose', draft.narrative_purpose)}
        />
      </label>
      <label className="eos-field">
        <span className="eos-field-label">Forward hook</span>
        <textarea
          className="eos-text" rows={2} disabled={locked} value={draft.forward_hook || ''}
          placeholder="What pulls viewers into the next episode"
          onChange={(e) => setDraft((d) => ({ ...d, forward_hook: e.target.value }))}
          onBlur={() => brief.forward_hook !== draft.forward_hook && saveBriefField('forward_hook', draft.forward_hook)}
        />
      </label>
      </>
      )}
    </section>
  );
}

export function FromEventCard({ from, showId, eventId, onOpenTab }) {
  if (!from) return null;
  return (
    <section className="eos-card eos-from" data-testid="episode-planning">
      <div className="eos-card-head">
        <h2 className="eos-card-title">From the event</h2>
        <span className="eos-count" data-testid="episode-planning-count">{from.ready} of {from.total} ready</span>
      </div>
      <ul className="eos-from-items">
        {from.items.map((it) => (
          <li key={it.key} className={`eos-from-item ${it.done ? 'is-done' : 'is-open'}`} data-testid={`episode-planning-${it.key}`} data-done={it.done ? 'true' : 'false'}>
            <span className="eos-from-icon" aria-hidden="true">{it.done ? <Check size={12} /> : <CircleDashed size={18} />}</span>
            <div className="eos-from-text">
              <strong>{it.label}</strong>
              <span>{it.detail}</span>
              {it.fix === 'package' && (
                <Link className="eos-link" to={`/shows/${showId}/events/${eventId}${PACKAGE_SECTION[it.key] ? `#${PACKAGE_SECTION[it.key]}` : ''}`} data-testid={`episode-planning-fix-${it.key}`}>{it.fixLabel}</Link>
              )}
              {it.fix === 'wardrobe' && (
                <button type="button" className="eos-link" onClick={() => onOpenTab?.('wardrobe')} data-testid={`episode-planning-fix-${it.key}`}>{it.fixLabel}</button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Link className="eos-link eos-from-open" to={`/shows/${showId}/events/${eventId}`} data-testid="episode-planning-package">
        Open the event package <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </section>
  );
}
