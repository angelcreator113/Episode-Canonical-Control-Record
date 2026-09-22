/**
 * EventPackagePage.jsx — Event Package, piece 1 (Task #1642)
 *
 * Route: /shows/:showId/events/:eventId
 *
 * Six read-only summary sections (Basics, People, Place, Invitation,
 * Style & Deliverables, Review) plus a readiness count, and three actions:
 * Change Host, Edit details (opens the existing WorldAdmin editor via the
 * same ?tab=events&event=<id> deep link Task #1628/#1630 already use),
 * and Start Episode (the existing generate-episode action, gated on
 * readiness). Editing itself still happens in the existing editor —
 * later pieces replace these sections one at a time.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, UserPlus, Pencil, PlayCircle, Lock, AlertCircle,
  Search, X, CheckCircle2,
} from 'lucide-react';
import api from '../services/api';
import { computeEventReadiness, calcEventDifficulty, eventDifficultyLabel, resolveEventVenueAndDate } from '../utils/eventReadiness';
import './EventPackagePage.css';

function fmtLabel(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EventPackagePage() {
  const { showId, eventId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState(null);

  const [hostPickerOpen, setHostPickerOpen] = useState(false);
  const [hostSearch, setHostSearch] = useState('');
  const [hostResults, setHostResults] = useState([]);
  const [hostSearching, setHostSearching] = useState(false);
  const [hostSaving, setHostSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${eventId}`);
      setData(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.error || err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [showId, eventId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  // Debounced creator search for the Change Host picker.
  useEffect(() => {
    if (!hostPickerOpen) return;
    setHostSearching(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (hostSearch.trim()) qs.set('search', hostSearch.trim());
      qs.set('limit', '20');
      api.get(`/api/v1/social-profiles?${qs.toString()}`)
        .then((res) => setHostResults(res.data?.profiles || []))
        .catch(() => setHostResults([]))
        .finally(() => setHostSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [hostPickerOpen, hostSearch]);

  if (loading) {
    return (
      <div className="epp-page epp-center">
        <div className="epp-spinner" aria-label="Loading event" />
      </div>
    );
  }

  if (loadError || !data?.event) {
    return (
      <div className="epp-page epp-center">
        <AlertCircle size={28} color="var(--lala-danger, #B84D2E)" />
        <p className="epp-error">{loadError || 'Event not found'}</p>
        <button className="epp-btn epp-btn-secondary" onClick={() => navigate(`/shows/${showId}/world?tab=events`)}>
          <ArrowLeft size={16} /> Back to Events
        </button>
      </div>
    );
  }

  const { event, sourceProfile, sceneSet, invitationAsset, usedInEpisode } = data;
  const used = !!event.used_in_episode_id;
  const { checks, allReady } = computeEventReadiness(event);
  const venueDate = resolveEventVenueAndDate(event);
  const difficulty = calcEventDifficulty(event);
  const diffLabel = eventDifficultyLabel(difficulty);

  const guestList = event.canon_consequences?.automation?.guest_profiles || [];
  const outfitPieces = Array.isArray(event.outfit_pieces) ? event.outfit_pieces : [];
  const requirementEntries = event.requirements && typeof event.requirements === 'object'
    ? Object.entries(event.requirements).filter(([, v]) => v !== null && v !== undefined && v !== '')
    : [];

  const costLine = () => {
    if (event.is_paid) {
      return `Paid appearance: +${event.payment_amount || 0} coins when the episode is finalized`;
    }
    if (!event.cost_coins || event.cost_coins <= 0) {
      return 'Free — no cost to attend';
    }
    return `Attendance cost: ${event.cost_coins} coins — deducted when the episode is finalized`;
  };

  const openEditor = () => navigate(`/shows/${showId}/world?tab=events&event=${eventId}`);

  const selectHost = async (profile) => {
    setHostSaving(true);
    try {
      await api.put(`/api/v1/world/${showId}/events/${eventId}`, {
        source_profile_id: profile.id,
        host: profile.display_name || profile.handle || null,
      });
      setHostPickerOpen(false); setHostSearch(''); setHostResults([]);
      setToast(`Host changed to ${profile.display_name || profile.handle}`);
      await load();
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to change host');
    } finally {
      setHostSaving(false);
    }
  };

  const handleStartEpisode = async () => {
    if (!allReady || used || starting) return;
    setStarting(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/generate-episode`, { draft_script: false });
      if (res.data.success) {
        const ep = res.data.data.episode;
        if (ep?.id) navigate(`/episodes/${ep.id}`);
        else setToast('Episode created but no episode id was returned.');
      } else {
        setToast(res.data.error || 'Failed to start episode');
      }
    } catch (err) {
      setToast(err.response?.data?.error || err.message || 'Failed to start episode');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="epp-page">
      <div className="epp-header">
        <button className="epp-back" onClick={() => navigate(`/shows/${showId}/world?tab=events`)}>
          <ArrowLeft size={16} /> Events
        </button>
        <h1 className="epp-title">{event.name}</h1>
        <span className={`epp-status-badge epp-status-${event.status || 'draft'}`}>{fmtLabel(event.status)}</span>
      </div>

      {toast && <div className="epp-toast">{toast}</div>}

      {used && (
        <div className="epp-used-banner">
          <Lock size={16} />
          Used by Episode {usedInEpisode?.episode_number ?? '—'}{usedInEpisode?.title ? `: ${usedInEpisode.title}` : ''}
        </div>
      )}

      <div className="epp-sections">
        <section className="epp-section">
          <h2 className="epp-section-title">Basics</h2>
          <dl className="epp-fields">
            <div><dt>Name</dt><dd>{event.name}</dd></div>
            <div>
              <dt>Date &amp; time</dt>
              <dd>
                {venueDate.eventDate ? `${venueDate.eventDate}${venueDate.eventTime ? ` · ${venueDate.eventTime}` : ''}` : 'Not set'}
                {(venueDate.eventDateFromSavedCopy || venueDate.eventTimeFromSavedCopy) && (
                  <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
                )}
              </dd>
            </div>
            <div><dt>Brand</dt><dd>{event.host_brand || 'Not set'}</dd></div>
            <div><dt>Category</dt><dd>{fmtLabel(event.category)}</dd></div>
            <div><dt>Format</dt><dd>{fmtLabel(event.format)}</dd></div>
          </dl>
        </section>

        <section className="epp-section">
          <div className="epp-section-header">
            <h2 className="epp-section-title">People</h2>
            {!used && (
              <button className="epp-btn epp-btn-small" onClick={() => setHostPickerOpen(true)}>
                <UserPlus size={14} /> Change Host
              </button>
            )}
          </div>
          <div className="epp-host">
            <User size={18} />
            {sourceProfile ? (
              <div>
                <div className="epp-host-name">{sourceProfile.display_name || sourceProfile.handle}</div>
                {sourceProfile.handle && <div className="epp-host-handle">@{String(sourceProfile.handle).replace(/^@/, '')}</div>}
              </div>
            ) : (
              <div>
                <div className="epp-host-name">{event.host || 'No host set'}</div>
                <div className="epp-host-unlinked">not linked</div>
              </div>
            )}
          </div>
          <div className="epp-guests">
            <div className="epp-fields-label">Guests</div>
            {guestList.length ? (
              <ul className="epp-guest-list">
                {guestList.map((g, i) => (
                  <li key={g.profile_id || g.handle || i}>{g.display_name || g.handle}</li>
                ))}
              </ul>
            ) : <div className="epp-empty">No guests yet</div>}
          </div>
        </section>

        <section className="epp-section">
          <h2 className="epp-section-title">Place</h2>
          <dl className="epp-fields">
            <div>
              <dt>Venue</dt>
              <dd>
                {venueDate.venueName || 'Not set'}
                {venueDate.venueNameFromSavedCopy && (
                  <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                {venueDate.venueAddress || 'Not set'}
                {venueDate.venueAddressFromSavedCopy && (
                  <span className="epp-saved-copy" title="Not yet in the event's own fields — shown from its saved automation copy">saved copy</span>
                )}
              </dd>
            </div>
            <div><dt>Scene set</dt><dd>{sceneSet?.name || 'Not set'}</dd></div>
          </dl>
        </section>

        <section className="epp-section">
          <h2 className="epp-section-title">Invitation</h2>
          {invitationAsset ? (
            <div className="epp-invitation">
              {invitationAsset.s3_url_processed && (
                <img className="epp-invitation-preview" src={invitationAsset.s3_url_processed} alt="Invitation preview" />
              )}
              <div className="epp-fields-label">Status: {fmtLabel(invitationAsset.approval_status || 'pending')}</div>
            </div>
          ) : <div className="epp-empty">No invitation yet</div>}
        </section>

        <section className="epp-section">
          <h2 className="epp-section-title">Style &amp; Deliverables</h2>
          <dl className="epp-fields">
            <div><dt>Dress code</dt><dd>{event.dress_code || 'Not set'}</dd></div>
            <div><dt>Outfit</dt><dd>{outfitPieces.length ? `${outfitPieces.length} piece${outfitPieces.length === 1 ? '' : 's'} chosen` : 'Not chosen'}</dd></div>
            <div>
              <dt>Requirements</dt>
              <dd>
                {requirementEntries.length ? (
                  <ul className="epp-requirements-list">
                    {requirementEntries.map(([k, v]) => <li key={k}>{fmtLabel(k)}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>)}
                  </ul>
                ) : 'None set'}
              </dd>
            </div>
            <div><dt>Prestige</dt><dd>{event.prestige ?? 'Not set'}</dd></div>
            <div><dt>Strictness</dt><dd>{event.strictness ?? 'Not set'}</dd></div>
            <div><dt>Cost</dt><dd>{costLine()}</dd></div>
          </dl>
        </section>

        <section className="epp-section">
          <h2 className="epp-section-title">Review</h2>
          <dl className="epp-fields">
            <div><dt>Career tier</dt><dd>{event.career_tier ?? 'Not set'}</dd></div>
            <div>
              <dt>Difficulty</dt>
              <dd>
                <span className="epp-difficulty-chip" style={{ color: diffLabel.color, background: diffLabel.bg }}>
                  {diffLabel.text} ({difficulty})
                </span>
              </dd>
            </div>
          </dl>
          <div className="epp-readiness">
            <span className={`epp-readiness-label ${allReady ? 'is-ready' : ''}`}>{allReady ? 'READY' : 'PRE-FLIGHT'}</span>
            {checks.map((c) => (
              <span key={c.key} className={`epp-chip ${c.ok ? 'is-ok' : ''}`} title={c.ok ? `${c.label} is set` : `${c.label} not set yet`}>
                {c.icon} {c.label} {c.ok ? '✓' : '⚠'}
              </span>
            ))}
          </div>
        </section>
      </div>

      {!used && (
        <div className="epp-actions">
          <button className="epp-btn epp-btn-secondary" onClick={openEditor}>
            <Pencil size={16} /> Edit details
          </button>
          <button
            className="epp-btn epp-btn-primary"
            disabled={!allReady || starting}
            title={allReady ? 'Start the episode' : 'Not ready yet — see Review below'}
            onClick={handleStartEpisode}
          >
            <PlayCircle size={16} /> {starting ? 'Starting…' : 'Start Episode'}
          </button>
        </div>
      )}

      {hostPickerOpen && (
        <div className="epp-modal-backdrop" onClick={() => setHostPickerOpen(false)}>
          <div className="epp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="epp-modal-header">
              <h3>Change Host</h3>
              <button className="epp-icon-btn" onClick={() => setHostPickerOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="epp-modal-search">
              <Search size={14} />
              <input
                autoFocus
                placeholder="Search creators…"
                value={hostSearch}
                onChange={(e) => setHostSearch(e.target.value)}
              />
            </div>
            <div className="epp-modal-results">
              {hostSearching ? (
                <div className="epp-empty">Searching…</div>
              ) : hostResults.length ? (
                hostResults.map((p) => (
                  <button key={p.id} className="epp-modal-result" disabled={hostSaving} onClick={() => selectHost(p)}>
                    <div>
                      <div className="epp-host-name">{p.display_name || p.handle}</div>
                      {p.handle && <div className="epp-host-handle">@{String(p.handle).replace(/^@/, '')}</div>}
                    </div>
                    {sourceProfile?.id === p.id && <CheckCircle2 size={16} />}
                  </button>
                ))
              ) : (
                <div className="epp-empty">No creators found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
