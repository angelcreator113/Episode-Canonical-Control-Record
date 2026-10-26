/**
 * My Little List ♡ in the episode (Evoni, 2026-10-26, Phase 2): the
 * producer's view of Lala's list, on Production → Phone.
 *
 * Left: her list as the phone shows it at the beat and line picked
 * (components/phone/MyLittleList, interactive: her reminders can be added,
 * edited, ticked and removed; goals and ideas tick; her outfit and the deal
 * tick only as she plays). Right: every item with its wording, when it
 * shows, and why it doesn't yet (lib/myLittleList fetchReview, all=1), so an
 * item can be worded before Lala learns of it. The production label is
 * shown here only, for the producer; the phone never gets it.
 */
import { useState, useEffect, useCallback } from 'react';
import MyLittleList from '../phone/MyLittleList';
import { fetchReview, setWords, REASON_LABELS, showsAtText, refusalText } from '../../lib/myLittleList';
import './MyLittleListPanel.css';

const BEATS = Array.from({ length: 14 }, (_, i) => i + 1);

function WordingRow({ episodeId, item, onSaved }) {
  const stages = item.kind === 'deal' ? ['considering', 'committed'] : [null];
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (stage) => {
    const id = stage || 'title';
    const title = (values[id] ?? '').trim();
    setSaving(true);
    setError('');
    try {
      await setWords(episodeId, item.key, { title, ...(stage ? { stage } : {}) });
      setValues((v) => ({ ...v, [id]: undefined }));
      onSaved();
    } catch (err) {
      console.error('[MyLittleListPanel] wording failed:', err);
      setError(refusalText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="mllp-row" data-testid="mllp-row" data-reason={item.reason || 'shown'}>
      <div className="mllp-row-head">
        <span className={`mllp-chip is-${item.reason || 'shown'}`}>{item.reason ? REASON_LABELS[item.reason] || item.reason : 'On her list'}</span>
        <span className="mllp-when">{showsAtText(item.shows_at)}</span>
      </div>
      <div className="mllp-label" title="The production label: never on her phone">{item.label}</div>
      {item.leaked && <div className="mllp-leak" data-testid="mllp-leak">Names: {item.leaked.join(', ')}</div>}
      {stages.map((stage) => {
        const id = stage || 'title';
        const current = stage && stage !== item.stage ? null : item.title;
        return (
          <form key={id} className="mllp-words" onSubmit={(e) => { e.preventDefault(); save(stage); }}>
            {stage && <span className="mllp-stage">{stage === 'considering' ? 'Before she says yes' : 'After she says yes'}</span>}
            <input
              value={values[id] ?? ''}
              placeholder={current || (item.kind === 'reminder' ? 'Her words' : 'Her words (empty = the standard wording)')}
              maxLength={80}
              onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
              aria-label={`Lala's words for ${item.label}${stage ? ` (${stage})` : ''}`}
              data-testid="mllp-words-input"
            />
            <button type="submit" disabled={saving || values[id] === undefined || (item.kind === 'reminder' && !(values[id] || '').trim())} data-testid="mllp-words-save">Save</button>
          </form>
        );
      })}
      {error && <p className="mllp-error" role="alert">{error}</p>}
    </li>
  );
}

export default function MyLittleListPanel({ episodeId }) {
  const [beat, setBeat] = useState(1);
  const [line, setLine] = useState(0);
  const [review, setReview] = useState(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadReview = useCallback(async () => {
    try {
      setReview(await fetchReview(episodeId, beat, line));
      setFailed(false);
    } catch (err) {
      console.error('[MyLittleListPanel] review failed:', err);
      setFailed(true);
    }
  }, [episodeId, beat, line]);

  useEffect(() => { loadReview(); }, [loadReview, reloadKey]);

  const saved = () => setReloadKey((k) => k + 1);

  return (
    <section className="lalas-phone-card mllp" aria-labelledby="mllp-title" data-testid="my-little-list-panel">
      <div className="lalas-phone-card-head">
        <h2 id="mllp-title" className="lalas-phone-title">My Little List ♡</h2>
      </div>
      <p className="mllp-intro">Lala&apos;s own list: only what she knows at that point, in her words. Pick a moment to see it as her phone does.</p>
      <div className="mllp-at">
        <label>Beat
          <select value={beat} onChange={(e) => { setBeat(Number(e.target.value)); setLine(0); }} data-testid="mllp-beat">
            {BEATS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label>Line
          <input type="number" min={1} value={line + 1} onChange={(e) => setLine(Math.max(0, (parseInt(e.target.value, 10) || 1) - 1))} data-testid="mllp-line" />
        </label>
      </div>
      <div className="mllp-panes">
        <div className="mllp-phone">
          <MyLittleList episodeId={episodeId} beat={beat} line={line} interactive reloadKey={reloadKey} />
        </div>
        <div className="mllp-review">
          <h3 className="mllp-sub">Her words</h3>
          {failed && <p className="mllp-error" role="alert">The wording list didn&apos;t load.</p>}
          {review && review.items.length === 0 && <p className="mllp-muted">Nothing on her list in this episode yet.</p>}
          {review && review.items.length > 0 && (
            <ul className="mllp-rows">
              {review.items.map((item) => <WordingRow key={item.key} episodeId={episodeId} item={item} onSaved={saved} />)}
            </ul>
          )}
          {review?.issues?.length > 0 && (
            <div className="mllp-issues" data-testid="mllp-issues">
              <h3 className="mllp-sub">Script lines it ignores</h3>
              <ul>{review.issues.map((i, n) => <li key={n}>Beat {i.beat}, line {i.line + 1}: {i.raw} ({i.code.replace(/_/g, ' ')})</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
