/**
 * EventDocuments — the Event Package's in-world documents beside the
 * invitation (Evoni, 2026-10-06; her Episode mock's "In-world documents":
 * one system, three looks — the invitation, shown in 1. The Event, and the
 * two documents here). Lala's shopping list and her career plan, each
 * with the invitation's steps: Draft (written from the event), Edit (her
 * own lines), Redraft (a new draft; the old one is kept) and Approve.
 *
 * The shopping list is a handwritten note on lined pink paper: each line
 * the piece the look holds for it, ticked when Lala owns it, else its
 * coins, and the total against her balance. The career plan is a lavender
 * card: this event's goals, then her bigger career goals.
 *
 * Approving one also draws it as an overlay image (Evoni, 2026-10-07:
 * "i want both the shopping list and career list and invitations as
 * overlays"); the card shows it, or Make overlay when an approved one has
 * none. Not placed on a beat.
 *
 * Redraft is done at once, with "Redrafted the shopping list · Undo" for a
 * few seconds (useUndo; Evoni, 2026-10-23, undo instead of confirm). Undo
 * restores the version it replaced from history (2026-10-24; it used to
 * re-save its lines through Edit), and approves it again when it was
 * approved (which draws the overlay again, with Canvas, at no cost).
 *
 * "Look changed — redraft the list?" (Evoni, 2026-10-23): since 2026-10-24
 * the list records the look it was drafted from (look_key) and the server
 * answers look_changed, so every device agrees (it was kept per browser
 * tab). Keep saves the current look as the list's own.
 *
 * Also (2026-10-24): re-roll one line; History with Restore; a note; the
 * amount check on each version; Redraft within budget when the look costs
 * more than she has; pieces from her own closet under a line; the career
 * plan's goal / optional, goal links and the lines the event's goal limit
 * will not carry into the episode.
 *
 * Data: GET/POST/PUT /world/:showId/events/:eventId/documents
 * (lib/eventDocuments, src/services/eventDocumentsService.js). The
 * invitation keeps its place in 1. The Event.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, History, Image as ImageIcon, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Shirt, Trash2, Wand2, X } from 'lucide-react';
import {
  getEventDocumentsApi, draftEventDocumentApi, editEventDocumentApi, approveEventDocumentApi,
  restoreEventDocumentApi, redraftEventDocumentLineApi, keepShoppingListLookApi,
  docState, docOverlay, shoppingLines, careerSections, documentByline, planLeftOut, amountNote, lineOfSlot,
} from '../../lib/eventDocuments';
import UndoNotice from './UndoNotice';
import { useUndo } from './useUndo';
import { saveErrorMessage } from '../../utils/eventSaveVersion';
import './EventDocuments.css';

const errorText = (err) => saveErrorMessage(err, 'Something went wrong');
const coins = (n) => Number(n || 0).toLocaleString();

const DOCS = [
  { type: 'shopping_list', title: 'Shopping list', from: 'From the look: the pieces to find, and what the ones still to buy cost' },
  { type: 'career_plan', title: 'Career plan', from: 'From the deal, this event and her active career goals' },
];

// A to-do list (Evoni, 2026-10-11): she crosses lines off in the show, so the
// paper never ticks or strikes a line because a piece is owned, and shows no
// balance; a piece still to buy keeps its coins, and the total adds them.
// A line's own re-roll (2026-10-24): one line re-worded, the rest kept.
function LineRedraft({ onRedraft, busy, label }) {
  if (!onRedraft) return null;
  return (
    <button type="button" className="evd-line-redraft" onClick={onRedraft} disabled={!!busy} title="New words for this line" aria-label={`New words for: ${label}`}>
      {busy ? <Loader2 size={12} className="evd-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />}
    </button>
  );
}

function ShoppingPaper({ doc, event, outfitPieces, closet = {}, onRedraftLine = null, lineBusy = null }) {
  const { lines, total } = shoppingLines(doc, outfitPieces);
  const items = doc?.items || [];
  return (
    <div className="evd-paper" data-testid="evd-shopping-paper">
      <span className="evd-tape" aria-hidden="true" />
      <div className="evd-paper-title">Lala&apos;s shopping list</div>
      <div className="evd-paper-by">{documentByline(event)}</div>
      <ul className="evd-paper-lines">
        {lines.map((l, i) => {
          // The first lines are the list's own items, in order; any after
          // them are look pieces no line names (shoppingLines).
          const own = i < items.length;
          const lineSlot = lineOfSlot(l.slot);
          const fromCloset = own && lineSlot && !(l.piece && l.owned) ? (closet[lineSlot] || []) : [];
          return (
            <li key={`${l.slot}-${i}`} data-testid={`evd-line-${l.slot}`}>
              <span className="evd-box" aria-hidden="true" />
              <span className="evd-line-text">
                {l.label}
                {fromCloset.length > 0 && (
                  <span className="evd-closet" data-testid={`evd-closet-${l.slot}`}>
                    In her closet: {fromCloset.map((p) => p.name).join(', ')}
                  </span>
                )}
              </span>
              {l.piece && !l.owned && l.cost > 0 && <span className="evd-line-cost">· 🪙 {coins(l.cost)}</span>}
              {own && <LineRedraft onRedraft={onRedraftLine ? () => onRedraftLine(i) : null} busy={lineBusy === i} label={l.label} />}
            </li>
          );
        })}
      </ul>
      <div className="evd-paper-total" data-testid="evd-shopping-total">
        Total 🪙 {coins(total)}
      </div>
      {/* The list's own note when it has one (no line written in for her; the Wardrobe shopping list, 2026-10-11). */}
      {typeof doc?.note === 'string' && doc.note.trim() && <div className="evd-paper-note" data-testid="evd-paper-note">{doc.note.trim()}</div>}
    </div>
  );
}

// What the deal expects of her at this event, from its terms (live, never
// part of the plan's own lines): a deliverable's format, due date and who
// it is owed to, and whether it is required.
const owedText = (d) => (d.owed_to === 'brand' ? 'for the brand' : 'for the host');

function CareerCard({ doc, deliverables = [], goals = [], dropped = [], onRedraftLine = null, lineBusy = null }) {
  const { thisEvent, biggerGoals } = careerSections(doc);
  const items = doc?.items || [];
  const goalName = new Map((goals || []).map((g) => [String(g.id), g.title]));
  const notCarried = new Set(dropped || []);
  const row = (i, n) => {
    const index = items.indexOf(i);
    const linked = i.section !== 'bigger_goals' && i.goal_id ? goalName.get(String(i.goal_id)) : null;
    return (
      <li key={`${i.slot}-${n}`} data-testid={`evd-plan-line-${index}`}>
        <span className="evd-check" aria-hidden="true" />
        <span>
          {i.label}
          {(i.task_source === 'optional' || linked || notCarried.has(i.label)) && (
            <span className="evd-deliverable-detail">
              {[i.task_source === 'optional' && 'optional idea', linked && `for: ${linked}`].filter(Boolean).join(' · ')}
              {notCarried.has(i.label) && <span className="evd-not-carried" data-testid={`evd-not-carried-${index}`}> · over the goal limit, won&apos;t reach the episode</span>}
            </span>
          )}
        </span>
        {i.section !== 'bigger_goals' && <LineRedraft onRedraft={onRedraftLine ? () => onRedraftLine(index) : null} busy={lineBusy === index} label={i.label} />}
      </li>
    );
  };
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
      {typeof doc?.note === 'string' && doc.note.trim() && <div className="evd-paper-note" data-testid="evd-career-note">{doc.note.trim()}</div>}
      <div className="evd-career-sign">one step at a time, L.</div>
    </div>
  );
}

// The document's overlay: its image, whether it matches the document, and
// Make overlay (the approve call draws it again) when an approved one has none.
function OverlayRow({ type, doc, busy, onMake, lookTotal = null, readOnly = false }) {
  const o = docOverlay(doc, lookTotal);
  if (!o) return null;
  const canMake = !readOnly && doc.status === 'approved' && o.key !== 'current';
  return (
    <div className={`evd-overlay is-${o.key}`} data-testid={`evd-overlay-${type}`}>
      <span className="evd-overlay-thumb">
        {o.url ? <img src={o.url} alt="" /> : <ImageIcon size={16} aria-hidden="true" />}
      </span>
      <span className="evd-overlay-text">{o.label}</span>
      {o.url && o.key === 'current' && (
        <a className="evd-link" href={o.url} target="_blank" rel="noreferrer">
          View <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
      {canMake && (
        <button type="button" className="evd-link" onClick={onMake} disabled={!!busy} data-testid={`evd-make-overlay-${type}`}>
          {busy === `${type}:overlay` ? <Loader2 size={13} className="evd-spin" aria-hidden="true" /> : <ImageIcon size={13} aria-hidden="true" />}
          {o.url ? ' Redraw overlay' : ' Make overlay'}
        </button>
      )}
    </div>
  );
}

function Editor({ type, doc, onCancel, onSave, saving, goals = [], limit = null }) {
  const [rows, setRows] = useState(() => (doc?.items || []).map((i) => ({ ...i })));
  const [note, setNote] = useState(doc?.note || '');
  const set = (n, patch) => setRows((r) => r.map((x, i) => (i === n ? { ...x, ...patch } : x)));
  // The lines the event's goal limit would leave off the episode, as she types.
  const leftOut = type === 'career_plan' ? planLeftOut(rows, limit) : new Set();
  const thisEventCount = rows.filter((r) => (r.section || 'this_event') === 'this_event' && (r.label || '').trim()).length;
  return (
    <div className="evd-editor" data-testid={`evd-editor-${type}`}>
      {type === 'career_plan' && limit != null && (
        <p className={`evd-editor-limit${thisEventCount > limit ? ' is-over' : ''}`} data-testid="evd-editor-limit">
          This event carries {limit} of her goals into the episode{thisEventCount > limit ? `; ${thisEventCount - limit} line${thisEventCount - limit === 1 ? '' : 's'} marked below won't (optional ideas go first)` : ''}.
        </p>
      )}
      {rows.map((r, n) => (
        <div key={n} className={`evd-editor-row${leftOut.has(n) ? ' is-left-out' : ''}`}>
          {type === 'career_plan' && (
            <select value={r.section || 'this_event'} onChange={(e) => set(n, { section: e.target.value })} aria-label="Section">
              <option value="this_event">This event</option>
              <option value="bigger_goals">Bigger goal</option>
            </select>
          )}
          {type === 'career_plan' && (r.section || 'this_event') === 'this_event' && (
            <select value={r.task_source === 'optional' ? 'optional' : 'goal'} onChange={(e) => set(n, { task_source: e.target.value })} aria-label="Goal or idea">
              <option value="goal">Goal</option>
              <option value="optional">Optional idea</option>
            </select>
          )}
          <input value={r.label || ''} onChange={(e) => set(n, { label: e.target.value })} maxLength={200} aria-label={`Line ${n + 1}`} />
          {type === 'career_plan' && (r.section || 'this_event') === 'this_event' && goals.length > 0 && (
            <select value={r.goal_id || ''} onChange={(e) => set(n, { goal_id: e.target.value || undefined })} aria-label="Career goal it serves">
              <option value="">No career goal</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          )}
          {leftOut.has(n) && <span className="evd-left-out" title="Over the event's goal limit">won&apos;t carry</span>}
          <button type="button" className="evd-icon" onClick={() => setRows((x) => x.filter((_, i) => i !== n))} title="Remove line">
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
      ))}
      <label className="evd-editor-note">
        <span>Note (optional, written at the foot)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} aria-label="Note" />
      </label>
      <div className="evd-editor-actions">
        <button type="button" className="evd-link" onClick={() => setRows((x) => [...x, { label: '', slot: '', section: 'this_event' }])}>
          <Plus size={13} aria-hidden="true" /> Add a line
        </button>
        <span className="evd-grow" />
        <button type="button" className="evd-link" onClick={onCancel} disabled={saving}><X size={13} aria-hidden="true" /> Cancel</button>
        <button type="button" className="evd-save" onClick={() => onSave(rows, note)} disabled={saving || !rows.some((r) => (r.label || '').trim())}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// What GET answers beside the documents, read again after a change.
const DERIVED_KEYS = ['look_changed', 'career_carry', 'career_goals', 'closet', 'look', 'balance', 'deliverables'];

const SOURCE_LABELS = { draft: 'drafted', edited: 'edited', restored: 'restored', line_redraft: 'one line re-worded' };
const when = (v) => {
  const t = v?.updated_at || v?.approved_at || v?.edited_at || v?.drafted_at;
  const d = t ? new Date(t) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
};

// The kept earlier versions (at most ten), newest first, each with Restore
// (2026-10-24; only their count was shown before).
function HistoryList({ type, doc, onRestore, busy }) {
  const history = doc?.history || [];
  if (!history.length) return <p className="evd-muted">No earlier versions kept yet.</p>;
  return (
    <ul className="evd-history" data-testid={`evd-history-${type}`}>
      {history.map((v) => (
        <li key={v.version}>
          <span className="evd-history-text">
            Version {v.version} · {SOURCE_LABELS[v.source] || v.source || 'drafted'}{v.status === 'approved' ? ' · approved' : ''} · {(v.items || []).length} line{(v.items || []).length === 1 ? '' : 's'}
            <span className="evd-history-when">{when(v)}</span>
            <span className="evd-history-first">{(v.items || []).slice(0, 2).map((i) => i.label).join(' · ')}</span>
          </span>
          <button type="button" className="evd-link" onClick={() => onRestore(v.version)} disabled={!!busy} data-testid={`evd-restore-${type}-${v.version}`}>
            <RotateCcw size={13} aria-hidden="true" /> Restore
          </button>
        </li>
      ))}
    </ul>
  );
}

// lead: a card shown first in the grid (the episode's Overlays tab puts the
// invitation there, Evoni's mock 2026-10-07); intro=false leaves out the
// paragraph when the page already explains the documents. layout="wide"
// lays each document out as one wide card, its paper on the left (the
// episode's Overlays tab, one card per overlay; Evoni, 2026-10-07).
// only: one document type ('shopping_list' on the episode's Wardrobe tab,
// 2026-10-11). readOnly (true, or a list of types): no Draft, Edit, Redraft
// or Approve, only the state and manageHref, where it is worked on (Evoni,
// 2026-10-11: the shopping list is approved in one place, the Event Package).
// footerExtra(type, doc): more for a document's footer (the Wardrobe tab's
// "Use in episode", 2026-10-11).
export default function EventDocuments({ showId, eventId, event, outfitPieces = [], lead = null, intro = true, layout = 'grid', only = null, readOnly = false, manageHref = null, footerExtra = null }) {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // `${type}:${action}`
  const [editing, setEditing] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(null); // type
  const [lineBusy, setLineBusy] = useState(null); // { type, index }
  // The look's piece ids: when the outfit changes (a look chosen, a piece
  // swapped), the documents are read again, since the server's copy of the
  // look (docs.look) is what the shopping list adds up and it wins over the
  // pieces passed in.
  const piecesKey = (Array.isArray(outfitPieces) ? outfitPieces : []).map((p) => p?.id ?? '').join(',');

  const load = useCallback(() => getEventDocumentsApi(showId, eventId), [showId, eventId]);

  useEffect(() => {
    if (!showId || !eventId) return undefined;
    let cancelled = false;
    load()
      .then((d) => { if (!cancelled) { setDocs(d); setError(null); } })
      .catch((err) => {
        console.error('[EventDocuments] load failed:', err);
        if (!cancelled) setError(errorText(err));
      });
    return () => { cancelled = true; };
  }, [load, piecesKey]);

  // The server's own reading after a change: look changed, what the plan
  // carries, closet suggestions, the look and balance. The documents
  // themselves come from the change's own answer, so a slower read never
  // puts an older version back.
  const refresh = useCallback(async () => {
    try {
      const d = await load();
      setDocs((prev) => {
        const next = { ...(prev || {}) };
        for (const key of DERIVED_KEYS) if (d && key in d) next[key] = d[key];
        return next;
      });
    } catch (err) {
      console.error('[EventDocuments] reload failed:', err);
    }
  }, [load]);

  // Resolves to the saved document, or null when the call failed (said in the error line).
  const act = useCallback(async (type, action, fn) => {
    setBusy(`${type}:${action}`);
    setError(null);
    try {
      const doc = await fn();
      setDocs((d) => ({ ...(d || {}), [type]: doc }));
      if (action === 'edit') setEditing(null);
      refresh();
      return doc;
    } catch (err) {
      console.error(`[EventDocuments] ${action} ${type} failed:`, err);
      setError(errorText(err));
      return null;
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const undo = useUndo(`docs:${eventId}`, { setDocs, refresh });

  // Redraft replaces the current version (kept in its history) at once;
  // Undo restores the version it replaced, approved again when it was.
  const redraft = async (type, doc, opts = {}) => {
    const next = await act(type, 'draft', () => draftEventDocumentApi(showId, eventId, type, opts));
    if (!next || !doc) return;
    const { version, status } = doc;
    const title = (DOCS.find((d) => d.type === type)?.title || 'document').toLowerCase();
    undo.offer({
      message: `Redrafted the ${title}`,
      meta: { type },
      undo: async (ctx) => {
        let back = await restoreEventDocumentApi(showId, eventId, type, version);
        if (status === 'approved') back = await approveEventDocumentApi(showId, eventId, type);
        ctx.setDocs?.((d) => ({ ...(d || {}), [type]: back }));
        ctx.refresh?.();
      },
    });
  };

  const redraftLine = async (type, index, doc) => {
    setLineBusy({ type, index });
    setError(null);
    try {
      const next = await redraftEventDocumentLineApi(showId, eventId, type, index, doc?.version);
      setDocs((d) => ({ ...(d || {}), [type]: next }));
      refresh();
    } catch (err) {
      console.error(`[EventDocuments] line redraft ${type} failed:`, err);
      setError(errorText(err));
    } finally {
      setLineBusy(null);
    }
  };

  const restore = (type, fromVersion) => act(type, 'restore', () => restoreEventDocumentApi(showId, eventId, type, fromVersion));

  // The look the shopping list adds up, as the server reads it with the
  // documents (the look Finalize charges, Evoni 2026-10-09); the caller's
  // pieces only until it loads. The episode's Overlays tab passes none, so
  // its list read a total of 0.
  const listPieces = docs?.look ? docs.look.pieces : outfitPieces;
  const listTotal = docs?.shopping_list && docs?.look ? shoppingLines(docs.shopping_list, docs.look.pieces).total : null;
  // What she has against what the look's pieces to buy cost.
  const balance = docs?.balance == null ? null : Number(docs.balance);
  const short = listTotal != null && balance != null && Number.isFinite(balance) && listTotal > balance ? listTotal - balance : 0;

  // Look changed since the list was drafted: the server's answer, from the
  // look the list version records (2026-10-24).
  const lookChanged = Boolean(docs?.shopping_list) && docs?.look_changed === true;
  const keepList = () => act('shopping_list', 'keep', () => keepShoppingListLookApi(showId, eventId));

  return (
    <div className={`evd${layout === 'wide' ? ' is-wide' : ''}`} data-testid="event-documents">
      {intro && <p className="evd-intro">
        One system for the event&apos;s in-world documents: the invitation and these two. Each fills itself from the event, goes through the same steps
        (Draft, Edit, Redraft, Approve). Once approved, Start Episode puts it on the episode&apos;s lists: the
        shopping list as her wardrobe list, the career plan&apos;s &ldquo;This event&rdquo; lines as her goals.
        Approving one also draws it as an overlay for the episode.
        The invitation is in <a href="#epp-sec-invitation">1. The Event</a>.
      </p>}
      {error && <p className="evd-error" role="alert">{error}</p>}
      {!docs && !error && <p className="evd-muted">Loading documents…</p>}
      {(docs || lead) && (
        <div className={`evd-grid${lead ? ' has-lead' : ''}${only ? ' is-single' : ''}`}>
          {lead}
          {docs && DOCS.filter((d) => !only || d.type === only).map(({ type, title, from }) => {
            const doc = docs[type];
            const state = docState(doc);
            const isBusy = (a) => busy === `${type}:${a}`;
            const ro = readOnly === true || (Array.isArray(readOnly) && readOnly.includes(type));
            const canLine = doc && !ro && editing !== type && !busy && !lineBusy;
            const onLine = canLine ? (index) => redraftLine(type, index, doc) : null;
            const busyLine = lineBusy?.type === type ? lineBusy.index : null;
            const note = amountNote(doc, type);
            const carry = type === 'career_plan' ? docs.career_carry : null;
            return (
              // Not drafted yet: one line, its title, what it comes from and
              // Draft (Evoni's review, item 6); the paper appears once drafted.
              <article key={type} className={`evd-card${doc ? '' : ' is-blank'}`} data-testid={`evd-${type}`}>
                <h3 className="evd-title">{title}</h3>
                <p className="evd-from">{from}</p>
                <div className="evd-stage">
                  {doc && !ro && editing === type && (
                    <Editor
                      type={type} doc={doc} saving={isBusy('edit')}
                      goals={docs.career_goals || []} limit={carry?.limit ?? null}
                      onCancel={() => setEditing(null)}
                      onSave={(rows, n) => act(type, 'edit', () => editEventDocumentApi(showId, eventId, type, rows, n))}
                    />
                  )}
                  {doc && editing !== type && type === 'shopping_list' && (
                    <ShoppingPaper doc={doc} event={event} outfitPieces={listPieces} closet={ro ? {} : (docs.closet || {})} onRedraftLine={onLine} lineBusy={busyLine} />
                  )}
                  {doc && editing !== type && type === 'career_plan' && (
                    <CareerCard doc={doc} deliverables={docs.deliverables || []} goals={docs.career_goals || []} dropped={carry?.dropped || []} onRedraftLine={onLine} lineBusy={busyLine} />
                  )}
                </div>
                {doc && note && (
                  <p className="evd-warning" role="status" data-testid={`evd-amounts-${type}`}><AlertTriangle size={13} aria-hidden="true" /> {note}</p>
                )}
                {type === 'career_plan' && doc && carry?.dropped?.length > 0 && editing !== type && (
                  <p className="evd-warning" role="status" data-testid="evd-carry-career_plan">
                    <AlertTriangle size={13} aria-hidden="true" /> This event carries {carry.limit} of her goals; {carry.dropped.length} line{carry.dropped.length === 1 ? '' : 's'} won&apos;t reach the episode. Mark some optional or remove them.
                  </p>
                )}
                {type === 'shopping_list' && doc && short > 0 && editing !== type && (
                  <div className="evd-budget" role="status" data-testid="evd-budget">
                    <span>She has 🪙 {coins(balance)}; the pieces to buy cost 🪙 {coins(listTotal)} — 🪙 {coins(short)} short.</span>
                    {!ro && (
                      <button type="button" className="evd-link" onClick={() => redraft(type, doc, { budget: true })} disabled={!!busy} data-testid="evd-budget-redraft">
                        {isBusy('draft') ? <Loader2 size={13} className="evd-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />} Redraft within budget
                      </button>
                    )}
                  </div>
                )}
                <div className="evd-actions">
                  <span className={`evd-state is-${state.key}`} data-testid={`evd-state-${type}`}>{state.label}</span>
                  {footerExtra && footerExtra(type, doc)}
                  {ro ? (
                    manageHref && (
                      <a className="evd-link" href={manageHref} data-testid={`evd-manage-${type}`}>
                        <ExternalLink size={13} aria-hidden="true" /> {doc ? 'Change it in the Event Package' : 'Draft it in the Event Package'}
                      </a>
                    )
                  ) : !doc ? (
                    <button type="button" className="evd-link" onClick={() => act(type, 'draft', () => draftEventDocumentApi(showId, eventId, type))} disabled={!!busy}>
                      {isBusy('draft') ? <Loader2 size={13} className="evd-spin" aria-hidden="true" /> : <Wand2 size={13} aria-hidden="true" />} Draft
                    </button>
                  ) : (
                    <>
                      <button type="button" className="evd-link" onClick={() => setEditing(type)} disabled={!!busy || editing === type}>
                        <Pencil size={13} aria-hidden="true" /> Edit
                      </button>
                      <button type="button" className="evd-link" onClick={() => redraft(type, doc)} disabled={!!busy || editing === type} data-testid={`evd-redraft-${type}`}>
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
                {type === 'shopping_list' && doc && !ro && lookChanged && editing !== type && (
                  <div className="evd-look-changed" role="status" data-testid="evd-look-changed">
                    <span className="evd-look-changed-text"><Shirt size={13} aria-hidden="true" /> Look changed — redraft the list?</span>
                    <span className="evd-look-changed-actions">
                      <button type="button" className="evd-link" onClick={() => redraft(type, doc)} disabled={!!busy} data-testid="evd-look-changed-redraft">
                        {isBusy('draft') ? <Loader2 size={13} className="evd-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />} Redraft
                      </button>
                      <button type="button" className="evd-link" onClick={keepList} disabled={!!busy} data-testid="evd-look-changed-keep">
                        <Check size={13} aria-hidden="true" /> Keep
                      </button>
                    </span>
                  </div>
                )}
                {!ro && <UndoNotice undo={undo} match={(n) => n.meta?.type === type} testId={`evd-undo-${type}`} />}
                {doc && (
                  <OverlayRow
                    type={type} doc={doc} busy={busy} readOnly={ro}
                    lookTotal={type === 'shopping_list' ? listTotal : null}
                    onMake={() => act(type, 'overlay', () => approveEventDocumentApi(showId, eventId, type))}
                  />
                )}
                {doc && (
                  <div className="evd-meta-row">
                    <p className="evd-meta" data-testid={`evd-meta-${type}`}>
                      Version {doc.version}{doc.source === 'edited' ? ' · edited' : doc.source && doc.source !== 'draft' ? ` · ${SOURCE_LABELS[doc.source] || doc.source}` : ''}
                      {doc.history?.length ? ` · ${doc.history.length} earlier kept` : ''}
                    </p>
                    {doc.history?.length > 0 && !ro && (
                      <button type="button" className="evd-link evd-history-toggle" onClick={() => setHistoryOpen((h) => (h === type ? null : type))} aria-expanded={historyOpen === type} data-testid={`evd-history-toggle-${type}`}>
                        <History size={12} aria-hidden="true" /> {historyOpen === type ? 'Hide history' : 'History'}
                      </button>
                    )}
                  </div>
                )}
                {doc && historyOpen === type && !ro && (
                  <HistoryList type={type} doc={doc} busy={busy} onRestore={(v) => restore(type, v)} />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
