/**
 * EventDocuments — the Event Package's in-world documents beside the
 * invitation (Evoni, 2026-10-06; her Episode mock's "In-world documents":
 * one system, three looks). Lala's shopping list and her career plan, each
 * with the invitation's steps: Draft (written from the event), Edit (her
 * own lines), Redraft (a new draft; the old one is kept) and Approve.
 *
 * The shopping list is a handwritten note on lined pink paper: each line
 * the piece the look holds for it, ticked when Lala owns it, else its
 * coins, and the total against her balance. The career plan is a lavender
 * card: this event's goals, then her bigger career goals.
 *
 * Data: GET/POST/PUT /world/:showId/events/:eventId/documents
 * (lib/eventDocuments, src/services/eventDocumentsService.js). The
 * invitation keeps its place in 1. The Event.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, RefreshCw, Trash2, Wand2, X } from 'lucide-react';
import {
  getEventDocumentsApi, draftEventDocumentApi, editEventDocumentApi, approveEventDocumentApi,
  docState, shoppingLines, careerSections, documentByline,
} from '../../lib/eventDocuments';
import './EventDocuments.css';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';
const coins = (n) => Number(n || 0).toLocaleString();

const DOCS = [
  { type: 'shopping_list', title: 'Shopping list', from: 'From the look: the pieces to find, owned or to buy, the total against her coins' },
  { type: 'career_plan', title: 'Career plan', from: 'From the deal, this event and her active career goals' },
];

function ShoppingPaper({ doc, event, outfitPieces, balance }) {
  const { lines, total } = shoppingLines(doc, outfitPieces);
  return (
    <div className="evd-paper" data-testid="evd-shopping-paper">
      <span className="evd-tape" aria-hidden="true" />
      <div className="evd-paper-title">Lala&apos;s shopping list</div>
      <div className="evd-paper-by">{documentByline(event)}</div>
      <ul className="evd-paper-lines">
        {lines.map((l, i) => (
          <li key={`${l.slot}-${i}`} className={l.owned ? 'is-owned' : ''} data-testid={`evd-line-${l.slot}`}>
            <span className="evd-box" aria-hidden="true">{l.owned ? '✓' : ''}</span>
            <span className="evd-line-text">{l.label}</span>
            {l.piece && <span className="evd-line-cost">{l.owned ? '· owned' : `· 🪙 ${coins(l.cost)}`}</span>}
          </li>
        ))}
      </ul>
      <div className="evd-paper-total" data-testid="evd-shopping-total">
        Total 🪙 {coins(total)}{balance != null ? ` / ${coins(balance)} coins` : ''}
      </div>
      <div className="evd-paper-note">comfy enough to stand all night!!</div>
    </div>
  );
}

// What the deal expects of her at this event, from its terms (live, never
// part of the plan's own lines): a deliverable's format, due date and who
// it is owed to, and whether it is required.
const owedText = (d) => (d.owed_to === 'brand' ? 'for the brand' : 'for the host');

function CareerCard({ doc, deliverables = [] }) {
  const { thisEvent, biggerGoals } = careerSections(doc);
  const row = (i, n) => (
    <li key={`${i.slot}-${n}`}>
      <span className="evd-check" aria-hidden="true" />
      <span>{i.label}</span>
    </li>
  );
  return (
    <div className="evd-career" data-testid="evd-career-card">
      <div className="evd-career-head">
        <span className="evd-career-title">Career Plan</span>
      </div>
      {deliverables.length > 0 && (
        <>
          <div className="evd-career-label">Expected of her</div>
          <ul className="evd-career-list" data-testid="evd-career-deliverables">
            {deliverables.map((d) => (
              <li key={d.id} data-testid={`evd-deliverable-${d.id}`}>
                <span className="evd-check" aria-hidden="true" />
                <span>
                  {d.label}
                  <span className="evd-deliverable-detail">{[d.detail, owedText(d)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`evd-deliverable-tag${d.required ? ' is-required' : ''}`}>{d.required ? 'Required' : 'Optional'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="evd-career-label">This event</div>
      <ul className="evd-career-list">{thisEvent.length ? thisEvent.map(row) : <li className="evd-muted">No goals for this event</li>}</ul>
      <div className="evd-career-label">Bigger goals</div>
      <ul className="evd-career-list">{biggerGoals.length ? biggerGoals.map(row) : <li className="evd-muted">No active career goals yet</li>}</ul>
      <div className="evd-career-sign">one step at a time, L.</div>
    </div>
  );
}

function Editor({ type, doc, onCancel, onSave, saving }) {
  const [rows, setRows] = useState(() => (doc?.items || []).map((i) => ({ ...i })));
  const set = (n, patch) => setRows((r) => r.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  return (
    <div className="evd-editor" data-testid={`evd-editor-${type}`}>
      {rows.map((r, n) => (
        <div key={n} className="evd-editor-row">
          {type === 'career_plan' && (
            <select value={r.section || 'this_event'} onChange={(e) => set(n, { section: e.target.value })} aria-label="Section">
              <option value="this_event">This event</option>
              <option value="bigger_goals">Bigger goal</option>
            </select>
          )}
          <input value={r.label || ''} onChange={(e) => set(n, { label: e.target.value })} maxLength={200} aria-label={`Line ${n + 1}`} />
          <button type="button" className="evd-icon" onClick={() => setRows((x) => x.filter((_, i) => i !== n))} title="Remove line">
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      ))}
      <div className="evd-editor-actions">
        <button type="button" className="evd-link" onClick={() => setRows((x) => [...x, { label: '', slot: '', section: 'this_event' }])}>
          <Plus size={13} aria-hidden="true" /> Add a line
        </button>
        <span className="evd-grow" />
        <button type="button" className="evd-link" onClick={onCancel} disabled={saving}><X size={13} aria-hidden="true" /> Cancel</button>
        <button type="button" className="evd-save" onClick={() => onSave(rows)} disabled={saving || !rows.some((r) => (r.label || '').trim())}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function EventDocuments({ showId, eventId, event, outfitPieces = [], balance = null }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // `${type}:${action}`
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!showId || !eventId) return undefined;
    let cancelled = false;
    getEventDocumentsApi(showId, eventId)
      .then((d) => { if (!cancelled) { setDocs(d); setError(null); } })
      .catch((err) => {
        console.error('[EventDocuments] load failed:', err);
        if (!cancelled) setError(errorText(err));
      });
    return () => { cancelled = true; };
  }, [showId, eventId]);

  const act = useCallback(async (type, action, fn) => {
    setBusy(`${type}:${action}`);
    setError(null);
    try {
      const doc = await fn();
      setDocs((d) => ({ ...(d || {}), [type]: doc }));
      if (action === 'edit') setEditing(null);
    } catch (err) {
      console.error(`[EventDocuments] ${action} ${type} failed:`, err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="evd" data-testid="event-documents">
      <p className="evd-intro">
        One system, three looks. Each document fills itself from the event, goes through the same steps
        (Draft, Edit, Redraft, Approve). Once approved, Start Episode puts it on the episode&apos;s lists: the
        shopping list as her wardrobe list, the career plan&apos;s &ldquo;This event&rdquo; lines as her goals.
        The invitation is in <a href="#epp-sec-invitation">1. The Event</a>.
      </p>
      {error && <p className="evd-error" role="alert">{error}</p>}
      {!docs && !error && <p className="evd-muted">Loading documents…</p>}
      {docs && (
        <div className="evd-grid">
          {DOCS.map(({ type, title, from }) => {
            const doc = docs[type];
            const state = docState(doc);
            const isBusy = (a) => busy === `${type}:${a}`;
            return (
              // Not drafted yet: one line, its title, what it comes from and
              // Draft (Evoni's review, item 6); the paper appears once drafted.
              <article key={type} className={`evd-card${doc ? '' : ' is-blank'}`} data-testid={`evd-${type}`}>
                <h3 className="evd-title">{title}</h3>
                <p className="evd-from">{from}</p>
                <div className="evd-stage">
                  {doc && editing === type && (
                    <Editor
                      type={type} doc={doc} saving={isBusy('edit')}
                      onCancel={() => setEditing(null)}
                      onSave={(rows) => act(type, 'edit', () => editEventDocumentApi(showId, eventId, type, rows))}
                    />
                  )}
                  {doc && editing !== type && type === 'shopping_list' && (
                    <ShoppingPaper doc={doc} event={event} outfitPieces={outfitPieces} balance={balance} />
                  )}
                  {doc && editing !== type && type === 'career_plan' && <CareerCard doc={doc} deliverables={docs.deliverables || []} />}
                </div>
                <div className="evd-actions">
                  <span className={`evd-state is-${state.key}`} data-testid={`evd-state-${type}`}>{state.label}</span>
                  {!doc ? (
                    <button type="button" className="evd-link" onClick={() => act(type, 'draft', () => draftEventDocumentApi(showId, eventId, type))} disabled={!!busy}>
                      {isBusy('draft') ? <Loader2 size={13} className="evd-spin" aria-hidden="true" /> : <Wand2 size={13} aria-hidden="true" />} Draft
                    </button>
                  ) : (
                    <>
                      <button type="button" className="evd-link" onClick={() => setEditing(type)} disabled={!!busy || editing === type}>
                        <Pencil size={13} aria-hidden="true" /> Edit
                      </button>
                      <button type="button" className="evd-link" onClick={() => act(type, 'draft', () => draftEventDocumentApi(showId, eventId, type))} disabled={!!busy}>
                        {isBusy('draft') ? <Loader2 size={13} className="evd-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />} Redraft
                      </button>
                      {doc.status !== 'approved' && (
                        <button type="button" className="evd-link" onClick={() => act(type, 'approve', () => approveEventDocumentApi(showId, eventId, type))} disabled={!!busy || editing === type}>
                          <Check size={13} aria-hidden="true" /> Approve
                        </button>
                      )}
                    </>
                  )}
                </div>
                {doc && (
                  <p className="evd-meta" data-testid={`evd-meta-${type}`}>
                    Version {doc.version}{doc.source === 'edited' ? ' · edited' : ''}
                    {doc.history?.length ? ` · ${doc.history.length} earlier kept` : ''}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
