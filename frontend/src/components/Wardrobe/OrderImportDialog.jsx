/**
 * Producer Mode → Wardrobe → Import orders (Task 3102; Evoni, 2026-10-13:
 * "Amazon CSV first, with manual entry kept. Preview, confirm, detect
 * duplicates and match to pieces. Never deduct Lala's coins.").
 *
 * Choose Amazon's order history CSV; the server reads it (never stored) and
 * the preview lists each line: new ones with their suggested piece, ones
 * already imported marked so. Each new line goes on a piece or is kept for
 * later; Import fills each piece's empty real-world fields only (the editor's
 * values stay). Lines kept earlier are listed to match now. Nothing here
 * touches coins or ownership.
 *
 * Data: POST /api/v1/wardrobe-orders/preview (multipart), POST /confirm,
 * GET /?status=unmatched, PUT /:id. Helpers: lib/wardrobeOrders.
 * Styles: AddPieceDialog.css (the dialog), OrderImportDialog.css (oid-*).
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import api from '../../services/api';
import { KEEP_FOR_LATER, confirmLines, lineFacts, lineKey, pieceOptions, startingPicks, summaryText } from '../../lib/wardrobeOrders';
import './AddPieceDialog.css';
import './OrderImportDialog.css';

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

function PiecePicker({ value, onChange, options, disabled, label }) {
  return (
    <select className="oid-pick" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value={KEEP_FOR_LATER}>Keep for later (no piece)</option>
      {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export default function OrderImportDialog({ showId, pieces, onClose, onImported }) {
  const titleId = useId();
  const options = pieceOptions(pieces);
  const [lines, setLines] = useState(null);
  const [cancelled, setCancelled] = useState(0);
  const [picks, setPicks] = useState({});
  const [later, setLater] = useState([]);
  const [laterPicks, setLaterPicks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const loadLater = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/wardrobe-orders?status=unmatched${showId ? `&show_id=${encodeURIComponent(showId)}` : ''}`);
      setLater(r.data?.lines || []);
    } catch (err) {
      console.error('[OrderImport] the kept lines could not be read:', err.response?.status || err.message);
    }
  }, [showId]);
  useEffect(() => { loadLater(); }, [loadLater]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const choose = async (file) => {
    if (!file) return;
    setBusy(true); setError(null); setNote(null); setLines(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (showId) fd.append('show_id', showId);
      const r = await api.post('/api/v1/wardrobe-orders/preview', fd);
      const got = r.data?.lines || [];
      setLines(got);
      setCancelled(r.data?.cancelled || 0);
      setPicks(startingPicks(got));
    } catch (err) {
      console.error('[OrderImport] preview failed:', err.response?.status || err.message);
      setError(errorOf(err, 'That file could not be read.'));
    } finally { setBusy(false); }
  };

  const pick = (l, patch) => setPicks((p) => ({ ...p, [lineKey(l)]: { ...p[lineKey(l)], ...patch } }));
  const chosen = confirmLines(lines, picks);

  const importNow = async () => {
    if (!chosen.length) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post('/api/v1/wardrobe-orders/confirm', { show_id: showId || null, lines: chosen });
      setNote(summaryText(r.data || {}));
      setLines(null); setPicks({});
      onImported?.(r.data);
      await loadLater();
    } catch (err) {
      console.error('[OrderImport] import failed:', err.response?.status || err.message);
      setError(errorOf(err, 'The import did not finish. Nothing was lost; try again.'));
    } finally { setBusy(false); }
  };

  const matchLater = async (line) => {
    const wardrobeId = laterPicks[line.id];
    if (!wardrobeId) return;
    setBusy(true); setError(null);
    try {
      const r = await api.put(`/api/v1/wardrobe-orders/${line.id}`, { wardrobe_id: wardrobeId });
      setNote('Put on the piece.');
      onImported?.({ matched: 1, unmatched: 0, duplicates: 0, pieces: r.data?.piece ? [r.data.piece] : [] });
      await loadLater();
    } catch (err) {
      console.error('[OrderImport] match failed:', err.response?.status || err.message);
      setError(errorOf(err, 'That line could not be matched.'));
    } finally { setBusy(false); }
  };

  const fresh = (lines || []).filter((l) => l.status === 'new');
  const repeats = (lines || []).filter((l) => l.status === 'duplicate');

  return (
    <div className="apd-backdrop" onClick={() => { if (!busy && !lines) onClose(); }} data-testid="order-import-backdrop">
      <div className="apd-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} data-testid="order-import-dialog">
        <header className="apd-head">
          <div>
            <h3 id={titleId} className="apd-title">Import orders</h3>
            <p className="apd-sub">From Amazon&apos;s order history CSV. Each order fills a piece&apos;s empty Real world details; what you typed stays. Coins are never touched.</p>
          </div>
          <button type="button" className="apd-icon" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} aria-hidden="true" /></button>
        </header>

        <div className="oid-body">
          <label className="oid-file">
            <FileUp size={16} aria-hidden="true" /> {lines ? 'Choose another file' : 'Choose the order history CSV'}
            <input type="file" accept=".csv,text/csv" className="oid-sr" data-testid="order-import-file" disabled={busy}
              onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <p className="oid-hint">Amazon: Account › Request your data, or Order History Reports. The file is read once and not kept; addresses and payment details are never saved.</p>

          {lines && (
            <section aria-label="The orders in the file" data-testid="order-import-preview">
              <p className="oid-count">
                {fresh.length} new{repeats.length ? ` · ${repeats.length} already imported` : ''}{cancelled ? ` · ${cancelled} cancelled, left out` : ''}
              </p>
              <ul className="oid-lines">
                {fresh.map((l) => {
                  const p = picks[lineKey(l)] || {};
                  return (
                    <li key={lineKey(l)} className="oid-line" data-testid="order-import-line">
                      <label className="oid-include">
                        <input type="checkbox" checked={Boolean(p.include)} disabled={busy} onChange={(e) => pick(l, { include: e.target.checked })} />
                        <span className="oid-title">{l.title}</span>
                      </label>
                      <p className="oid-facts">{lineFacts(l)}{l.suggestion ? <span className="oid-why"> · suggested {l.suggestion.reason === 'asin' ? 'by its link' : 'by its name'}</span> : null}</p>
                      <PiecePicker label={`Piece for ${l.title}`} value={p.wardrobe_id ?? KEEP_FOR_LATER} options={options} disabled={busy || !p.include}
                        onChange={(v) => pick(l, { wardrobe_id: v })} />
                    </li>
                  );
                })}
                {repeats.map((l) => (
                  <li key={lineKey(l)} className="oid-line is-done" data-testid="order-import-duplicate">
                    <span className="oid-title">{l.title}</span>
                    <p className="oid-facts">{lineFacts(l)} · already imported</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {later.length > 0 && (
            <section className="oid-later" aria-labelledby={`${titleId}-later`} data-testid="order-import-later">
              <h4 id={`${titleId}-later`} className="oid-h">Kept for later</h4>
              <ul className="oid-lines">
                {later.map((l) => (
                  <li key={l.id} className="oid-line">
                    <span className="oid-title">{l.title}</span>
                    <p className="oid-facts">{lineFacts({ ...l, price_paid: l.price_paid == null ? null : Number(l.price_paid) })}</p>
                    <div className="oid-row">
                      <PiecePicker label={`Piece for ${l.title}`} value={laterPicks[l.id] || KEEP_FOR_LATER} options={options} disabled={busy}
                        onChange={(v) => setLaterPicks((m) => ({ ...m, [l.id]: v }))} />
                      <button type="button" className="apd-btn" disabled={busy || !laterPicks[l.id]} onClick={() => matchLater(l)}>Put on piece</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="apd-foot">
          {error && <p className="apd-error" role="alert" data-testid="order-import-error">{error}</p>}
          {!error && note && <p className="oid-note" role="status" data-testid="order-import-note">{note}</p>}
          <div className="apd-actions">
            <button type="button" className="apd-btn" onClick={onClose} disabled={busy}>{lines ? 'Cancel' : 'Close'}</button>
            {lines && (
              <button type="button" className="apd-btn is-primary" onClick={importNow} disabled={busy || !chosen.length} data-testid="order-import-confirm">
                {busy && <Loader2 size={14} className="apd-spin" aria-hidden="true" />}
                {busy ? 'Importing…' : `Import ${chosen.length} ${chosen.length === 1 ? 'line' : 'lines'}`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
