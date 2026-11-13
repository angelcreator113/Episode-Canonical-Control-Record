/**
 * Admin › Overview (Evoni, 2026-11-13): what is waiting and what is not
 * answering, in one place, built from reads the page already makes.
 *
 *   The Pulse           the Review count and scheduled posts (lib/pulseSummary)
 *   Security & Access   the Audit Log's entry count and the recent refusals
 *
 * A read that failed says so, with Retry, and is never shown as a number:
 * "0" here means the server answered and there is nothing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';
import apiClient from '../../services/api';
import { loadPulseSummary } from '../../lib/pulseSummary';
import AdminShowGate from './AdminShowGate';

const failedText = (err) => (err?.response?.status ? `the server answered ${err.response.status}` : 'no answer from the server');

function Row({ label, state, to, linkLabel, testId }) {
  return (
    <li className="adm-ov-row" data-testid={testId}>
      <span className="adm-ov-label">{label}</span>
      {state.status === 'loading' && <span className="adm-ov-value is-loading">Loading…</span>}
      {state.status === 'ok' && <span className="adm-ov-value">{state.value}{state.note && <span className="adm-ov-note"> {state.note}</span>}</span>}
      {state.status === 'failed' && (
        <span className="adm-ov-value is-failed" role="alert"><AlertTriangle size={14} aria-hidden="true" /> Could not be loaded ({state.why})</span>
      )}
      <Link className="adm-ov-link" to={to}>{linkLabel}</Link>
    </li>
  );
}

const LOADING = { status: 'loading' };

/** The Pulse rows for one show. A count whose reads failed is not shown as a number. */
function PulseRows({ showId, version }) {
  const [summary, setSummary] = useState(null);
  const [failure, setFailure] = useState(null);
  useEffect(() => {
    let alive = true;
    setSummary(null); setFailure(null);
    loadPulseSummary(showId)
      .then((s) => { if (alive) setSummary(s); })
      .catch((err) => { console.error('[AdminOverview] the Pulse summary could not be read:', err?.message); if (alive) setFailure(err); });
    return () => { alive = false; };
  }, [showId, version]);

  const failed = summary?.failed || [];
  const whole = failure ? { status: 'failed', why: failedText(failure) } : null;
  const partial = failed.length ? { status: 'failed', why: `${failed.length} of 9 reads failed: ${failed.join(', ')}` } : null;
  const review = whole || partial || (summary ? { status: 'ok', value: summary.reviewCount, note: summary.reviewCount === 0 ? 'Nothing waiting' : 'waiting for you' } : LOADING);
  const postsFailed = failed.some((f) => f === 'drafts' || f === 'episode posts');
  const scheduled = whole || (postsFailed ? { status: 'failed', why: 'the drafts could not be read' } : null)
    || (summary ? { status: 'ok', value: summary.stats.scheduled, note: summary.stats.today ? `${summary.stats.today} today` : '' } : LOADING);
  return (
    <>
      <Row testId="adm-ov-review" label="Waiting in Review" state={review} to="/admin?tab=pulse&sub=review" linkLabel="Open Review" />
      <Row testId="adm-ov-scheduled" label="Scheduled posts" state={scheduled} to="/admin?tab=pulse&sub=calendar" linkLabel="Open the calendar" />
    </>
  );
}

export default function AdminOverview() {
  const [version, setVersion] = useState(0);
  const [audit, setAudit] = useState(LOADING);
  const [refusals, setRefusals] = useState(LOADING);

  const load = useCallback(() => {
    let alive = true;
    setAudit(LOADING); setRefusals(LOADING);
    apiClient.get('/api/v1/audit-logs?limit=1&offset=0')
      .then((res) => { if (alive) setAudit({ status: 'ok', value: res.data?.pagination?.total ?? 0, note: 'entries recorded' }); })
      .catch((err) => { console.error('[AdminOverview] the audit log could not be read:', err?.message); if (alive) setAudit({ status: 'failed', why: failedText(err) }); });
    apiClient.get('/api/v1/admin/rate-limit-refusals')
      .then((res) => { if (alive) setRefusals({ status: 'ok', value: (res.data?.refusals || []).length, note: 'since the server last started' }); })
      .catch((err) => { console.error('[AdminOverview] the refusals could not be read:', err?.message); if (alive) setRefusals({ status: 'failed', why: failedText(err) }); });
    return () => { alive = false; };
  }, []);
  useEffect(() => load(), [load, version]);

  return (
    <div className="adm-ov" data-testid="admin-overview">
      <div className="adm-ov-head">
        <h2 className="adm-ov-title">Overview</h2>
        <button type="button" className="adm-ov-retry" onClick={() => setVersion((v) => v + 1)} data-testid="adm-ov-refresh">
          <RotateCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      <section className="adm-ov-card" aria-labelledby="adm-ov-pulse">
        <h3 id="adm-ov-pulse">The Pulse</h3>
        <AdminShowGate>
          {(showId) => <ul className="adm-ov-rows"><PulseRows showId={showId} version={version} /></ul>}
        </AdminShowGate>
      </section>

      <section className="adm-ov-card" aria-labelledby="adm-ov-security">
        <h3 id="adm-ov-security">Security &amp; Access</h3>
        <ul className="adm-ov-rows">
          <Row testId="adm-ov-audit" label="Audit Log" state={audit} to="/admin/audit" linkLabel="Open the Audit Log" />
          <Row testId="adm-ov-refusals" label="Sign-in and rate-limit refusals" state={refusals} to="/admin?tab=security" linkLabel="Open Security & Access" />
        </ul>
      </section>

      <section className="adm-ov-card" aria-labelledby="adm-ov-site">
        <h3 id="adm-ov-site">Website &amp; Show Settings</h3>
        <p className="adm-ov-links">
          <Link className="adm-ov-link" to="/admin?tab=website">Website images and video</Link>
          <Link className="adm-ov-link" to="/admin?tab=show-settings">Show settings</Link>
        </p>
      </section>
    </div>
  );
}
