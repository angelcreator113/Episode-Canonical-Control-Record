/**
 * Reopen terms (Evoni's Reopen terms ruling, docs/EVENT_EPISODE_FLOW.md
 * §8(cc), 2026-09-30; Task #2378), on the Event Package under the lock
 * banner.
 *
 *   Locked:    "Reopen terms" when the server's test passes
 *              (GET .../terms/reopen-eligibility), else why not, briefly.
 *              Reopening asks for confirmation first.
 *   Reopened:  the Terms editors work again (the page passes locked=false to
 *              EventTermsSection); "Save and relock" relocks and the server
 *              rebuilds what Start Episode built from the terms.
 *   Saved:     regeneration is offered, not forced: "Regenerate invitation" /
 *              "Regenerate script", with the reminder when the terms mention
 *              money.
 *
 * The offer lives in the page (props offer / onOffer): the page's reload
 * after a relock unmounts this panel, and local state would be lost.
 */
import { useState, useEffect, useCallback } from 'react';
import { Unlock, Lock, AlertTriangle, X, RefreshCw } from 'lucide-react';
import api from '../../services/api';

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

function whoWhen(reopen) {
  const who = reopen?.by?.name || 'Evoni';
  const at = reopen?.at ? new Date(reopen.at) : null;
  const when = at && !Number.isNaN(at.getTime())
    ? at.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
  return when ? `${who}, ${when}` : who;
}

export default function TermsReopenPanel({
  showId, eventId, locked, reopen, episode, offer, onOffer, onChanged, onRegenerateInvitation, onToast,
}) {
  const [eligibility, setEligibility] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [scriptBusy, setScriptBusy] = useState(false);

  useEffect(() => {
    if (!locked || reopen) return undefined;
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/events/${eventId}/terms/reopen-eligibility`)
      .then((res) => { if (!cancelled) setEligibility(res.data); })
      .catch((err) => {
        console.error('[TermsReopenPanel] eligibility check failed:', err);
        if (!cancelled) setEligibility({ eligible: false, reasons: [{ code: 'CHECK_FAILED', message: 'Could not check whether the terms can be reopened.' }] });
      });
    return () => { cancelled = true; };
  }, [showId, eventId, locked, reopen]);

  const handleReopen = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/world/${showId}/events/${eventId}/terms/reopen`, { confirm: true });
      setConfirmOpen(false);
      onOffer?.(null);
      onToast?.('Terms reopened. Edit them, then Save and relock.');
      onChanged?.();
    } catch (err) {
      console.error('[TermsReopenPanel] reopen failed:', err);
      setError(errorMessage(err, 'Could not reopen the terms.'));
    } finally {
      setBusy(false);
    }
  }, [showId, eventId, onChanged, onOffer, onToast]);

  const handleRelock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/terms/relock`, {});
      onOffer?.({ ...res.data.regenerate, episodeId: res.data.relocked?.episode_id || episode?.id || null });
      onToast?.('Terms saved and relocked.');
      onChanged?.();
    } catch (err) {
      console.error('[TermsReopenPanel] relock failed:', err);
      setError(errorMessage(err, 'Could not save and relock the terms.'));
    } finally {
      setBusy(false);
    }
  }, [showId, eventId, episode, onChanged, onOffer, onToast]);

  const handleRegenerateScript = useCallback(async () => {
    const episodeId = offer?.episodeId;
    if (!episodeId) return;
    setScriptBusy(true);
    const post = (confirmOverwrite) => api.post(`/api/v1/world/${showId}/events/${eventId}/generate-script`, {
      episode_id: episodeId, ...(confirmOverwrite ? { confirmOverwrite: true } : {}),
    });
    try {
      try {
        await post(false);
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.code === 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED') {
          if (!window.confirm('This episode already has a script. Replace it?')) return;
          await post(true);
        } else {
          throw err;
        }
      }
      onOffer?.({ ...offer, script: { ...offer.script, offered: false } });
      onToast?.('Script regenerated.');
    } catch (err) {
      console.error('[TermsReopenPanel] script regenerate failed:', err);
      onToast?.(errorMessage(err, 'Script regeneration failed.'));
    } finally {
      setScriptBusy(false);
    }
  }, [showId, eventId, offer, onOffer, onToast]);

  const regenInvitation = () => {
    onRegenerateInvitation?.();
    onOffer?.({ ...offer, invitation: { ...offer.invitation, offered: false } });
  };

  const showOffer = !!offer && (offer.invitation?.offered || offer.script?.offered);

  if (!locked && !showOffer) return null;

  return (
    <div className="epp-reopen" data-testid="terms-reopen">
      {locked && reopen && (
        <div className="epp-reopen-row" data-testid="terms-reopened">
          <Unlock size={15} aria-hidden="true" />
          <span className="epp-reopen-text">
            <strong>Terms reopened</strong> ({whoWhen(reopen)}). Edit them in Terms below, then save. Finalize and Complete wait until they are relocked.
          </span>
          <button type="button" className="epp-btn epp-btn-primary epp-btn-small" onClick={handleRelock} disabled={busy} data-testid="terms-relock">
            <Lock size={13} aria-hidden="true" /> {busy ? 'Saving…' : 'Save and relock'}
          </button>
        </div>
      )}

      {locked && !reopen && !eligibility && (
        <p className="epp-reopen-why" data-testid="terms-reopen-checking">Checking whether these terms can be reopened…</p>
      )}

      {locked && !reopen && eligibility && (
        eligibility.eligible ? (
          <div className="epp-reopen-row">
            <span className="epp-reopen-text">The episode is still a draft, so these terms can be reopened.</span>
            <button type="button" className="epp-btn epp-btn-small" onClick={() => { setError(null); setConfirmOpen(true); }} data-testid="terms-reopen-button">
              <Unlock size={13} aria-hidden="true" /> Reopen terms
            </button>
          </div>
        ) : (
          <p className="epp-reopen-why" data-testid="terms-reopen-why">
            Can&apos;t reopen the terms: {(eligibility.reasons || []).map((r) => r.message).join(' ')}
          </p>
        )
      )}

      {error && !confirmOpen && <p className="epp-reopen-error" role="alert">{error}</p>}

      {showOffer && (
        <div className="epp-reopen-offer" data-testid="terms-regenerate-offer">
          <div className="epp-reopen-offer-head">
            <RefreshCw size={14} aria-hidden="true" />
            <span>Terms saved. Regenerate what quotes them? Optional.</span>
            <button type="button" className="epp-icon-btn" aria-label="Dismiss" onClick={() => onOffer?.(null)} data-testid="terms-offer-dismiss">
              <X size={15} />
            </button>
          </div>
          {offer.invitation?.offered && (
            <div className="epp-reopen-offer-item">
              {offer.invitation.reminder && (
                <p className="epp-reopen-reminder" data-testid="reminder-invitation">
                  <AlertTriangle size={13} aria-hidden="true" /> {offer.invitation.reminder}
                </p>
              )}
              <button type="button" className="epp-btn epp-btn-small" onClick={regenInvitation} data-testid="regenerate-invitation">
                Regenerate invitation
              </button>
            </div>
          )}
          {offer.script?.offered && (
            <div className="epp-reopen-offer-item">
              {offer.script.reminder && (
                <p className="epp-reopen-reminder" data-testid="reminder-script">
                  <AlertTriangle size={13} aria-hidden="true" /> {offer.script.reminder}
                </p>
              )}
              <button type="button" className="epp-btn epp-btn-small" onClick={handleRegenerateScript} disabled={scriptBusy} data-testid="regenerate-script">
                {scriptBusy ? 'Regenerating…' : 'Regenerate script'}
              </button>
            </div>
          )}
        </div>
      )}

      {confirmOpen && (
        <div className="epp-modal-backdrop" onClick={() => { if (!busy) setConfirmOpen(false); }}>
          <div className="epp-modal" role="dialog" aria-label="Reopen terms" data-testid="terms-reopen-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="epp-modal-header">
              <h3><Unlock size={15} aria-hidden="true" /> Reopen these terms?</h3>
              <button type="button" className="epp-icon-btn" onClick={() => setConfirmOpen(false)} aria-label="Close" disabled={busy}>
                <X size={16} />
              </button>
            </div>
            <div className="epp-reopen-confirm-body">
              <p>
                The access requirements, deliverables, restrictions, compensation and costs become editable again.
                {episode?.episode_number != null ? ` Episode ${episode.episode_number} stays linked` : ' The episode stays linked'}, and Finalize and Complete wait until you save.
              </p>
              <p>
                Save and relock rebuilds the brief&apos;s terms, the deliverable tasks, the estimated money and the affordability warning, and records the reopen in the event&apos;s history.
              </p>
              {error && <p className="epp-reopen-error" role="alert">{error}</p>}
            </div>
            <div className="epp-start-confirm-actions">
              <button type="button" className="epp-btn epp-btn-secondary" onClick={() => setConfirmOpen(false)} disabled={busy} data-testid="terms-reopen-cancel">
                Cancel
              </button>
              <button type="button" className="epp-btn epp-btn-primary" onClick={handleReopen} disabled={busy} data-testid="terms-reopen-confirm-button">
                <Unlock size={15} aria-hidden="true" /> {busy ? 'Reopening…' : 'Reopen terms'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
