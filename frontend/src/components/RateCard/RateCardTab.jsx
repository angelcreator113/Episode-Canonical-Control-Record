/**
 * Rate card (Producer Mode; Evoni, 2026-10-19: "yes start the rate card
 * after phase 4"). What Lala charges: one price per deal component and
 * deliverable at each of her career tiers (Emerging … Elite, her band from
 * her reputation), and the premiums' percents.
 *
 * Save writes the next version of the card (services/rateCard): deals
 * already agreed keep their numbers, and a draft takes the new prices the
 * next time Propose terms runs, recording which rate priced it. Empty
 * means not offered at that tier ("Price required" on a deal). Only an
 * ADMIN can save; anyone signed in can read it.
 * API: GET /api/v1/deal-rates/editor, PUT /api/v1/deal-rates.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Coins, Save, RotateCcw, History } from 'lucide-react';
import api from '../../services/api';
import './RateCardTab.css';

export const rateCardEditorApi = () => api.get('/api/v1/deal-rates/editor');
export const saveRateCardApi = (body) => api.put('/api/v1/deal-rates', body);

// Draft keys: 'a|<component>|<tier>' for a price, 'p|<kind>|<key>' for a premium.
const cellKey = (component, tier) => `a|${component}|${tier}`;
const premiumKey = (kind, key) => `p|${kind}|${key}`;
const asText = (v) => (v == null ? '' : String(v));
const asValue = (text) => (String(text).trim() === '' ? null : Number(text));

function describeChange(c) {
  const from = c.from == null ? 'not offered' : c.from;
  const to = c.to == null ? 'not offered' : c.to;
  return `${from} → ${to}`;
}

export default function RateCardTab() {
  const [table, setTable] = useState(null);
  const [versions, setVersions] = useState([]);
  const [draft, setDraft] = useState({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const take = useCallback((data) => {
    setTable(data?.table || null);
    setVersions(Array.isArray(data?.versions) ? data.versions : []);
    setDraft({});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rateCardEditorApi();
      take(res.data);
    } catch (err) {
      console.error('[RateCard] load failed:', err);
      setError(err.response?.data?.error || 'The rate card could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [take]);

  useEffect(() => { load(); }, [load]);

  const original = useMemo(() => {
    const map = {};
    for (const a of table?.anchors || []) for (const t of table.tiers) map[cellKey(a.component, t.tier)] = asText(a.amounts[t.tier]);
    for (const p of table?.premiums || []) for (const k of p.keys) map[premiumKey(p.kind, k.key)] = asText(k.percent);
    return map;
  }, [table]);

  const edited = Object.entries(draft).filter(([k, v]) => original[k] !== v);
  const invalid = edited.some(([, v]) => v.trim() !== '' && !/^\d+$/.test(v.trim()));
  const valueOf = (k) => (k in draft ? draft[k] : original[k] ?? '');
  const setCell = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    const anchors = [];
    const premiums = [];
    for (const [k, v] of edited) {
      const [type, a, b] = k.split('|');
      if (type === 'p') premiums.push({ kind: a, key: b, percent: asValue(v) });
      else anchors.push({ component: a, career_tier: Number(b), amount: asValue(v) });
    }
    try {
      const res = await saveRateCardApi({ based_on: table.version, note: note.trim() || undefined, changes: { anchors, premiums } });
      take(res.data);
      setNote('');
      setNotice(`Saved as version ${res.data?.saved?.version}. New deals and drafts are priced from it; agreed deals keep their numbers.`);
    } catch (err) {
      console.error('[RateCard] save failed:', err);
      const status = err.response?.status;
      setError(status === 403 ? 'Only an admin can change the rate card.' : (err.response?.data?.error || 'The rate card could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rc"><p className="rc-muted">Loading the rate card…</p></div>;
  if (!table) {
    return (
      <div className="rc">
        {error ? <p className="rc-error" role="alert">{error}</p> : <p className="rc-muted">There is no rate card yet.</p>}
      </div>
    );
  }

  return (
    <div className="rc" data-testid="rate-card">
      <div className="rc-head">
        <h3><Coins size={18} aria-hidden="true" /> Rate card <span className="rc-version">v{table.version}</span></h3>
        <p className="rc-muted">
          What Lala charges, in Prime Coins, at each of her career tiers. Her tier comes from her reputation.
          Empty means not offered at that tier. Saving makes a new version: deals already agreed keep their numbers,
          and drafts take the new prices the next time you propose terms.
        </p>
      </div>

      <section className="rc-card" aria-label="Prices">
        <div className="rc-scroll">
          <table className="rc-table">
            <thead>
              <tr>
                <th scope="col">Price</th>
                {table.tiers.map((t) => <th key={t.tier} scope="col">{t.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.anchors.map((a) => (
                <tr key={a.component}>
                  <th scope="row">
                    <span className="rc-label">{a.label}</span>
                    <span className="rc-unit">{a.unit}</span>
                  </th>
                  {table.tiers.map((t) => {
                    const k = cellKey(a.component, t.tier);
                    const changed = k in draft && draft[k] !== original[k];
                    return (
                      <td key={t.tier}>
                        <input
                          className={`rc-input${changed ? ' is-changed' : ''}`}
                          inputMode="numeric"
                          aria-label={`${a.label}, ${t.label}`}
                          value={valueOf(k)}
                          placeholder="—"
                          onChange={(e) => setCell(k, e.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {table.premiums.length > 0 && (
        <section className="rc-card" aria-label="Premiums">
          <h4 className="rc-h4">Premiums</h4>
          <p className="rc-muted">Added to the one price they apply to; two premiums add up.</p>
          <div className="rc-premiums">
            {table.premiums.map((p) => (
              <div key={p.kind} className="rc-premium">
                <span className="rc-label">{p.label}</span>
                {p.keys.map((x) => {
                  const k = premiumKey(p.kind, x.key);
                  const changed = k in draft && draft[k] !== original[k];
                  return (
                    <label key={x.key} className="rc-premium-key">
                      <span>{x.key}</span>
                      <input
                        className={`rc-input is-small${changed ? ' is-changed' : ''}`}
                        inputMode="numeric"
                        aria-label={`${p.label} ${x.key}, percent`}
                        value={valueOf(k)}
                        placeholder="—"
                        onChange={(e) => setCell(k, e.target.value)}
                      />
                      <span>%</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rc-card rc-save">
        <input
          className="rc-input rc-note"
          aria-label="Why the change"
          placeholder="Why the change (optional)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="rc-actions">
          <button type="button" className="rc-btn is-quiet" onClick={() => setDraft({})} disabled={!edited.length || saving}>
            <RotateCcw size={14} aria-hidden="true" /> Undo edits
          </button>
          <button type="button" className="rc-btn" onClick={save} disabled={!edited.length || invalid || saving} data-testid="rate-card-save">
            <Save size={14} aria-hidden="true" /> {saving ? 'Saving…' : `Save ${edited.length ? `${edited.length} change${edited.length === 1 ? '' : 's'}` : ''}`.trim()}
          </button>
        </div>
        {invalid && <p className="rc-error">A price or percent is a whole number, or empty.</p>}
        {error && <p className="rc-error" role="alert">{error}</p>}
        {notice && <p className="rc-note-ok" role="status">{notice}</p>}
      </section>

      {versions.length > 0 && (
        <section className="rc-card" aria-label="Versions">
          <h4 className="rc-h4"><History size={14} aria-hidden="true" /> Versions</h4>
          <ul className="rc-versions">
            {versions.map((v) => (
              <li key={v.version} className="rc-version-row">
                <span className="rc-version">v{v.version}</span>
                <span className="rc-version-body">
                  {v.note || 'No note'}
                  {v.created_by_name ? ` · ${v.created_by_name}` : ''}
                  {v.created_at ? ` · ${new Date(v.created_at).toLocaleDateString()}` : ''}
                  {(v.changes?.anchors || []).map((c) => (
                    <span key={`${c.component}:${c.career_tier}`} className="rc-change">
                      {table.anchors.find((a) => a.component === c.component)?.label || c.component}
                      {', '}{table.tiers.find((t) => t.tier === c.career_tier)?.label || c.career_tier}: {describeChange(c)}
                    </span>
                  ))}
                  {(v.changes?.premiums || []).map((c) => (
                    <span key={`${c.kind}:${c.key}`} className="rc-change">
                      {table.premiums.find((p) => p.kind === c.kind)?.label || c.kind} {c.key}: {describeChange(c)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
