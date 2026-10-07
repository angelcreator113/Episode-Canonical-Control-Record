/**
 * Edit show (/shows/:id/edit; Evoni, 2026-10-07: "i cant edit the show
 * something is wrong with that page and also it needs redesign").
 *
 * Fixed: the old page loaded a category the show doesn't have, showed
 * "Lifestyle" and refused to save ("Category is required"); it sent
 * tagline, category and primaryColor, which PUT /shows/:id ignores, and a
 * 'draft' status the column refuses (a 500). It now edits the show's own
 * fields (lib/showEdit): name, tagline (in metadata, beside the show's
 * settings, which a save keeps), description, genre, status, icon, colour
 * and the cover (POST /shows/:id/cover-image, portrait 2:3, saved at once).
 *
 * Redesigned in the Overlays and Scene Sets style: a hero with the show's
 * cover and name, then The show, Look and Status cards, a save bar that
 * says what is unsaved, and Delete behind typing the show's name.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import api from '../services/api';
import { STATUSES, GENRES, DEFAULT_SWATCH, formFromShow, formErrors, showUpdate, saveErrorText } from '../lib/showEdit';
import './EditShow.css';

const errorText = (err) => err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Something went wrong';

function Field({ id, label, hint, error, wide = false, children }) {
  return (
    <div className={`esh-field${wide ? ' is-wide' : ''}`}>
      <label className="esh-label" htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="esh-field-error" role="alert">{error}</span> : hint && <span className="esh-hint">{hint}</span>}
    </div>
  );
}

export default function EditShow() {
  const { id: showId } = useParams();
  const navigate = useNavigate();
  const coverInput = useRef(null);
  const [show, setShow] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.get(`/api/v1/shows/${showId}`);
      const data = res.data?.data || res.data?.show || null;
      if (!data?.id) throw new Error('Show not found');
      setShow(data);
      const f = formFromShow(data);
      setForm(f);
      setSaved(f);
    } catch (err) {
      console.error('[EditShow] load failed:', err);
      setLoadError(err?.response?.status === 404 ? 'This show was not found.' : errorText(err));
    }
  }, [showId]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setSaveError(null); };
  const errors = useMemo(() => (form ? formErrors(form) : {}), [form]);
  const dirty = useMemo(() => Boolean(form && saved && Object.keys(form).some((k) => form[k] !== saved[k])), [form, saved]);
  const shown = (field) => (showErrors ? errors[field] : null);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (Object.keys(errors).length) { setShowErrors(true); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.put(`/api/v1/shows/${showId}`, showUpdate(form, show));
      const next = res.data?.data || { ...show, ...showUpdate(form, show) };
      setShow(next);
      const f = formFromShow(next);
      setForm(f);
      setSaved(f);
      setShowErrors(false);
      flash('Show saved');
    } catch (err) {
      console.error('[EditShow] save failed:', err);
      setSaveError(saveErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) { setCoverError('Choose an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setCoverError('The image is too large. Try one under 10 MB.'); return; }
    setCoverBusy(true);
    setCoverError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post(`/api/v1/shows/${showId}/cover-image`, fd);
      const url = res.data?.data?.coverImageUrl || res.data?.coverImageUrl;
      setShow((s) => ({ ...s, coverImageUrl: url || s.coverImageUrl }));
      flash('Cover saved');
    } catch (err) {
      console.error('[EditShow] cover upload failed:', err);
      setCoverError(`The cover wasn't saved: ${errorText(err)}`);
    } finally {
      setCoverBusy(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/v1/shows/${showId}`);
      navigate('/shows');
    } catch (err) {
      console.error('[EditShow] delete failed:', err);
      setDeleteError(`The show wasn't deleted: ${errorText(err)}`);
      setDeleting(false);
    }
  };

  const backPath = `/shows/${showId}`;

  if (loadError) {
    return (
      <div className="esh">
        <Link className="esh-back" to="/shows"><ArrowLeft size={14} aria-hidden="true" /> All shows</Link>
        <p className="esh-error" role="alert" data-testid="edit-show-load-error">{loadError}</p>
        <button type="button" className="esh-btn" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!form) return <div className="esh"><p className="esh-muted"><Loader2 size={14} className="esh-spin" aria-hidden="true" /> Loading the show…</p></div>;

  return (
    <div className="esh" data-testid="edit-show">
      <Link className="esh-back" to={backPath}><ArrowLeft size={14} aria-hidden="true" /> Back to the show</Link>

      <header className="esh-hero">
        <span className="esh-hero-cover" aria-hidden="true">
          {show?.coverImageUrl ? <img src={show.coverImageUrl} alt="" /> : <span>{form.icon || show?.icon || '📺'}</span>}
        </span>
        <div className="esh-hero-text">
          <h1 className="esh-title">{form.name || 'Untitled show'}</h1>
          <p className="esh-sub">{form.tagline || 'Edit the show’s name, look and status.'}</p>
        </div>
      </header>

      <section className="esh-card" aria-labelledby="esh-show-title">
        <h2 id="esh-show-title" className="esh-card-title">The show</h2>
        <div className="esh-grid">
          <Field id="esh-name" label="Name *" error={shown('name')}>
            <input id="esh-name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={255} />
          </Field>
          <Field id="esh-genre" label="Genre" hint="Choose or type; several with commas">
            <input id="esh-genre" list="esh-genres" value={form.genre} onChange={(e) => set({ genre: e.target.value })} placeholder="Fashion, Lifestyle" />
            <datalist id="esh-genres">{GENRES.map((g) => <option key={g} value={g} />)}</datalist>
          </Field>
          <Field id="esh-tagline" label="Tagline" hint="One line that sums the show up" wide>
            <input id="esh-tagline" value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Styling Adventures with Lala" />
          </Field>
          <Field id="esh-description" label="Description" wide>
            <textarea id="esh-description" rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What the show is about, and what viewers can expect" />
          </Field>
        </div>
      </section>

      <section className="esh-card" aria-labelledby="esh-look-title">
        <h2 id="esh-look-title" className="esh-card-title">Look</h2>
        <div className="esh-look">
          <div className="esh-cover-col">
            <button
              type="button" className={`esh-cover${show?.coverImageUrl ? ' has-image' : ''}`}
              onClick={() => coverInput.current?.click()} disabled={coverBusy} data-testid="edit-show-cover"
              aria-label={show?.coverImageUrl ? 'Replace the cover' : 'Add a cover'}
            >
              {show?.coverImageUrl ? <img src={show.coverImageUrl} alt="The show's cover" /> : (
                <span className="esh-cover-empty"><ImagePlus size={24} aria-hidden="true" /><strong>Add a cover</strong><span>Portrait, 2:3</span></span>
              )}
              {coverBusy && <span className="esh-cover-busy"><Loader2 size={18} className="esh-spin" aria-hidden="true" /> Saving…</span>}
            </button>
            <input ref={coverInput} type="file" accept="image/*" hidden data-testid="edit-show-cover-file"
              onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ''; }} />
            <span className="esh-hint">The cover saves as soon as it is chosen.</span>
            {coverError && <span className="esh-field-error" role="alert">{coverError}</span>}
          </div>
          <div className="esh-grid">
            <Field id="esh-icon" label="Icon" hint="An emoji for lists and menus" error={shown('icon')}>
              <input id="esh-icon" value={form.icon} onChange={(e) => set({ icon: e.target.value })} maxLength={10} placeholder="📺" />
            </Field>
            <Field id="esh-color" label="Colour" error={shown('color')} hint="The show's colour in lists and badges">
              <span className="esh-color">
                <input type="color" aria-label="Pick the colour" value={form.color || DEFAULT_SWATCH} onChange={(e) => set({ color: e.target.value })} />
                <input id="esh-color" value={form.color} onChange={(e) => set({ color: e.target.value.trim() })} placeholder={DEFAULT_SWATCH} maxLength={7} />
              </span>
            </Field>
          </div>
        </div>
      </section>

      <section className="esh-card" aria-labelledby="esh-status-title">
        <h2 id="esh-status-title" className="esh-card-title">Status</h2>
        <div className="esh-status" role="radiogroup" aria-labelledby="esh-status-title">
          {STATUSES.map((s) => (
            <label key={s.value} className={`esh-status-option${form.status === s.value ? ' is-on' : ''}`}>
              <input type="radio" name="esh-status" value={s.value} checked={form.status === s.value} onChange={() => set({ status: s.value })} />
              <strong>{s.label}</strong>
              <span>{s.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="esh-card is-danger" aria-labelledby="esh-delete-title">
        <h2 id="esh-delete-title" className="esh-card-title">Delete the show</h2>
        <p className="esh-muted">Its episodes, assets and world go with it, and it can&apos;t be undone. Type the show&apos;s name to delete it.</p>
        <div className="esh-delete">
          <input aria-label="The show's name, to delete it" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={show?.name || ''} />
          <button type="button" className="esh-btn is-danger" onClick={remove} disabled={deleting || confirmName.trim() !== (show?.name || '').trim()} data-testid="edit-show-delete">
            {deleting ? <Loader2 size={14} className="esh-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />} Delete show
          </button>
        </div>
        {deleteError && <p className="esh-error" role="alert">{deleteError}</p>}
      </section>

      <div className={`esh-bar${dirty ? ' is-dirty' : ''}`} data-testid="edit-show-bar">
        <span className={`esh-bar-text${saveError ? ' is-error' : ''}`} data-testid="edit-show-state" role={saveError ? 'alert' : undefined}>
          {saveError || (showErrors && Object.keys(errors).length ? 'Fix the marked fields to save.' : dirty ? 'Unsaved changes' : 'All changes saved')}
        </span>
        <button type="button" className="esh-btn" onClick={() => (dirty ? setForm(saved) : navigate(backPath))} disabled={saving}>
          {dirty ? 'Discard' : 'Done'}
        </button>
        <button type="button" className="esh-btn is-primary" onClick={save} disabled={saving || !dirty} data-testid="edit-show-save">
          {saving && <Loader2 size={14} className="esh-spin" aria-hidden="true" />} {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {toast && <div className="esh-toast" role="status">{toast}</div>}
    </div>
  );
}
