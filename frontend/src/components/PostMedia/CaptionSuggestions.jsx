/**
 * Visual Memory, phase 4 (Evoni, 2026-10-19; services/pictureSuggestions,
 * POST /api/v1/post-media/posts/:id/suggestions and .../suggestions/run):
 * "Suggest for this caption" reads the caption (one text call, kept on the
 * post), ranks their pictures for it with why, and offers one thing to do:
 * Use this, Make this edit (one change, the rest locked), or Create a new
 * picture (from approved references only). A made picture is a private
 * draft: Approve it (with who may see it), and Attach puts it with the
 * post's pictures to save. Nothing goes on the post by itself.
 */
import { useState, useEffect, useCallback } from 'react';
import { Check, Wand2, ImagePlus, Paperclip } from 'lucide-react';
import api from '../../services/api';
import './CaptionSuggestions.css';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const PERSON_WORDS = { yes: 'with them in it', no: 'no one in it', optional: 'them optional' };
const VISIBILITY_WORDS = { private: 'Only me', internal: 'The studio', public: 'Public (can go on The Pulse)' };
const LOCK_WORDS = { face: 'face', wardrobe: 'wardrobe', location: 'place', props: 'props' };

const readingLine = (r) => [r.activity || r.subject, r.mood, r.setting, PERSON_WORDS[r.person_in_frame]].filter(Boolean).join(' · ');
const listWords = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');

/** The new draft: what to check, Approve with who may see it, and Attach. */
function MadeDraft({ made, review, onAttach }) {
  const [visibility, setVisibility] = useState('internal');
  const [state, setState] = useState(made.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [attached, setAttached] = useState(false);

  const approve = async () => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/media/${made.id}`, { status: 'approved', visibility });
      setState('approved');
    } catch (err) {
      console.error('[CaptionSuggestions] the picture could not be approved:', err);
      setError(errorText(err, 'It was not approved. Try again.'));
    } finally { setBusy(false); }
  };
  const attach = () => {
    onAttach({ ...made, status: state, visibility: state === 'approved' ? visibility : made.visibility });
    setAttached(true);
  };

  return (
    <div className="cs-made" data-testid="cs-made">
      <img src={made.url} alt={made.caption || 'The new picture'} />
      <div className="cs-made-body">
        <p className="cs-muted">{state === 'approved' ? `Approved: ${VISIBILITY_WORDS[visibility]}.` : 'A private draft in their library. Before you approve it, check:'}</p>
        {state !== 'approved' && <ul className="cs-checks">{(review?.reasons || []).map((r) => <li key={r}>{r}</li>)}</ul>}
        {state !== 'approved' && (
          <div className="cs-row">
            <select className="cs-select" aria-label="Who may see it" value={visibility} onChange={(e) => setVisibility(e.target.value)} disabled={busy}>
              {Object.entries(VISIBILITY_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
            </select>
            <button type="button" className="cs-btn" disabled={busy} onClick={approve}><Check size={14} aria-hidden /> Approve</button>
          </div>
        )}
        <div className="cs-row">
          <button type="button" className="cs-btn is-quiet" disabled={busy || attached} onClick={attach} data-testid="cs-attach">
            <Paperclip size={14} aria-hidden /> {attached ? 'Attached' : 'Attach'}
          </button>
          {attached && <span className="cs-muted">With the post's pictures. Save to put it on the post.</span>}
        </div>
        {error && <p className="cs-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export default function CaptionSuggestions({ postId, library = [], isChosen, onUse, onToggle, onMade }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [made, setMade] = useState(null);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const { data: d } = await api.post(`/api/v1/post-media/posts/${postId}/suggestions`, {});
      setData(d);
    } catch (err) {
      console.error('[CaptionSuggestions] no suggestions:', err);
      setError(errorText(err, 'No suggestions came back. Try again.'));
    } finally { setBusy(false); }
  }, [postId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <p className="cs-error" role="alert">{error}</p> : <p className="cs-muted">Reading the caption…</p>;

  const { reading, ranked, plan } = data;
  const assetOf = (r) => library.find((a) => a.id === r.id) || r;
  const best = ranked.find((r) => r.id === (plan.use?.asset_id || plan.edit?.asset_id));

  const runChoice = async (choice) => {
    setBusy(true); setError(null);
    try {
      const { data: d } = await api.post(`/api/v1/post-media/posts/${postId}/suggestions/run`, { choice });
      setMade({ asset: d.asset, review: d.review });
      onMade?.();
    } catch (err) {
      console.error('[CaptionSuggestions] the picture was not made:', err);
      setError(errorText(err, 'The picture was not made. Try again.'));
    } finally { setBusy(false); }
  };

  const action = () => {
    if (plan.recommended === 'use' && best) {
      const a = assetOf(best);
      return (
        <button type="button" className="cs-btn" disabled={busy || isChosen?.(a)} onClick={() => onUse(a)} data-testid="cs-action">
          <Check size={14} aria-hidden /> {isChosen?.(a) ? 'On the post' : 'Use this'}
        </button>
      );
    }
    if (plan.recommended === 'edit' && plan.edit) {
      const kept = plan.edit.locks.map((l) => LOCK_WORDS[l]);
      return (
        <>
          <p className="cs-muted">{`${plan.edit.change.text[0].toUpperCase()}${plan.edit.change.text.slice(1)}${kept.length ? `, keeping the ${listWords(kept)}` : ''}. A new private draft; the original stays as it is.`}</p>
          <button type="button" className="cs-btn" disabled={busy} onClick={() => runChoice(plan.edit)} data-testid="cs-action">
            <Wand2 size={14} aria-hidden /> {busy ? 'Making it…' : 'Make this edit'}
          </button>
        </>
      );
    }
    return (
      <>
        <p className="cs-muted">
          {plan.create.blocked || `Nothing of theirs fits. A new picture from ${plan.create.references.length ? `${plan.create.references.length} approved reference${plan.create.references.length > 1 ? 's' : ''}` : 'the caption alone, with no one in it'}.`}
        </p>
        <button type="button" className="cs-btn" disabled={busy || Boolean(plan.create.blocked)} onClick={() => runChoice({ action: 'create' })} data-testid="cs-action">
          <ImagePlus size={14} aria-hidden /> {busy ? 'Making it…' : 'Create a new picture'}
        </button>
      </>
    );
  };

  return (
    <div className="cs" data-testid="cs">
      <p className="cs-reading" data-testid="cs-reading">
        <strong>The caption reads as:</strong> {readingLine(reading)}
        {data.fallback && <span className="cs-muted"> (read from its words only; ask again for a fuller reading)</span>}
      </p>
      {ranked.length ? (
        <ul className="cs-grid" data-testid="pp-suggestions">
          {ranked.map((r) => {
            const a = assetOf(r);
            return (
              <li key={r.id} className={best?.id === r.id ? 'cs-pick is-best' : 'cs-pick'}>
                <button type="button" className={isChosen?.(a) ? 'cs-thumb is-on' : 'cs-thumb'} aria-pressed={Boolean(isChosen?.(a))} onClick={() => (onToggle || onUse)(a)} aria-label={`Suggested: ${r.caption || 'a picture'}`}>
                  <img src={r.url} alt={r.caption || ''} loading="lazy" />
                </button>
                <span className="cs-why">{r.why.join('; ') || 'From their pictures'}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="cs-muted" data-testid="pp-suggestions">Nothing in their pictures matches this caption yet.</p>}
      <div className="cs-action">{action()}</div>
      {error && <p className="cs-error" role="alert">{error}</p>}
      {made && <MadeDraft key={made.asset.id} made={made.asset} review={made.review} onAttach={onUse} />}
    </div>
  );
}
