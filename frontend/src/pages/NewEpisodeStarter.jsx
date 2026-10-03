/**
 * New Episode starter (Evoni, 2026-10-03, episode creation step 4): "What
 * starts this episode?" Every choice is a way into the same Event Package,
 * not a separate kind of episode; each creates the event through a path
 * that already exists and opens its Package.
 *
 *   Creator Invitation  → Lala's Feed in choose-host mode (Task #1628),
 *                         POST /world/:showId/events/from-profile
 *   Brand Opportunity   → POST /world/:showId/events with host_brand: the
 *                         brand is the organizer (§8(p) ruling 5's second
 *                         path; interim storage per ruling 6)
 *   World Event         → a Cultural Calendar event,
 *                         POST /calendar/events/:id/auto-spawn
 *   Career Opportunity  → an offered opportunity,
 *                         POST /feed-pipeline/:showId/schedule/:id
 *   Personal Story      → not built: who organizes it is Evoni's to rule
 *   Surprise Me         → Pitch Me (step 6): three AI pitches from the
 *                         living world, POST /world/:showId/episode-pitches
 *                         (Haiku, rate-limited, one call per click, writes
 *                         nothing); Build this episode creates the event
 *                         through POST /world/:showId/events
 *
 * ?start=creator opens the creator path so Back returns here.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, UserRound, Tag, Globe2, Briefcase, Heart, Sparkles } from 'lucide-react';
import api from '../services/api';
import { filterBrands, BRAND_NAME_MAX } from '../utils/eventOrganizer';
import { buildEventFromPitch } from '../utils/pitchEvent';
import './NewEpisodeStarter.css';

const SocialProfileGenerator = lazy(() => import('./SocialProfileGenerator'));

export const STARTING_POINTS = [
  { key: 'creator', icon: UserRound, title: 'Creator Invitation', text: "Someone from Lala's Feed invites her." },
  { key: 'brand', icon: Tag, title: 'Brand Opportunity', text: 'A brand puts on the event.' },
  { key: 'world', icon: Globe2, title: 'World Event', text: 'A gala, premiere or cultural moment from the calendar.' },
  { key: 'opportunity', icon: Briefcase, title: 'Career Opportunity', text: 'A campaign, appearance or collaboration already offered.' },
  { key: 'personal', icon: Heart, title: 'Personal Story', text: 'A friend, family or relationship story.', soon: 'Needs your ruling first: who organizes a personal story.' },
  { key: 'surprise', icon: Sparkles, title: 'Surprise Me', text: 'Prime Studios pitches three episodes from where Lala is now.' },
];

// Opportunities the Ideas drawer offers to schedule (WorldAdmin): not yet an
// event, in an active status.
const SCHEDULABLE = ['offered', 'considering', 'negotiating', 'booked'];

const errorOf = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

function BrandStart({ showId, onCreated }) {
  const [brands, setBrands] = useState(null);
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/wardrobe-brands/brands')
      .then((res) => { if (!cancelled) setBrands(Array.isArray(res.data) ? res.data : []); })
      .catch((err) => {
        console.error('[NewEpisode] brand list failed:', err);
        if (!cancelled) setBrands([]);
      });
    return () => { cancelled = true; };
  }, []);

  const create = async () => {
    const hostBrand = brand.trim().slice(0, BRAND_NAME_MAX);
    const eventName = name.trim();
    if (!hostBrand || !eventName || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events`, { name: eventName, host_brand: hostBrand });
      const id = res.data?.event?.id;
      if (id) onCreated(id);
      else setError('The event was created but no id came back.');
    } catch (err) {
      console.error('[NewEpisode] brand event create failed:', err);
      setError(errorOf(err, 'Could not create the event'));
    } finally {
      setSaving(false);
    }
  };

  const listed = filterBrands(brands || [], search).slice(0, 12);
  return (
    <div className="nes-panel" data-testid="start-brand">
      <h2 className="nes-panel-title">Which brand?</h2>
      <input
        className="nes-input" placeholder="Search brands, or type a new one" value={search}
        onChange={(e) => { setSearch(e.target.value); setBrand(e.target.value); }} data-testid="brand-search"
      />
      {brands === null && <p className="nes-note">Loading brands…</p>}
      {listed.length > 0 && (
        <ul className="nes-options">
          {listed.map((b) => (
            <li key={b.id || b.name}>
              <button
                type="button" className={`nes-option ${brand === b.name ? 'is-picked' : ''}`}
                onClick={() => { setBrand(b.name); setSearch(b.name); }} data-testid={`brand-option-${b.name}`}
              >
                {b.name}{b.category ? <span className="nes-option-meta"> · {b.category}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="nes-label">
        Event name
        <input
          className="nes-input" placeholder="e.g. Ori Beauty Creator Brunch" value={name}
          onChange={(e) => setName(e.target.value)} data-testid="brand-event-name"
        />
      </label>
      <p className="nes-note">You can ask for name suggestions in the Event Package.</p>
      {error && <p className="nes-error" role="alert">{error}</p>}
      <button
        type="button" className="nes-primary" onClick={create}
        disabled={!brand.trim() || !name.trim() || saving} data-testid="brand-create"
      >
        {saving ? 'Creating…' : `Start with ${brand.trim() || 'this brand'}`}
      </button>
    </div>
  );
}

function WorldStart({ showId, onCreated }) {
  const [events, setEvents] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/calendar/events?series_id=${encodeURIComponent(showId)}`)
      .then((res) => { if (!cancelled) setEvents(res.data?.events || []); })
      .catch((err) => {
        console.error('[NewEpisode] calendar load failed:', err);
        if (!cancelled) setEvents([]);
      });
    return () => { cancelled = true; };
  }, [showId]);

  const start = async (ce) => {
    if (busy) return;
    setBusy(ce.id);
    setError(null);
    try {
      const res = await api.post(`/api/v1/calendar/events/${ce.id}/auto-spawn`, { show_id: showId, event_count: 1, max_guests: 6 });
      const id = res.data?.data?.events?.[0]?.id;
      if (id) onCreated(id);
      else setError('No event was created from that calendar moment.');
    } catch (err) {
      console.error('[NewEpisode] calendar spawn failed:', err);
      setError(errorOf(err, 'Could not create the event'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nes-panel" data-testid="start-world">
      <h2 className="nes-panel-title">Which moment in the world?</h2>
      {events === null && <p className="nes-note">Loading the calendar…</p>}
      {events && events.length === 0 && (
        <p className="nes-note" data-testid="world-empty">
          The calendar has no events for this show yet. Add one in <Link to="/culture-events?tab=events">Culture &amp; Events</Link>.
        </p>
      )}
      {events && events.length > 0 && (
        <ul className="nes-options">
          {events.slice(0, 12).map((ce) => (
            <li key={ce.id}>
              <button type="button" className="nes-option" onClick={() => start(ce)} disabled={!!busy} data-testid={`world-option-${ce.id}`}>
                {ce.title || 'Untitled'}
                <span className="nes-option-meta">
                  {[ce.cultural_category, ce.start_datetime ? new Date(ce.start_datetime).toLocaleDateString() : null].filter(Boolean).map((t) => ` · ${t}`).join('')}
                </span>
                {busy === ce.id && <span className="nes-option-meta"> · creating…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="nes-error" role="alert">{error}</p>}
    </div>
  );
}

function OpportunityStart({ showId, onCreated }) {
  const [opps, setOpps] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/opportunities/${showId}`)
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.opportunities || [];
        setOpps(list.filter((o) => !o.event_id && SCHEDULABLE.includes(o.status)));
      })
      .catch((err) => {
        console.error('[NewEpisode] opportunities load failed:', err);
        if (!cancelled) setOpps([]);
      });
    return () => { cancelled = true; };
  }, [showId]);

  const schedule = async (opp) => {
    if (busy) return;
    setBusy(opp.id);
    setError(null);
    try {
      const res = await api.post(`/api/v1/feed-pipeline/${showId}/schedule/${opp.id}`);
      const id = res.data?.data?.event_id;
      if (id) onCreated(id);
      else setError('The opportunity was scheduled but no event id came back.');
    } catch (err) {
      console.error('[NewEpisode] opportunity schedule failed:', err);
      setError(errorOf(err, 'Could not schedule the opportunity'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nes-panel" data-testid="start-opportunity">
      <h2 className="nes-panel-title">Which opportunity?</h2>
      {opps === null && <p className="nes-note">Loading opportunities…</p>}
      {opps && opps.length === 0 && (
        <p className="nes-note" data-testid="opportunity-empty">
          No open opportunities. Producer Mode&apos;s Events → Ideas can find them in the Feed.
        </p>
      )}
      {opps && opps.length > 0 && (
        <ul className="nes-options">
          {opps.map((o) => (
            <li key={o.id}>
              <button type="button" className="nes-option" onClick={() => schedule(o)} disabled={!!busy} data-testid={`opportunity-option-${o.id}`}>
                {o.name}
                <span className="nes-option-meta">
                  {[o.brand_or_company, o.opportunity_type, o.status].filter(Boolean).map((t) => ` · ${String(t).replace(/_/g, ' ')}`).join('')}
                </span>
                {busy === o.id && <span className="nes-option-meta"> · scheduling…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="nes-error" role="alert">{error}</p>}
    </div>
  );
}

const KIND_LABEL = { career: 'Career move', relationship: 'Relationship move', chaos: 'Chaos move' };
const words = (v) => String(v || '').replace(/_/g, ' ');

function PitchStart({ showId, onCreated }) {
  const [pitches, setPitches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(null);
  const [error, setError] = useState(null);

  // One AI call per click, never on load.
  const pitch = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/episode-pitches`);
      setPitches(res.data?.pitches || []);
    } catch (err) {
      console.error('[NewEpisode] pitch failed:', err);
      setError(errorOf(err, 'Could not get pitches'));
    } finally {
      setLoading(false);
    }
  };

  const build = async (p, i) => {
    const body = buildEventFromPitch(p);
    if (!body || building !== null) return;
    setBuilding(i);
    setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events`, body);
      const id = res.data?.event?.id;
      if (id) onCreated(id);
      else setError('The event was created but no id came back.');
    } catch (err) {
      console.error('[NewEpisode] build from pitch failed:', err);
      setError(errorOf(err, 'Could not build the episode'));
    } finally {
      setBuilding(null);
    }
  };

  return (
    <div className="nes-panel" data-testid="start-surprise">
      <h2 className="nes-panel-title">Pitch me an episode</h2>
      <p className="nes-note">
        Prime Studios looks at Lala&apos;s state, the season, the Feed, the brands and the places, and pitches three setups. You choose which becomes canon.
      </p>
      <button type="button" className="nes-primary" onClick={pitch} disabled={loading} data-testid="pitch-go">
        {loading ? 'Pitching…' : pitches ? 'Pitch three more' : 'Pitch me three episodes'}
      </button>
      {error && <p className="nes-error" role="alert">{error}</p>}
      {pitches && pitches.length === 0 && !error && <p className="nes-note">No pitches came back. Try again.</p>}
      {pitches && pitches.length > 0 && (
        <ul className="nes-pitches">
          {pitches.map((p, i) => (
            <li key={`${p.title}-${i}`} className="nes-pitch" data-testid={`pitch-${i}`}>
              {p.kind && <span className="nes-pitch-kind">{KIND_LABEL[p.kind] || p.kind}</span>}
              <h3 className="nes-pitch-title">{p.title}</h3>
              <p className="nes-pitch-meta">
                {[p.category && words(p.category), p.format && words(p.format), p.venue?.name].filter(Boolean).join(' · ')}
              </p>
              <p className="nes-pitch-premise">{p.premise}</p>
              <dl className="nes-pitch-facts">
                <div><dt>Organizer</dt><dd>{p.organizer.name}{p.organizer.kind === 'brand' ? ' (brand)' : ''}</dd></div>
                {p.featured?.length > 0 && (
                  <div><dt>Featured</dt><dd>{p.featured.map((f) => `${f.display_name}${f.role ? ` (${f.role})` : ''}`).join(', ')}</dd></div>
                )}
                {p.opportunity && <div><dt>Opportunity</dt><dd>{p.opportunity}</dd></div>}
                {p.pressure && <div><dt>Pressure</dt><dd>{p.pressure}</dd></div>}
                {p.wildcard && <div><dt>Wildcard</dt><dd>{p.wildcard}</dd></div>}
              </dl>
              <button
                type="button" className="nes-primary" onClick={() => build(p, i)}
                disabled={building !== null} data-testid={`pitch-build-${i}`}
              >
                {building === i ? 'Building…' : 'Build this episode'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NewEpisodeStarter() {
  const { showId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const start = params.get('start');
  const openPackage = (eventId) => navigate(`/shows/${showId}/events/${eventId}`);
  const choose = (key) => setParams(key ? { start: key } : {});

  if (start === 'creator') {
    return (
      <div className="nes-creator">
        <button type="button" className="nes-back" onClick={() => choose(null)} data-testid="start-back">
          <ArrowLeft size={14} aria-hidden="true" /> All starting points
        </button>
        <Suspense fallback={<p className="nes-note">Loading Lala&apos;s Feed…</p>}>
          <SocialProfileGenerator chooseHost showId={showId} defaultFeedLayer="lalaverse" />
        </Suspense>
      </div>
    );
  }

  const Panel = { brand: BrandStart, world: WorldStart, opportunity: OpportunityStart, surprise: PitchStart }[start] || null;
  return (
    <div className="nes-page">
      <div className="nes-head">
        <Link to={`/shows/${showId}/world`} className="nes-back"><ArrowLeft size={14} aria-hidden="true" /> Producer Mode</Link>
        <h1 className="nes-title">New Episode</h1>
        <p className="nes-sub">What starts this episode? Each way in leads to the same Event Package.</p>
      </div>
      <ul className="nes-grid" data-testid="starting-points">
        {STARTING_POINTS.map(({ key, icon: Icon, title, text, soon }) => (
          <li key={key}>
            <button
              type="button" className={`nes-card ${start === key ? 'is-picked' : ''} ${soon ? 'is-soon' : ''}`}
              onClick={() => { if (!soon) choose(key); }} disabled={!!soon} aria-pressed={start === key}
              data-testid={`start-${key}-card`}
            >
              <Icon size={22} aria-hidden="true" className="nes-card-icon" />
              <span className="nes-card-title">{title}</span>
              <span className="nes-card-text">{text}</span>
              {soon && <span className="nes-card-soon">{soon}</span>}
            </button>
          </li>
        ))}
      </ul>
      {Panel && <Panel showId={showId} onCreated={openPackage} />}
    </div>
  );
}
