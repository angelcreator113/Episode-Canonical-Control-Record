/**
 * Visual Memory, phase 4 (Evoni, 2026-10-19; services/pictureSuggestions,
 * POST /api/v1/post-media/posts/:id/suggestions, .../suggestions/run and
 * .../suggestions/choice): "Suggest for this caption" reads the caption (one
 * text call, kept apart from the post's review notes), ranks their pictures
 * for it with why, and recommends one thing to do. The recommendation guides,
 * it never restricts (her ruling): Use, Edit, Generate new and Upload are
 * always there, on any ranked picture. "Include {name}" puts the poster in a
 * new picture or an edit when the caption leaves them optional. Generating
 * when a fitting picture already exists asks first, with the cost. A made
 * picture is a private draft: Approve it (with who may see it), and Attach
 * puts it with the post's pictures to save. Nothing goes on the post by
 * itself. What she chose is recorded so the recommendations can improve.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Wand2, ImagePlus, Paperclip, Upload, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { madeFromLine } from '../MediaVariations/MakeVariation';
import './CaptionSuggestions.css';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const PERSON_WORDS = { yes: 'with them in it', no: 'no one in it', optional: 'them optional' };
const VISIBILITY_WORDS = { private: 'Only me', internal: 'The studio', public: 'Public (can go on The Pulse)' };
const LOCK_WORDS = { face: 'face', wardrobe: 'wardrobe', location: 'place', props: 'props' };
const ACTION_WORDS = { use: 'Use this picture', edit: 'Edit this picture', create: 'Generate a new picture', upload: 'Upload your own' };

const readingLine = (r) => [r.activity || r.subject, r.mood, r.setting, PERSON_WORDS[r.person_in_frame]].filter(Boolean).join(' · ');
const listWords = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
const sentence = (t) => (t ? `${t[0].toUpperCase()}${t.slice(1)}` : '');

/** The new draft: what it was made from, what to check, Approve with who may see it, and Attach. */
function MadeDraft({ made, review, sources, onAttach }) {
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
        {sources?.length > 0 && <p className="cs-muted" data-testid="cs-made-from">Made from {madeFromLine(sources)}.</p>}
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

export default function CaptionSuggestions({ postId, library = [], isChosen, onUse, onMade }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [made, setMade] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [includePerson, setIncludePerson] = useState(false);
  const [open, setOpen] = useState(null); // 'edit' | 'confirm-create'
  const [editText, setEditText] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const { data: d } = await api.post(`/api/v1/post-media/posts/${postId}/suggestions`, {});
      setData(d);
      setPickedId(d.plan?.use?.asset_id || d.plan?.edit?.asset_id || d.ranked?.[0]?.id || null);
      setIncludePerson(Boolean(d.plan?.person?.included));
    } catch (err) {
      console.error('[CaptionSuggestions] no suggestions:', err);
      setError(errorText(err, 'No suggestions came back. Try again.'));
    } finally { setBusy(false); }
  }, [postId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <p className="cs-error" role="alert">{error}</p> : <p className="cs-muted">Reading the caption…</p>;

  const { reading, ranked, plan, poster } = data;
  const name = plan.person?.name || poster?.name || 'them';
  const assetOf = (r) => library.find((a) => a.id === r.id) || r;
  const recommendedId = plan.use?.asset_id || plan.edit?.asset_id || null;
  const picked = ranked.find((r) => r.id === pickedId) || null;
  const pickedEdit = picked ? (picked.id === plan.edit?.asset_id ? { change: plan.edit.change, locks: plan.edit.locks } : picked.edit) : null;
  const noPortrait = includePerson && plan.person && !plan.person.portraits;
  const createBlocked = noPortrait
    ? `There is no approved portrait of ${name} yet, so a new picture with them in it is not made. Approve a portrait first, or leave them out.`
    : (includePerson === Boolean(plan.person?.included) ? plan.create.blocked : null);

  // What she chose, for the recommendation's record. It never stops what she is doing.
  const record = async (body) => {
    try {
      await api.post(`/api/v1/post-media/posts/${postId}/suggestions/choice`, body);
    } catch (err) {
      console.error('[CaptionSuggestions] the choice was not recorded:', err);
    }
  };

  const runChoice = async (choice) => {
    setBusy(true); setError(null);
    try {
      const { data: d } = await api.post(`/api/v1/post-media/posts/${postId}/suggestions/run`, { choice });
      setMade({ asset: d.asset, review: d.review, sources: d.sources || null });
      setOpen(null);
      onMade?.();
    } catch (err) {
      console.error('[CaptionSuggestions] the picture was not made:', err);
      setError(errorText(err, 'The picture was not made. Try again.'));
    } finally { setBusy(false); }
  };

  const use = () => {
    if (!picked) return;
    onUse(assetOf(picked));
    record({ action: 'use', asset_id: picked.id });
  };
  const openEdit = () => {
    setEditText(pickedEdit?.change?.text || '');
    setOpen(open === 'edit' ? null : 'edit');
  };
  const runEdit = () => runChoice({
    action: 'edit', asset_id: picked.id, change: { kind: pickedEdit?.change?.kind || 'object', text: editText.trim() },
    locks: pickedEdit?.locks || ['face', 'wardrobe', 'location'], include_person: includePerson,
  });
  const create = () => {
    if (plan.create_note && open !== 'confirm-create') { setOpen('confirm-create'); return; }
    runChoice({ action: 'create', include_person: includePerson });
  };
  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('caption', reading.subject || 'Her own picture');
      form.append('status', 'approved');
      form.append('visibility', 'internal');
      form.append('links', JSON.stringify(poster?.id ? [{ entity_type: 'character', entity_id: poster.id, role: 'owner' }] : []));
      const { data: d } = await api.post('/api/v1/media', form);
      onUse(d.asset);
      await record({ action: 'upload', result_asset_id: d.asset.id });
      onMade?.();
    } catch (err) {
      console.error('[CaptionSuggestions] the upload did not save:', err);
      setError(errorText(err, 'The picture did not upload. Try again.'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const why = () => {
    if (plan.recommended === 'use') return `A picture of theirs fits${ranked[0]?.why?.length ? `: ${ranked[0].why.slice(0, 2).join('; ')}` : ''}.`;
    if (plan.recommended === 'edit' && plan.edit) {
      const kept = plan.edit.locks.map((l) => LOCK_WORDS[l]);
      return `Nearly right. ${sentence(plan.edit.change.text)}${kept.length ? `, keeping the ${listWords(kept)}` : ''}.`;
    }
    const refs = plan.create.references.length;
    return `Nothing of theirs fits. A new picture from ${refs ? `${refs} approved reference${refs > 1 ? 's' : ''}` : 'the caption alone'}.`;
  };
  const btn = (action) => (plan.recommended === action ? 'cs-btn is-recommended' : 'cs-btn is-quiet');

  return (
    <div className="cs" data-testid="cs">
      <p className="cs-reading" data-testid="cs-reading">
        <strong>The caption reads as:</strong> {readingLine(reading)}
        {data.fallback && (
          <span className="cs-muted" data-testid="cs-fallback">
            {data.ai_unavailable
              ? ' (the AI could not be reached, so this is read from its words only; nothing was spent)'
              : ' (read from its words only; ask again for a fuller reading)'}
          </span>
        )}
      </p>
      <p className="cs-recommend" data-testid="cs-recommend">
        <Sparkles size={14} aria-hidden /> <strong>Recommended: {ACTION_WORDS[plan.recommended]}.</strong> {why()}
      </p>
      {ranked.length ? (
        <ul className="cs-grid" data-testid="pp-suggestions">
          {ranked.map((r) => {
            const a = assetOf(r);
            const cls = ['cs-pick', recommendedId === r.id ? 'is-best' : '', pickedId === r.id ? 'is-picked' : ''].filter(Boolean).join(' ');
            return (
              <li key={r.id} className={cls}>
                <button type="button" className="cs-thumb" aria-pressed={pickedId === r.id} onClick={() => { setPickedId(r.id); setOpen(null); }} aria-label={`Suggested: ${r.caption || 'a picture'}`}>
                  <img src={r.url} alt={r.caption || ''} loading="lazy" />
                  {isChosen?.(a) && <span className="cs-on">On the post</span>}
                </button>
                <span className="cs-why">{r.why.join('; ') || 'From their pictures'}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="cs-muted" data-testid="pp-suggestions">Nothing in their pictures matches this caption yet.</p>}

      <label className="cs-toggle">
        <input type="checkbox" checked={includePerson} onChange={(e) => setIncludePerson(e.target.checked)} disabled={busy} data-testid="cs-include" />
        <span>Include {name}</span>
        {reading.person_in_frame === 'optional' && <span className="cs-muted">(the caption leaves them optional)</span>}
      </label>

      <div className="cs-actions" role="group" aria-label="What to do">
        <button type="button" className={btn('use')} disabled={busy || !picked || isChosen?.(assetOf(picked))} onClick={use} data-testid="cs-use">
          <Check size={14} aria-hidden /> {picked && isChosen?.(assetOf(picked)) ? 'On the post' : 'Use'}
        </button>
        <button type="button" className={btn('edit')} disabled={busy || !pickedEdit} onClick={openEdit} aria-expanded={open === 'edit'} data-testid="cs-edit">
          <Wand2 size={14} aria-hidden /> Edit
        </button>
        <button type="button" className={btn('create')} disabled={busy || Boolean(createBlocked)} onClick={create} data-testid="cs-create">
          <ImagePlus size={14} aria-hidden /> {busy && open !== 'edit' ? 'Making it…' : 'Generate new'}
        </button>
        <button type="button" className="cs-btn is-quiet" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="cs-upload">
          <Upload size={14} aria-hidden /> Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} data-testid="cs-upload-file" aria-label="Upload a picture" />
      </div>
      {createBlocked && <p className="cs-muted">{createBlocked}</p>}

      {open === 'edit' && picked && pickedEdit && (
        <div className="cs-edit" data-testid="cs-edit-form">
          <label className="cs-label" htmlFor={`cs-change-${postId}`}>What to change on &ldquo;{picked.caption || 'this picture'}&rdquo;</label>
          <input id={`cs-change-${postId}`} className="cs-input" value={editText} onChange={(e) => setEditText(e.target.value)} disabled={busy} />
          <p className="cs-muted">
            {`Keeping the ${listWords(pickedEdit.locks.map((l) => LOCK_WORDS[l]))}.`}
            {includePerson && !picked.pictured ? ` ${name} is added to it.` : ''} A new private draft; the original stays as it is.
          </p>
          <button type="button" className="cs-btn" disabled={busy || !editText.trim()} onClick={runEdit} data-testid="cs-edit-run">
            <Wand2 size={14} aria-hidden /> {busy ? 'Making it…' : 'Make this edit'}
          </button>
        </div>
      )}
      {open === 'confirm-create' && (
        <div className="cs-confirm" role="alertdialog" aria-label="Generate anyway?" data-testid="cs-create-confirm">
          <p className="cs-muted">{plan.create_note}</p>
          <div className="cs-row">
            <button type="button" className="cs-btn" disabled={busy} onClick={create} data-testid="cs-create-anyway">
              <ImagePlus size={14} aria-hidden /> {busy ? 'Making it…' : 'Generate anyway'}
            </button>
            <button type="button" className="cs-btn is-quiet" disabled={busy} onClick={() => setOpen(null)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="cs-error" role="alert">{error}</p>}
      {made && <MadeDraft key={made.asset.id} made={made.asset} review={made.review} sources={made.sources} onAttach={onUse} />}
    </div>
  );
}
