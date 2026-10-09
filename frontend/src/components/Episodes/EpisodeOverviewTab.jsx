// frontend/src/components/Episodes/EpisodeOverviewTab.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dices, CalendarHeart, Tv, MapPin, FileText, Globe, Link2, Briefcase, Zap, Trophy, RefreshCw, X, PenLine, Clapperboard, Sparkles, Pencil, LayoutGrid, ArrowRight, ListOrdered, Package } from 'lucide-react';
import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import SceneSuggestionReview from '../episode/SceneSuggestionReview';
import TimelinePlacementsSection from '../episode/TimelinePlacementsSection';
import EpisodeTeaserSection from './EpisodeTeaserSection';
import EpisodeMoneyCard from './EpisodeMoneyCard';
import { NextStepBanner, OverviewTiles, StoryBriefCard, FromEventCard } from './EpisodeOverviewSummary';
import { episodePlanning } from '../../utils/episodePlanning';
import { resolveEventVenueAndDate } from '../../utils/eventReadiness';
import { fromEventItems, nextStep, coinsAfter } from '../../lib/episodeOverview';
import './EpisodeOverviewSections.css';

// EpisodeBrief enums — kept module-level so the chip rows don't re-create
// the array on every render. Order = display order.
const ARCHETYPES = ['Trial', 'Temptation', 'Breakdown', 'Redemption', 'Showcase', 'Rising', 'Pressure', 'Cliffhanger'];
const INTENTS = ['slay', 'pass', 'safe', 'fail'];

/**
 * EpisodeOverviewTab — Episode Dashboard
 *
 * Shows everything about this episode at a glance:
 * - Tier/score banner (if evaluated)
 * - Key stats row (status, prestige, cost, financial net)
 * - Event details
 * - Outfit summary
 * - Season position
 * - Quick actions
 */

const TIER_CONFIG = {
  slay: { emoji: '👑', label: 'SLAY', color: 'var(--lala-gold-text)', bg: 'var(--lala-gold-soft)' },
  pass: { emoji: '✨', label: 'PASS', color: 'var(--success-text)', bg: 'var(--success-bg)' },
  safe: { emoji: '😐', label: 'SAFE', color: 'var(--warning-text)', bg: 'var(--warning-bg)' },
  fail: { emoji: '💔', label: 'FAIL', color: 'var(--danger-text)', bg: 'var(--danger-bg)' },
};

/**
 * SectionBand — one part of the Overview below the summary (the Overview
 * redesign, 2026-10-08): a heading in the prose face, a line saying what
 * the part is for, then its cards. Same card language as the summary above
 * (EpisodeOverviewSummary.css); styles in EpisodeOverviewSections.css.
 */
const BAND_NOTES = {
  Identity: 'What this episode is and where it sits.',
  Production: "What's been made for it so far.",
  Source: 'Where it came from on the Feed.',
  Stakes: "What's at risk, and the money.",
  Reference: 'Snapshots from the event, for reading only.',
};
function SectionBand({ title, children }) {
  return (
    <section className="eov-band" aria-label={title}>
      <header className="eov-band-head">
        <h3 className="eov-band-title">{title}</h3>
        {BAND_NOTES[title] && <p className="eov-band-note">{BAND_NOTES[title]}</p>}
      </header>
      {children}
    </section>
  );
}

/** A card's title row: a lucide icon, the title, and anything on the right. */
function CardTitle({ icon: Icon, children, aside }) {
  return (
    <div className="eov-card-head">
      <h4 className="eov-card-title">{Icon && <Icon size={16} aria-hidden="true" />}{children}</h4>
      {aside}
    </div>
  );
}

/** A labelled value inside a card. */
function Field({ label, children, wide, tone }) {
  return (
    <div className={`eov-field${wide ? ' is-wide' : ''}`}>
      <span className="eov-field-label">{label}</span>
      <div className={`eov-field-value${tone ? ` is-${tone}` : ''}`}>{children}</div>
    </div>
  );
}

/**
 * The look tile: the outfit locked on the Wardrobe tab once it is read
 * (the one the script writer reads), else the events' planned pieces.
 */
function lookTile(locked, planned) {
  const n = (k) => `${k} piece${k === 1 ? '' : 's'}`;
  if (Array.isArray(locked)) {
    if (locked.length) return { value: `${n(locked.length)} locked`, tone: null };
    return { value: planned.length ? 'Planned, not locked' : 'Not chosen', tone: 'warn' };
  }
  return { value: planned.length ? n(planned.length) : 'Not chosen', tone: planned.length ? null : 'warn' };
}

function EpisodeOverviewTab({ episode, show, onUpdate, onOpenTab, checks = null, balance = null }) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [allEvents, setAllEvents] = useState([]);  // every event in the show — drives the linker dropdown
  const [linkedEvents, setLinkedEvents] = useState([]);  // GET /episodes/:id/events — the brief's source event first, then events whose used_in_episode_id is this episode
  const [sceneSets, setSceneSets] = useState([]);
  const [scriptInfo, setScriptInfo] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  // A refused link or unlink, in the server's words (e.g. the terms lock, §8(x) D4)
  const [linkError, setLinkError] = useState(null);
  // World locations for the show — needed to resolve venue_location_id on
  // each linked event into a name + thumbnail. Locations don't propagate
  // to the episode directly; the Locations card reads them through the
  // linked events. One source of truth.
  const [worldLocations, setWorldLocations] = useState([]);
  // Episode-scoped financial ledger — every transaction (event_payment,
  // wardrobe_purchase, tier_reward, event_reward, etc.) tagged with this
  // episode_id. Surfaced as a breakdown card in the Stakes band so the
  // Net P&L number on the stat strip has a "where did it come from" view
  // right next to it.
  const [ledger, setLedger] = useState({ transactions: [], loading: true });
  // EpisodeBrief snapshot + editable creative fields. Loaded alongside the
  // rest of the context. The `draft` mirror lets us debounce edits to
  // textareas without firing a PUT on every keystroke (saved on blur).
  const [brief, setBrief] = useState(null);
  const [draft, setDraft] = useState({});
  const [savingBrief, setSavingBrief] = useState(false);
  const [parentEvent, setParentEvent] = useState(null);
  // The brief's source event as the Event Package reads it (with its
  // organizer, scene set and venue): "From the event" and the next step.
  const [source, setSource] = useState(null);
  // The outfit locked on the Wardrobe tab (undefined until read; the
  // event's planned look stands in if it cannot be read).
  const [outfit, setOutfit] = useState(undefined);
  // Feed origin for an event started from a Feed creator (Task #1790): the
  // brief's automation holds only started_from_profile_id, so the name and
  // handle are read from that profile.
  const [startedFromProfile, setStartedFromProfile] = useState(null);
  // AI scene-set suggester state — fetch is one-shot, the modal is the
  // creator's review surface, and apply links the chosen sets via the
  // existing /scene-sets endpoint.
  const [sceneSuggestion, setSceneSuggestion] = useState(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [formData, setFormData] = useState({
    title: episode.title || '',
    // The internal synopsis (P13, Task #2386). Saved as `description`: the
    // old `logline` key was not in the PUT whitelist, so edits were dropped.
    description: episode.description || '',
    publish_date: episode.air_date || '',
    episode_intent: episode.episode_intent || '',
    creative_notes: episode.creative_notes || '',
  });

  const showId = show?.id || episode?.show_id;

  // The season context snapshotted at Start Episode (Season Arc §8(ff) A5).
  const seasonContext = (() => {
    const sc = episode?.season_context;
    if (!sc) return null;
    if (typeof sc !== 'string') return sc;
    try { return JSON.parse(sc); } catch (err) { console.error('[Episode] season_context parse failed:', err); return null; }
  })();

  useEffect(() => {
    if (!episode?.id) return;
    loadContext();
  }, [episode?.id]);

  const loadContext = async () => {
    // The episode's own events (Task #1906): the brief's source event
    // first, then any additional linked events.
    getEpisodeEvents(episode.id).then((data) => {
      setLinkedEvents(data?.events || []);
    }).catch((err) => console.error('[Episode] Failed to load episode events:', err));
    if (showId) {
      // The show's event list feeds only the linker dropdown (events not
      // yet linked anywhere). It is not how this episode finds its events.
      api.get(`/api/v1/world/${showId}/events`).then(({ data }) => {
        setAllEvents(data?.events || []);
      }).catch(() => {});
      // Episode-scoped ledger. Skipping when no showId — the endpoint
      // requires it, and a draft episode without a show wouldn't have
      // transactions anyway.
      api.get(`/api/v1/world/${showId}/financial-ledger?episode_id=${episode.id}&limit=50`)
        .then(({ data }) => {
          // Only the rows that count toward Lala's balance: a voided row
          // stays in the ledger as history but is not money (Task #2273).
          const txs = (data?.data?.transactions || []).filter(t => t.counted !== false);
          setLedger({ transactions: txs, loading: false });
        })
        .catch(() => setLedger({ transactions: [], loading: false }));
    } else {
      setLedger({ transactions: [], loading: false });
    }
    api.get(`/api/v1/episodes/${episode.id}/scene-sets`).then(({ data }) => setSceneSets(data?.data || [])).catch(() => {});
    api.get(`/api/v1/world/locations`).then(({ data }) => setWorldLocations(data?.locations || [])).catch(() => {});
    api.get(`/api/v1/episodes/${episode.id}/scripts?includeAllVersions=false`).then(({ data }) => {
      const scripts = data?.data || data?.scripts || [];
      if (scripts.length > 0) setScriptInfo({ exists: true, wordCount: scripts[0].content?.split(/\s+/).length || 0 });
    }).catch(() => {});
    // EpisodeBrief — drives the merged Identity/Source/Stakes/Reference
    // sections. Auto-creates if missing (the GET handler does that).
    api.get(`/api/v1/episode-brief/${episode.id}`).then(({ data }) => {
      const b = data?.data || null;
      setBrief(b);
      setDraft({
        narrative_purpose: b?.narrative_purpose || '',
        forward_hook: b?.forward_hook || '',
        episode_archetype: b?.episode_archetype || '',
        designed_intent: b?.designed_intent || '',
        allowed_outcomes: Array.isArray(b?.allowed_outcomes) ? b.allowed_outcomes : [],
        arc_number: b?.arc_number ?? '',
        position_in_arc: b?.position_in_arc ?? '',
      });
      if (b?.event_id && showId) {
        api.get(`/api/v1/world/${showId}/events/${b.event_id}`)
          .then((res) => setSource(res.data || null))
          .catch((err) => { console.error('[Episode] source event load failed:', err); setSource(null); });
        api.get(`/api/v1/wardrobe/outfit/${episode.id}`)
          .then((res) => setOutfit(Array.isArray(res.data?.items) ? res.data.items : undefined))
          .catch((err) => { console.error('[Episode] locked outfit load failed:', err); setOutfit(undefined); });
      }
      // Resolve narrative_chain.parent_event_id → event name for the Source band.
      const parentId = b?.narrative_chain?.parent_event_id;
      if (parentId && showId) {
        api.get(`/api/v1/world/${showId}/events`).then(({ data: ev }) => {
          const events = ev?.events || [];
          setParentEvent(events.find(e => e.id === parentId) || null);
        }).catch(() => {});
      }
    }).catch(() => {});
  };

  // ── Brief edit helpers ─────────────────────────────────────────────────
  // Save a single field via PUT. The brief route's whitelist limits which
  // keys are accepted; passing a snapshot field would be a no-op on the
  // server, so we only call this from editable controls.
  const isLocked = brief?.status === 'locked';
  const saveBriefField = async (field, value) => {
    if (!brief || isLocked) return;
    setSavingBrief(true);
    try {
      const { data } = await api.put(`/api/v1/episode-brief/${episode.id}`, { [field]: value });
      setBrief(data?.data || brief);
    } catch (err) {
      alert('Save failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      setSavingBrief(false);
    }
  };
  const toggleOutcome = (outcome) => {
    if (isLocked) return;
    const next = draft.allowed_outcomes.includes(outcome)
      ? draft.allowed_outcomes.filter(o => o !== outcome)
      : [...draft.allowed_outcomes, outcome];
    setDraft(d => ({ ...d, allowed_outcomes: next }));
    saveBriefField('allowed_outcomes', next);
  };

  // Parse evaluation
  let evalData = null;
  if (episode.evaluation_json) {
    evalData = typeof episode.evaluation_json === 'string' ? JSON.parse(episode.evaluation_json) : episode.evaluation_json;
  }
  const tier = evalData?.tier_final ? TIER_CONFIG[evalData.tier_final] : null;

  // First linked event drives the legacy single-event display fields
  // (prestige, outfit). When multiple events are linked, the rest still
  // render as chips below.
  const primaryEvent = linkedEvents[0] || null;

  // Aggregate outfit pieces across all linked events so multi-event
  // episodes show the combined wardrobe count. Each event's
  // outfit_pieces is parsed leniently (string OR array OR null) so
  // legacy data with stringified JSON keeps working.
  const outfitPieces = (() => {
    const all = [];
    linkedEvents.forEach(ev => {
      let pieces = ev.outfit_pieces;
      if (typeof pieces === 'string') try { pieces = JSON.parse(pieces); } catch { pieces = []; }
      if (Array.isArray(pieces)) all.push(...pieces);
    });
    return all;
  })();

  // Link / unlink handlers — call the world-events PUT to set or clear
  // used_in_episode_id, then refresh the local list. Events the show
  // already has but aren't linked anywhere are eligible for linking;
  // events linked to a different episode are filtered out.
  const linkEvent = async (eventId) => {
    if (!eventId || !showId) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, { used_in_episode_id: episode.id });
      const ev = allEvents.find(e => e.id === eventId);
      if (ev) {
        setLinkedEvents(prev => [...prev, { ...ev, used_in_episode_id: episode.id }]);
        setAllEvents(prev => prev.map(e => e.id === eventId ? { ...e, used_in_episode_id: episode.id } : e));
      }
    } catch (err) {
      console.error('[Episode] Failed to link event:', err);
      setLinkError(`Could not link the event: ${err.response?.data?.error || err.message || 'request failed'}`);
    } finally {
      setLinkBusy(false);
    }
  };
  const unlinkEvent = async (eventId) => {
    if (!eventId || !showId) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, { used_in_episode_id: null });
      setLinkedEvents(prev => prev.filter(e => e.id !== eventId));
      setAllEvents(prev => prev.map(e => e.id === eventId ? { ...e, used_in_episode_id: null } : e));
    } catch (err) {
      console.error('[Episode] Failed to unlink event:', err);
      setLinkError(`Could not unlink the event: ${err.response?.data?.error || err.message || 'request failed'}`);
    } finally {
      setLinkBusy(false);
    }
  };
  const linkableEvents = allEvents.filter(e => !e.used_in_episode_id);

  // Regenerate this episode from one of its linked events. The backend
  // soft-deletes the current episode and re-runs the generator on the
  // event — useful after editing the event (new outfit, stakes, etc.).
  // After success we navigate to the new episode since the old id is
  // no longer the active one.
  const regenerateFromEvent = async (ev) => {
    if (!showId) return;
    if (!window.confirm(`Regenerate episode from "${ev.name}"? The current episode will be soft-deleted and a fresh one created.`)) return;
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${ev.id}/regenerate-episode`);
      const newId = res.data?.data?.episode?.id;
      if (newId && newId !== episode.id) {
        navigate(`/episodes/${newId}`, { replace: true });
      } else {
        // Same id (rare) — just refresh
        if (typeof onUpdate === 'function') onUpdate({});
      }
    } catch (err) {
      alert('Regenerate failed: ' + (err?.response?.data?.error || err.message));
    }
  };

  // Locations derived from the linked events. Each event can point at a
  // WorldLocation via venue_location_id; we resolve those to full
  // location objects (name, district, image) for display. Deduped by id
  // so two events at the same venue don't show twice. Falls back to the
  // event's free-text venue_name when no FK is set. Both are read through
  // resolveEventVenueAndDate, so the automation copy counts as on the Place.
  const eventLocations = (() => {
    const seen = new Map();
    linkedEvents.forEach(ev => {
      const place = resolveEventVenueAndDate(ev);
      if (place.venueLocationId) {
        const loc = worldLocations.find(l => l.id === place.venueLocationId);
        if (loc && !seen.has(loc.id)) seen.set(loc.id, { kind: 'location', loc, eventName: ev.name });
      } else if (place.venueName) {
        const key = `name:${String(place.venueName).toLowerCase()}`;
        if (!seen.has(key)) seen.set(key, { kind: 'venue_name', name: place.venueName, eventName: ev.name });
      }
    });
    return Array.from(seen.values());
  })();

  // Financials
  // P&L derivation moved below the ledger derivations so it can prefer
  // the live ledger sums over the cached columns. See block after
  // hasFinancials.

  // ── Brief snapshot derivations ────────────────────────────────────────
  // Read-only objects come from the source event at generation time.
  // Sections render only when their underlying object has data, so most
  // episodes will only show the bands that apply.
  const careerCtx = brief?.career_context || {};
  const eventDiff = brief?.event_difficulty || {};
  const canonCons = brief?.canon_consequences || {};
  const narChain = brief?.narrative_chain || {};
  const eventMeta = brief?.event_metadata || {};
  const beatOutline = Array.isArray(brief?.beat_outline) ? brief.beat_outline : [];
  const seeds = Array.isArray(narChain.seeds_future_events) ? narChain.seeds_future_events : [];
  // Feed origin lives nested in canon_consequences.automation when an event
  // was created from a SocialProfile. Strip it from the canon JSON view to
  // avoid duplicating the Source section. Events started from the Feed since
  // Task #1790 record the creator as started_from_profile_id (not as the
  // organizer); older ones carry the automation.host_* copy.
  const automation = canonCons.automation || {};
  const startedFromId = automation.started_from_profile_id || null;
  useEffect(() => {
    if (!startedFromId) { setStartedFromProfile(null); return; }
    api.get(`/api/v1/social-profiles/${startedFromId}`)
      .then(({ data }) => setStartedFromProfile(data?.profile || null))
      .catch((err) => { console.error('[EpisodeOverviewTab] started-from profile load failed:', err?.message); setStartedFromProfile(null); });
  }, [startedFromId]);
  const feedOriginName = automation.host_display_name || automation.host_handle
    || startedFromProfile?.display_name || startedFromProfile?.handle || 'Unknown profile';
  const feedOriginHandle = automation.host_handle || startedFromProfile?.handle || null;
  const hasFeedOrigin = !!(startedFromId || automation.host_profile_id || automation.host_handle || automation.host_display_name);
  const canonConsCleaned = (() => { const { automation: _a, ...rest } = canonCons; return rest; })();
  const hasCanonCons = Object.keys(canonConsCleaned).length > 0;
  const hasCareerCtx = Object.keys(careerCtx).length > 0;
  const hasEventDiff = Object.keys(eventDiff).length > 0;
  const hasEventMeta = Object.keys(eventMeta).length > 0;
  // Rewards: prefer the live event (creator may have edited after generation)
  // and fall back to the brief's snapshot. Either source has the same shape:
  // { coins, reputation, brand_trust, influence, outcomes }.
  const liveRewards = (linkedEvents[0] && linkedEvents[0].rewards) || null;
  const rewardsRaw = liveRewards || eventMeta.rewards || {};
  const rewards = (typeof rewardsRaw === 'string'
    ? (() => { try { return JSON.parse(rewardsRaw); } catch { return {}; } })()
    : rewardsRaw) || {};
  const rewardOutcomes = Array.isArray(rewards.outcomes) ? rewards.outcomes : [];
  const rewardStats = ['coins', 'reputation', 'brand_trust', 'influence']
    .filter(k => (parseInt(rewards[k], 10) || 0) > 0);
  const hasRewards = rewardStats.length > 0 || rewardOutcomes.length > 0;
  // Financial breakdown derivations — group ledger rows by income vs
  // expense, sum each side, and total. The card hides while loading or
  // when an episode has no transactions yet (draft episodes never finalized).
  const ledgerIncome = ledger.transactions.filter(t => ['income', 'reward'].includes(t.type));
  const ledgerExpense = ledger.transactions.filter(t => ['expense', 'deduction'].includes(t.type));
  const ledgerIncomeTotal = ledgerIncome.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const ledgerExpenseTotal = ledgerExpense.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const hasFinancials = ledger.transactions.length > 0;
  // Episode P&L — when the episode has real ledger transactions, prefer
  // those (post-completion truth). Otherwise fall back to the columns
  // populated at generation time, which are predictions until the
  // creator hits Complete and finalizeEpisodeFinancials runs. The
  // distinction matters: the columns can show +500 from a paid event
  // that hasn't actually been credited yet.
  const isAccepted = episode.evaluation_status === 'accepted';
  const colIncome = parseFloat(episode.total_income) || 0;
  const colExpenses = parseFloat(episode.total_expenses) || 0;
  const income = hasFinancials ? ledgerIncomeTotal : colIncome;
  const expenses = hasFinancials ? ledgerExpenseTotal : colExpenses;
  const net = income - expenses;
  // Show an EST pill when displaying predictions (no ledger rows yet
  // AND not accepted). When accepted but no ledger rows (rare edge),
  // the columns ARE the truth from the prior finalize, so no badge.
  const netIsPrediction = !hasFinancials && !isAccepted && (income !== 0 || expenses !== 0);
  const hasNarChain = Object.keys(narChain).length > 0;
  const hasSourceBand = hasFeedOrigin || hasNarChain;
  const hasStakesBand = hasCareerCtx || hasEventDiff || hasRewards || hasFinancials || !!showId;
  const hasReferenceBand = hasCanonCons || beatOutline.length > 0 || hasEventMeta;

  // The top of the Overview (Evoni's Episode mock): the next step, the
  // tiles, the brief and what Start Episode carried from the event.
  const plan = source?.event
    ? episodePlanning({ episode, event: source.event, sourceProfile: source.sourceProfile, sceneSet: source.sceneSet, venueLocation: source.venueLocation, outfit })
    : null;
  const fromEvent = fromEventItems(plan);
  const hasScript = !!(typeof episode.script_content === 'string' && episode.script_content.trim()) || !!scriptInfo?.exists;
  const step = nextStep({ hasScript, brief: brief ? { ...brief, ...draft } : null, plan, checks });
  const coins = coinsAfter({ balance, net, accepted: isAccepted });
  const prestige = primaryEvent?.prestige;
  const tiles = [
    { key: 'checklist', label: 'Production checklist', value: checks ? `${checks.done} / ${checks.total}` : '—', link: { label: 'Open Production', tab: 'checklist' } },
    { key: 'prestige', label: 'Prestige', value: prestige ? `${prestige} / 10` : 'Not set', note: 'from the event' },
    { key: 'coins', label: 'Coins after episode', value: coins == null ? '—' : coins.toLocaleString(), link: { label: 'Open Money', tab: 'money' }, note: netIsPrediction ? 'estimate' : null },
    { key: 'look', label: "Lala's look", ...lookTile(outfit, outfitPieces), link: { label: 'Open Wardrobe', tab: 'wardrobe' } },
  ];

  const handleSave = async () => {
    try { await onUpdate(formData); setIsEditing(false); } catch { alert('Failed to save'); }
  };


  if (isEditing) {
    return (
      <div className="eov-edit">
        <div className="eov-edit-head">
          <h2 className="eov-edit-title">Edit episode</h2>
          <div className="eov-actions">
            <button type="button" className="eov-btn" onClick={() => setIsEditing(false)}>Cancel</button>
            <button type="button" className="eov-btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
        {[
          { key: 'title', label: 'Title', type: 'input', placeholder: 'Episode title...' },
          { key: 'description', label: 'Synopsis (internal)', type: 'textarea', placeholder: 'What happens in this episode (production only; viewers see the teaser)...', rows: 3 },
          { key: 'publish_date', label: 'Air Date', type: 'date' },
          { key: 'episode_intent', label: 'Intent', type: 'input', placeholder: 'Internal goal for this episode...' },
          { key: 'creative_notes', label: 'Creative Notes', type: 'textarea', placeholder: 'Tone, direction, things to remember...', rows: 4 },
        ].map(f => (
          <div key={f.key} className="eov-edit-field">
            <label className="eov-field-label" htmlFor={`eov-edit-${f.key}`}>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea id={`eov-edit-${f.key}`} className="eov-input" value={formData[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                placeholder={f.placeholder} rows={f.rows} />
            ) : (
              <input id={`eov-edit-${f.key}`} className="eov-input" type={f.type || 'text'} value={formData[f.key] || ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                placeholder={f.placeholder} />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="eov">
      {/* Tier Banner (if evaluated) */}
      {tier && (
        <div className="eov-tier" style={{ '--tier-color': tier.color, '--tier-bg': tier.bg }}>
          <div className="eov-tier-main">
            <span className="eov-tier-emoji" aria-hidden="true">{tier.emoji}</span>
            <div>
              <div className="eov-tier-title">{tier.label} — {evalData.score}/100</div>
              {evalData.narrative_lines?.short && <div className="eov-tier-line">{evalData.narrative_lines.short}</div>}
            </div>
          </div>
          <div className="eov-tier-stats">
            {[
              { icon: '🪙', val: evalData.stat_deltas?.coins, label: 'Coins' },
              { icon: '⭐', val: evalData.stat_deltas?.reputation, label: 'Rep' },
            ].map(st => st.val ? (
              <div key={st.label} className="eov-tier-stat">
                <div className={`eov-tier-stat-value ${st.val > 0 ? 'is-up' : 'is-down'}`}>{st.val > 0 ? '+' : ''}{st.val}</div>
                <div className="eov-tier-stat-label">{st.icon} {st.label}</div>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      <NextStepBanner step={step} onOpenTab={onOpenTab} />
      <OverviewTiles tiles={tiles} onOpenTab={onOpenTab} />
      <div className="eos-grid">
        <StoryBriefCard
          brief={brief} draft={draft} setDraft={setDraft} saveBriefField={saveBriefField}
          saving={savingBrief} locked={isLocked} synopsis={formData.description}
          onEdit={() => setIsEditing(true)} archetypes={ARCHETYPES} intents={INTENTS}
        />
        <FromEventCard from={fromEvent} showId={showId} eventId={source?.event?.id} onOpenTab={onOpenTab} />
      </div>

      {/* Viewer teaser (P12, Task #2386) */}
      <EpisodeTeaserSection episode={episode} onUpdate={onUpdate} />

      {/* IDENTITY band — what is this episode? The allowed outcomes
          (editable on the brief), then the events driving it and where it
          sits in the season. */}
      <SectionBand title="Identity">
      {/* ALLOWED OUTCOMES — toggleable. Disabling tiers narrows what the
          script generator and evaluator are allowed to produce. */}
      {brief && (
        <div className="eov-card">
          <CardTitle icon={Dices}>Allowed outcomes</CardTitle>
          <p className="eov-card-note">Turn one off and the script and the evaluation won't land on it.</p>
          <div className="eov-chips">
            {INTENTS.map(o => {
              const cfg = TIER_CONFIG[o];
              const active = draft.allowed_outcomes.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  className={`eov-outcome${active ? ' is-on' : ''}`}
                  style={{ '--tier-color': cfg.color, '--tier-bg': cfg.bg }}
                  aria-pressed={active}
                  disabled={isLocked}
                  onClick={() => toggleOutcome(o)}
                >{active ? '✓' : '✗'} {cfg.emoji} {o}</button>
              );
            })}
          </div>
        </div>
      )}

      <div className="eov-grid">
        {/* Events — multi-link. Each linked event is a row with × to
            unlink. The dropdown below lists every show event not yet
            linked anywhere; picking one stamps it with this episode's
            used_in_episode_id. */}
        <div className="eov-card">
          <CardTitle icon={CalendarHeart}>Events <span className="eov-count">{linkedEvents.length}</span></CardTitle>
          {linkedEvents.length === 0 ? (
            <p className="eov-empty">No events linked</p>
          ) : (
            <div className="eov-events">
              {linkedEvents.map(ev => (
                <div key={ev.id} className="eov-event">
                  <div className="eov-event-main">
                    <div className="eov-event-name">{ev.name}</div>
                    <div className="eov-tags">
                      {/* The brief's source event (Task #1906). It stays
                          listed while the brief names it, even if its
                          used_in_episode_id link is cleared. */}
                      {ev.link?.anchor && <span className="eov-tag is-source" title={ev.link.stamped ? 'The event this episode was started from' : 'The event this episode was started from; its link to this episode is missing or points elsewhere'}>source{ev.link.stamped ? '' : ' · unlinked'}</span>}
                      {ev.host && <span className="eov-tag">{ev.host}</span>}
                      {ev.dress_code && <span className="eov-tag">{ev.dress_code}</span>}
                      {ev.event_type && <span className="eov-tag">{ev.event_type}</span>}
                    </div>
                    {/* Back to the event (Task #2356): its Event Package,
                        read-only once Start Episode has locked the terms. */}
                    {(ev.show_id || showId) && (
                      <Link
                        to={`/shows/${ev.show_id || showId}/events/${ev.id}`}
                        data-testid={`overview-event-package-${ev.id}`}
                        className="eov-link"
                      >
                        View Event Package <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  <div className="eov-event-tools">
                    <button
                      type="button"
                      className="eov-icon-btn"
                      onClick={() => regenerateFromEvent(ev)}
                      disabled={linkBusy}
                      title="Regenerate this episode from the event (soft-deletes the current episode)"
                      aria-label="Regenerate this episode from the event"
                    ><RefreshCw size={15} aria-hidden="true" /></button>
                    <button
                      type="button"
                      className="eov-icon-btn"
                      onClick={() => unlinkEvent(ev.id)}
                      disabled={linkBusy}
                      title="Unlink event from this episode"
                      aria-label="Unlink event from this episode"
                    ><X size={15} aria-hidden="true" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {linkError && (
            <p role="alert" className="eov-warn">{linkError}</p>
          )}
          <select
            className="eov-select"
            aria-label="Link an event"
            value=""
            disabled={linkBusy || linkableEvents.length === 0}
            onChange={(e) => { if (e.target.value) linkEvent(e.target.value); e.target.value = ''; }}
          >
            <option value="">{linkableEvents.length === 0 ? 'No unlinked events available' : '+ Link an event…'}</option>
            {linkableEvents.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}{ev.event_type ? ` (${ev.event_type})` : ''}</option>
            ))}
          </select>
        </div>

        {/* Season Position — the season context snapshotted at Start Episode
            (Season Arc §8(ff) A5), shown "S1 · E7" (Q3); the show-wide
            episode count stays internal. */}
        <div className="eov-card" data-testid="season-position">
          <CardTitle icon={Tv}>Season position</CardTitle>
          {seasonContext?.label ? (
            <>
              <div className="eov-season-bar" aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <span key={i} className={(i + 1) === seasonContext.slot_number ? 'is-here' : (i + 1) < seasonContext.slot_number ? 'is-past' : ''} />
                ))}
              </div>
              <div className="eov-season-label">
                {seasonContext.label}
                {seasonContext.phase?.title && <span className="eov-season-phase"> · Phase {seasonContext.phase.number}: {seasonContext.phase.title}</span>}
              </div>
              <p className={seasonContext.story_purpose ? 'eov-text' : 'eov-empty'}>
                {seasonContext.story_purpose || 'No story purpose set for this slot yet.'}
              </p>
            </>
          ) : (
            <p className="eov-empty">
              Not in a season slot yet. Place it on Producer Mode → Episodes → Season Plan.
            </p>
          )}
        </div>
      </div>
      </SectionBand>

      {/* PRODUCTION band — what's been built? Locations, script status and
          the timeline overlay placements. */}
      <SectionBand title="Production">
      <div className="eov-grid">
        {/* Locations — derived from the linked events' venue_location_id
            (or venue_name when no FK is set). No standalone state on the
            episode; locations are always read through the events so
            there's no risk of drift. Hint creators that empty = link an
            event with a venue. */}
        <div className="eov-card">
          <CardTitle icon={MapPin}>Locations <span className="eov-count">{eventLocations.length}</span></CardTitle>
          {eventLocations.length > 0 ? (
            <div className="eov-places">
              {eventLocations.map((entry, i) => {
                const name = entry.kind === 'location' ? entry.loc.name : entry.name;
                const district = entry.kind === 'location' ? entry.loc.district : null;
                return (
                  <div key={i} className="eov-place">
                    <div className="eov-place-thumb" aria-hidden="true"><MapPin size={20} /></div>
                    <div className="eov-place-text">
                      <div className="eov-place-name">{name}</div>
                      {district && <div className="eov-place-meta">{district}</div>}
                      <div className="eov-place-meta">via {entry.eventName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="eov-empty">
              {linkedEvents.length === 0 ? 'Link an event to see its location here' : 'Linked events have no venue set'}
            </p>
          )}
        </div>

        {/* Script */}
        <div className="eov-card">
          <CardTitle icon={FileText}>Script</CardTitle>
          {scriptInfo?.exists ? (
            <div className="eov-script">
              <span className="eov-pill is-ok">✓ Script written</span>
              <span className="eov-muted">{scriptInfo.wordCount?.toLocaleString()} words</span>
            </div>
          ) : (
            <p className="eov-empty">No script yet</p>
          )}
          {onOpenTab && <button type="button" className="eov-link" onClick={() => onOpenTab('scripts')}>Open Script <ArrowRight size={14} aria-hidden="true" /></button>}
        </div>
      </div>

      {/* Video UI overlays — invites, checklists, etc. on the rendered
          video frame. Auto-populated when an invite is approved or the
          wardrobe checklist is locked, manually editable here. */}
      <TimelinePlacementsSection episodeId={episode.id} />
      </SectionBand>

      {/* SOURCE band — where this episode came from. Feed Origin (when the
          source event was created from a SocialProfile) + Narrative Chain
          (parent event, seeds for future events). Both render only when
          their data exists, and the band itself only renders when at
          least one is present. */}
      {hasSourceBand && (
        <SectionBand title="Source">
          <div className="eov-grid">
          {hasFeedOrigin && (
            <div className="eov-card">
              <CardTitle icon={Globe} aside={<Link to="/feed" className="eov-link">Feed <ArrowRight size={14} aria-hidden="true" /></Link>}>{feedOriginName}</CardTitle>
              <div className="eov-origin-meta">
                {feedOriginHandle && <span className="eov-handle">@{String(feedOriginHandle).replace(/^@/, '')}</span>}
                {automation.content_category && <span className="eov-tag">{automation.content_category}</span>}
              </div>
              {(automation.follow_motivation || automation.follow_emotion || automation.follow_trigger || automation.event_excitement != null) && (
                <>
                  <h5 className="eov-sub">Why this hooked Lala</h5>
                  <div className="eov-fields">
                    {automation.follow_motivation && <Field label="Motivation">{automation.follow_motivation}</Field>}
                    {automation.follow_emotion && <Field label="Emotion">{automation.follow_emotion}</Field>}
                    {automation.follow_trigger && <Field label="Trigger" wide>{automation.follow_trigger}</Field>}
                    {automation.event_excitement != null && <Field label="Excitement" tone="gold">{automation.event_excitement}/10</Field>}
                  </div>
                </>
              )}
              {(automation.lifestyle_claim || automation.lifestyle_reality || automation.lifestyle_gap) && (
                <>
                  <h5 className="eov-sub">Lifestyle gap</h5>
                  <div className="eov-fields">
                    {automation.lifestyle_claim && <Field label="Claim" wide>{automation.lifestyle_claim}</Field>}
                    {automation.lifestyle_reality && <Field label="Reality" wide>{automation.lifestyle_reality}</Field>}
                    {automation.lifestyle_gap && <Field label="Gap" wide tone="danger">{automation.lifestyle_gap}</Field>}
                  </div>
                </>
              )}
              {(automation.host_brand || automation.beauty_factor) && (
                <div className="eov-fields">
                  {automation.host_brand && <Field label="Brand">{automation.host_brand}</Field>}
                  {automation.beauty_factor && <Field label="Beauty hook">{automation.beauty_factor}{automation.beauty_description ? ` — ${automation.beauty_description}` : ''}</Field>}
                </div>
              )}
            </div>
          )}
          {hasNarChain && (
            <div className="eov-card">
              <CardTitle icon={Link2}>Narrative chain</CardTitle>
              <div className="eov-fields">
                {narChain.chain_position != null && <Field label="Chain position">{narChain.chain_position}</Field>}
                {narChain.parent_event_id && (
                  <Field label="Parent event">
                    {parentEvent ? (
                      parentEvent.used_in_episode_id
                        ? <Link to={`/episodes/${parentEvent.used_in_episode_id}`} className="eov-link">{parentEvent.name} <ArrowRight size={14} aria-hidden="true" /></Link>
                        : <>{parentEvent.name} <span className="eov-muted">(no episode yet)</span></>
                    ) : <span className="eov-handle">{String(narChain.parent_event_id).slice(0, 8)}…</span>}
                  </Field>
                )}
                {narChain.chain_reason && <Field label="Chain reason" wide tone="quiet">{narChain.chain_reason}</Field>}
              </div>
              {seeds.length > 0 && (
                <>
                  <h5 className="eov-sub">Seeds for future events</h5>
                  <ul className="eov-list">
                    {seeds.map((seed, i) => <li key={i}>{typeof seed === 'string' ? seed : JSON.stringify(seed)}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
          </div>
        </SectionBand>
      )}

      {/* STAKES band — what's at risk this episode? Career context (tier,
          milestone, success unlock, fail consequence) + difficulty knobs
          (strictness, deadline). Snapshot from the source event — not
          editable here; change them on the event itself. */}
      {hasStakesBand && (() => {
        // Pending vs earned: read evaluation_json.tier_final to badge each
        // reward. slay/pass = earned (matches episodeCompletionService gate),
        // safe/fail = missed (rewards don't fire), undefined = pending.
        const tierFinal = evalData?.tier_final || null;
        const rewardStatus = !tierFinal ? 'pending' : (['slay', 'pass'].includes(tierFinal) ? 'earned' : 'missed');
        const statusCfg = {
          pending: { label: 'Pending', bg: 'var(--warning-bg)', color: 'var(--warning-text)', border: 'var(--warning-border)' },
          earned: { label: 'Earned', bg: 'var(--success-bg)', color: 'var(--success-text)', border: 'var(--success-border)' },
          missed: { label: 'Missed', bg: 'var(--danger-bg)', color: 'var(--danger-text)', border: 'var(--danger-border)' },
        }[rewardStatus];
        const statIcons = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣' };
        return (
          <SectionBand title="Stakes">
            {(hasCareerCtx || hasEventDiff || hasRewards) && (
            <div className="eov-grid is-auto">
              {hasCareerCtx && (
                <div className="eov-card">
                  <CardTitle icon={Briefcase}>Career context</CardTitle>
                  <div className="eov-fields">
                    {careerCtx.career_tier && <Field label="Tier">{careerCtx.career_tier}</Field>}
                    {careerCtx.career_milestone && <Field label="Milestone">{careerCtx.career_milestone}</Field>}
                    {careerCtx.success_unlock && <Field label="Success unlock" wide tone="success">{careerCtx.success_unlock}</Field>}
                    {careerCtx.fail_consequence && <Field label="Fail consequence" wide tone="danger">{careerCtx.fail_consequence}</Field>}
                  </div>
                </div>
              )}
              {hasEventDiff && (
                <div className="eov-card">
                  <CardTitle icon={Zap}>Event difficulty</CardTitle>
                  <div className="eov-fields is-three">
                    {eventDiff.strictness != null && <Field label="Strictness" tone="big">{eventDiff.strictness}/10</Field>}
                    {eventDiff.deadline_type && <Field label="Deadline">{eventDiff.deadline_type}</Field>}
                    {eventDiff.deadline_minutes != null && <Field label="Minutes" tone="big">{eventDiff.deadline_minutes}</Field>}
                  </div>
                </div>
              )}
              {hasRewards && (
                <div className="eov-card">
                  <CardTitle
                    icon={Trophy}
                    aside={(
                      <span
                        className="eov-status"
                        style={{ '--status-bg': statusCfg.bg, '--status-color': statusCfg.color, '--status-border': statusCfg.border }}
                        title={
                          rewardStatus === 'pending' ? 'Episode not evaluated yet — rewards will fire on slay/pass.' :
                          rewardStatus === 'earned' ? 'Episode landed slay or pass — rewards applied.' :
                          'Episode landed safe or fail — rewards did not fire.'
                        }
                      >{statusCfg.label}</span>
                    )}
                  >Rewards</CardTitle>
                  {rewardStats.length > 0 && (
                    <div className="eov-fields">
                      {rewardStats.map(k => (
                        <Field key={k} label={`${statIcons[k] || ''} ${k.replace('_', ' ')}`} tone={rewardStatus === 'earned' ? 'success-big' : rewardStatus === 'missed' ? 'quiet-big' : 'big'}>+{rewards[k]}</Field>
                      ))}
                    </div>
                  )}
                  {rewardOutcomes.length > 0 && (
                    <>
                      <h5 className="eov-sub">Outcomes</h5>
                      <ul className="eov-list">
                        {rewardOutcomes.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
            )}
            {/* The Money card (§8(gg) MB5, Q10): it replaces the ledger list;
                the Money tab is the one full view. */}
            {showId && <EpisodeMoneyCard showId={showId} episodeId={episode.id} />}
          </SectionBand>
        );
      })()}

      {/* REFERENCE band — heavy snapshot data that creators rarely need
          but should be able to inspect. All collapsed by default; clicking
          a summary expands the JSON / list. */}
      {hasReferenceBand && (
        <SectionBand title="Reference">
          {hasCanonCons && (
            <details className="eov-card eov-details">
              <summary><Globe size={16} aria-hidden="true" /> Canon consequences</summary>
              <pre className="eov-pre">{JSON.stringify(canonConsCleaned, null, 2)}</pre>
            </details>
          )}
          {beatOutline.length > 0 && (
            <details className="eov-card eov-details">
              <summary><ListOrdered size={16} aria-hidden="true" /> AI beat outline ({beatOutline.length})</summary>
              <ol className="eov-outline">
                {beatOutline.map((beat, i) => (
                  <li key={i}>
                    <div className="eov-outline-title">{beat.summary || beat.name || `Beat ${beat.beat_number || i + 1}`}</div>
                    {beat.dramatic_function && <div className="eov-outline-note">{beat.dramatic_function}</div>}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {hasEventMeta && (
            <details className="eov-card eov-details">
              <summary><Package size={16} aria-hidden="true" /> Event metadata</summary>
              <pre className="eov-pre">{JSON.stringify(eventMeta, null, 2)}</pre>
            </details>
          )}
        </SectionBand>
      )}

      {/* Quick Actions */}
      <div className="eov-actions eov-quick">
        <button type="button" className="eov-btn-primary" onClick={() => navigate(`/episodes/${episode.id}/script-writer`)}><PenLine size={15} aria-hidden="true" /> Script Writer</button>
        {showId && <button type="button" className="eov-btn" onClick={() => navigate(`/shows/${showId}/world?tab=events`)}><LayoutGrid size={15} aria-hidden="true" /> Producer Mode</button>}
        <button type="button" className="eov-btn" onClick={() => navigate(`/episodes/${episode.id}/plan`)}><Clapperboard size={15} aria-hidden="true" /> Scene Plan</button>
        {/* AI scene-set suggester — disabled until the episode has a script
            since there's nothing to analyze otherwise. Fires the suggest
            endpoint then opens SceneSuggestionReview for the creator to
            approve / discard. */}
        <button
          type="button"
          className="eov-btn"
          onClick={async () => {
            setSuggestBusy(true);
            try {
              const { data } = await api.post(`/api/v1/episodes/${episode.id}/suggest-scenes`);
              if (data?.success && data?.proposal) {
                setSceneSuggestion({ proposal: data.proposal, contextSummary: data.context_summary });
              } else {
                alert(data?.error || 'No suggestions returned');
              }
            } catch (err) {
              alert(err?.response?.data?.error || err.message || 'Failed to fetch suggestions');
            } finally {
              setSuggestBusy(false);
            }
          }}
          disabled={!scriptInfo?.exists || suggestBusy}
          title={!scriptInfo?.exists ? 'Add a script first' : 'AI suggests scene sets per beat'}
        >
          <Sparkles size={15} aria-hidden="true" /> {suggestBusy ? 'Thinking…' : 'Suggest Scenes'}
        </button>
        <button type="button" className="eov-btn" onClick={() => setIsEditing(true)}><Pencil size={15} aria-hidden="true" /> Edit Details</button>
      </div>
      {sceneSuggestion && (
        <SceneSuggestionReview
          proposal={sceneSuggestion.proposal}
          contextSummary={sceneSuggestion.contextSummary}
          busy={applyBusy}
          onReject={() => setSceneSuggestion(null)}
          onApprove={async ({ sceneSetIds }) => {
            if (!sceneSetIds.length) { setSceneSuggestion(null); return; }
            setApplyBusy(true);
            try {
              await api.post(`/api/v1/episodes/${episode.id}/scene-sets`, { sceneSetIds });
              // Refresh the episode's linked sets so the Locations / Scene
              // Plan UI reflects the new links without a full page reload.
              const { data } = await api.get(`/api/v1/episodes/${episode.id}/scene-sets`);
              setSceneSets(data?.data || []);
              setSceneSuggestion(null);
            } catch (err) {
              alert(err?.response?.data?.error || err.message || 'Failed to apply');
            } finally {
              setApplyBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

export default EpisodeOverviewTab;
