/**
 * Admin › The Pulse: the Social Director (docs/design/2026-10-the-pulse.md
 * §4; Task #2919). Its sub-tabs are ?sub=: Review, Uploads, Growth,
 * Storylines and Calendar, Story clock (Task 2941: the scrubber, The
 * Pulse as of any story moment), Voices (Task 2972: each posting
 * character's Voice Profile), Engine (Task 2968: the daily requests by
 * lane, Task 3031, the ambient switch and the posting queue), Polls and
 * Recaps. Review (Task 2925, the feed's director tools) is the default.
 * A tab with comingIn says which phase brings it; none has one now.
 * Review's tab counts what is waiting. Nothing here shows in
 * The Pulse.
 *
 * Uploads › Cover: The Pulse's cover image and its alt text, saved to the
 * show (Show.metadata.pulse_cover, /api/v1/shows/:id/pulse-cover). Empty, it
 * is a dashed "+ Add cover" spot. Uploads › Dream Cities: each city's
 * images and colours, saved on the city (components/Admin/PulseCitiesCard).
 * Uploads › Characters: profile and cover photos, saved on the character
 * (components/Admin/PulseCharactersCard). Uploads › Lala's everyday fits:
 * the show's fits (components/Admin/PulseFitsCard). Each item can carry
 * its reveal on The Pulse (components/Admin/RevealPicker, Task 2940).
 * The Admin mock (Evoni, 2026-10-17): the four numbers across the top
 * (components/Admin/PulseSummary, lib/pulseSummary), the Director's card
 * with its pill sub-tabs, and under Review, Needs your attention and Recent
 * activity. Styles: AdminPulse.css (pd-*), styles/AdminPanel.css (pulse-*).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Calendar, ClipboardCheck, Clock, Cpu, GitBranch, ImagePlus, Loader2, Mic,
  Newspaper, Radio, RefreshCw, Sparkles, Trash2, TrendingUp, Upload,
} from 'lucide-react';
import api from '../services/api';
import AdminShowGate from '../components/Admin/AdminShowGate';
import PulseCitiesCard from '../components/Admin/PulseCitiesCard';
import PulseCharactersCard from '../components/Admin/PulseCharactersCard';
import PulseFitsCard from '../components/Admin/PulseFitsCard';
import PulseReview from '../components/Admin/PulseReview';
import { PulseStats, PulseAttention, PulseActivity } from '../components/Admin/PulseSummary';
import { loadPulseSummary } from '../lib/pulseSummary';
import { PulseRevealProvider } from '../components/Admin/PulseRevealContext';
import RevealPicker from '../components/Admin/RevealPicker';
import PulseStoryClock from '../components/Admin/PulseStoryClock';
import PulseGrowth from '../components/Admin/PulseGrowth';
import PulseEngine from '../components/Admin/PulseEngine';
import PulseVoices from '../components/Admin/PulseVoices';
import PulseStorylines from '../components/Admin/PulseStorylines';
import PulseCalendar from '../components/Admin/PulseCalendar';
import PulsePolls from '../components/Admin/PulsePolls';
import PulseRecaps from '../components/Admin/PulseRecaps';
import './AdminPulse.css';

export const PULSE_TABS = [
  { key: 'review', label: 'Review' },
  { key: 'uploads', label: 'Uploads' },
  { key: 'story-clock', label: 'Story clock' },
  { key: 'growth', label: 'Growth' },
  { key: 'voices', label: 'Voices' },
  { key: 'engine', label: 'Engine' },
  { key: 'storylines', label: 'Storylines' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'polls', label: 'Polls' },
  { key: 'recaps', label: 'Recaps' },
];
const TAB_ICONS = {
  review: ClipboardCheck, uploads: Upload, 'story-clock': Clock, growth: TrendingUp, voices: Mic,
  engine: Cpu, storylines: GitBranch, calendar: Calendar, polls: BarChart3, recaps: Newspaper,
};
const DEFAULT_SUB = 'review';
const subFrom = (value) => (PULSE_TABS.some((t) => t.key === value) ? value : DEFAULT_SUB);

export const coverApi = {
  get: (showId) => api.get(`/api/v1/shows/${showId}/pulse-cover`).then((r) => r.data?.cover || null),
  upload: (showId, file, alt) => {
    const form = new FormData();
    form.append('image', file);
    if (alt) form.append('alt', alt);
    return api.post(`/api/v1/shows/${showId}/pulse-cover`, form).then((r) => r.data?.cover || null);
  },
  alt: (showId, alt) => api.patch(`/api/v1/shows/${showId}/pulse-cover`, { alt }).then((r) => r.data?.cover || null),
  remove: (showId) => api.delete(`/api/v1/shows/${showId}/pulse-cover`),
};

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

export function CoverCard({ showId }) {
  const [cover, setCover] = useState(undefined);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const c = await coverApi.get(showId);
      setCover(c);
      setAlt(c?.alt || '');
      setNote(null);
    } catch (err) {
      console.error('[PulseCover] the cover could not be read:', err);
      setCover(null);
      setNote(errorText(err));
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      console.error('[PulseCover] action failed:', err);
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run(async () => {
      const c = await coverApi.upload(showId, file, alt.trim());
      setCover(c);
      setAlt(c?.alt || '');
    });
  };
  const saveAlt = () => run(async () => {
    const c = await coverApi.alt(showId, alt.trim());
    setCover(c);
    setAlt(c?.alt || '');
  });
  const remove = () => {
    if (!window.confirm('Remove the cover? The Pulse shows its name on the header instead.')) return;
    run(async () => {
      await coverApi.remove(showId);
      setCover(null);
      setAlt('');
    });
  };

  if (cover === undefined) {
    return <div className="pulse-card pulse-loading"><Loader2 size={16} className="pulse-spin" aria-hidden="true" /> Loading the cover…</div>;
  }

  const altDirty = cover && alt.trim() !== (cover.alt || '');
  return (
    <section className="pulse-card" aria-labelledby="pulse-cover-heading" data-testid="pulse-cover">
      <h3 id="pulse-cover-heading">Cover</h3>
      <p className="pulse-hint">The wide image across the top of The Pulse. Without one, The Pulse shows its name.</p>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} data-testid="pulse-cover-file" />
      {cover ? (
        <>
          <img className="pulse-cover-preview" src={cover.url} alt={cover.alt || ''} />
          <label className="pulse-field">
            Alt text <span className="pulse-required">(required)</span>
            <input
              type="text"
              value={alt}
              maxLength={300}
              placeholder="Describe the image for people who can't see it"
              onChange={(e) => setAlt(e.target.value)}
              data-testid="pulse-cover-alt"
            />
          </label>
          {!cover.alt && <p className="pulse-warning" role="status">Add alt text: the cover has none yet.</p>}
          <RevealPicker type="image" kind="cover" id={showId} label="the cover" imageUrl={cover.url} />
          <div className="pulse-actions">
            <button type="button" className="pulse-btn primary" disabled={busy || !altDirty || !alt.trim()} onClick={saveAlt}>Save alt text</button>
            <button type="button" className="pulse-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <RefreshCw size={16} aria-hidden="true" /> Replace
            </button>
            <button type="button" className="pulse-btn danger" disabled={busy} onClick={remove}>
              <Trash2 size={16} aria-hidden="true" /> Remove
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="pulse-add-spot" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="pulse-cover-add">
          {busy ? <Loader2 size={20} className="pulse-spin" aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
          + Add cover
        </button>
      )}
      {note && <p className="pulse-error" role="alert">{note}</p>}
    </section>
  );
}

function PulseUploads({ showId }) {
  return (
    <div className="pulse-uploads" data-testid="pulse-uploads">
      <CoverCard key={showId} showId={showId} />
      <PulseCitiesCard />
      <PulseCharactersCard />
      <PulseFitsCard key={`fits-${showId}`} showId={showId} />
    </div>
  );
}

// Reads the show's summary for the numbers, Needs your attention and Recent
// activity (and Review's count), again whenever `version` moves.
function SummaryProbe({ showId, version, onSummary }) {
  useEffect(() => {
    let alive = true;
    loadPulseSummary(showId)
      .then((s) => { if (alive) onSummary(showId, s); })
      .catch((err) => console.error('[PulseDirector] the summary could not be read:', err?.response?.status || err?.message));
    return () => { alive = false; };
  }, [showId, version, onSummary]);
  return null;
}

export default function PulseDirector() {
  const [params, setParams] = useSearchParams();
  const [reviewCount, setReviewCount] = useState(null);
  const [summary, setSummary] = useState(null);
  const [version, setVersion] = useState(0);
  const [jumpTo, setJumpTo] = useState(null);
  const sub = subFrom(params.get('sub'));
  const current = PULSE_TABS.find((t) => t.key === sub);
  const select = (key) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('sub', key);
    return next;
  }, { replace: true });
  const summaryCount = useRef(null);
  const onSummary = useCallback((showId, s) => {
    summaryCount.current = s.reviewCount;
    setSummary({ showId, ...s });
    setReviewCount(s.reviewCount);
  }, []);
  // Review's own count after a release, an approval…: the summary follows it.
  const onCount = useCallback((n) => {
    setReviewCount(n);
    if (summaryCount.current !== null && n !== summaryCount.current) {
      summaryCount.current = n;
      setVersion((v) => v + 1);
    }
  }, []);
  const openSection = (section) => {
    if (sub !== 'review') select('review');
    setJumpTo(section);
  };
  useEffect(() => {
    if (!jumpTo || sub !== 'review') return undefined;
    const t = setTimeout(() => {
      document.querySelector(`[data-testid="${jumpTo}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      setJumpTo(null);
    }, 50);
    return () => clearTimeout(t);
  }, [jumpTo, sub]);

  return (
    <section className="admin-pulse pd" aria-labelledby="admin-pulse-heading" data-testid="admin-pulse">
      {summary && <PulseStats summary={summary} />}
      <div className="pd-card pd-director">
        <div className="pd-director-head">
          <span className="pd-director-icon" aria-hidden="true"><Sparkles size={22} /></span>
          <div className="pd-director-title">
            <h2 id="admin-pulse-heading">Social Director</h2>
            <p>Create, review and release what goes on The Pulse. Nothing on this tab shows in The Pulse until you release it.</p>
          </div>
          <Link className="pd-btn is-primary" to="/pulse"><Radio size={18} aria-hidden="true" />Open The Pulse<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="pd-tabs" role="tablist" aria-label="Social Director sections">
          {PULSE_TABS.map((t) => {
            const Icon = TAB_ICONS[t.key];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={sub === t.key}
                className={sub === t.key ? 'pd-tab is-active' : 'pd-tab'}
                onClick={() => select(t.key)}
              >
                {Icon && <Icon size={15} aria-hidden="true" />}
                {t.label}{t.key === 'review' && reviewCount ? ` (${reviewCount})` : ''}
              </button>
            );
          })}
        </div>
        {current.comingIn ? <p className="pulse-coming" data-testid="pulse-coming">{current.comingIn}</p> : (
          <AdminShowGate>
            {(showId) => (
              <PulseRevealProvider key={showId} showId={showId}>
                <SummaryProbe showId={showId} version={version} onSummary={onSummary} />
                {sub === 'review' && <PulseReview key={showId} showId={showId} onCount={onCount} />}
                {sub === 'uploads' && <PulseUploads showId={showId} />}
                {sub === 'story-clock' && <PulseStoryClock />}
                {sub === 'growth' && <PulseGrowth key={showId} showId={showId} />}
                {sub === 'voices' && <PulseVoices key={showId} showId={showId} />}
                {sub === 'engine' && <PulseEngine key={showId} showId={showId} />}
                {sub === 'storylines' && <PulseStorylines key={showId} showId={showId} />}
                {sub === 'calendar' && <PulseCalendar key={showId} showId={showId} />}
                {sub === 'polls' && <PulsePolls key={showId} showId={showId} />}
                {sub === 'recaps' && <PulseRecaps key={showId} showId={showId} />}
              </PulseRevealProvider>
            )}
          </AdminShowGate>
        )}
      </div>
      {sub === 'review' && summary && (
        <div className="pd-bottom">
          <PulseAttention summary={summary} onOpen={openSection} />
          <PulseActivity summary={summary} />
        </div>
      )}
    </section>
  );
}
