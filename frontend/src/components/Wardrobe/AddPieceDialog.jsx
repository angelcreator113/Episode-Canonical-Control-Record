/**
 * Producer Mode → Wardrobe → Add piece (Evoni, 2026-10-07: "fix and redesign
 * wardrobe add piece"), in the Overlays and Scene Sets style: a photo, the
 * piece, then "In the story" and "More" folded away.
 *
 * Fixes over the old modal (WorldAdmin's "Add Wardrobe Item"):
 *   - clicking outside, or Escape, no longer throws away a started piece;
 *   - an upload error stays in the dialog, in plain words, with the piece kept;
 *   - a photo the server could not store is said, not hidden behind "Item uploaded!";
 *   - auto-fill errors are plain words (no .env, PM2 or service-worker steps);
 *   - the button says what is missing ("Add a photo and a name");
 *   - the photo preview's object URL is released;
 *   - one column at phone width.
 *
 * Data: POST /api/v1/wardrobe-library/analyze-image (Fill in from the photo)
 * and POST /api/v1/wardrobe (the piece). Pure helpers: lib/wardrobeAddPiece.
 * onAdded(item, { photoDropped }) lets the closet add it and track its
 * background removal.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { Heart, ImagePlus, Loader2, Wand2, X } from 'lucide-react';
import api from '../../services/api';
import { SLOT_KEYS, SLOT_DEFS, SLOT_SUBCATEGORIES } from '../../lib/wardrobeSlots';
import {
  EMPTY_PIECE, SEASONS, TIERS, ACQUISITIONS, LOCKS, ERAS,
  missingForAdd, missingText, applyAutoFill, pieceFormData, autoFillErrorText, uploadErrorText, photoDropped,
} from '../../lib/wardrobeAddPiece';
import './AddPieceDialog.css';

const AUTO_FILL_TIMEOUT_MS = 120000;

function Field({ label, hint, children, wide = false }) {
  return (
    <label className={`apd-field${wide ? ' is-wide' : ''}`}>
      <span className="apd-label">{label}</span>
      {children}
      {hint && <span className="apd-hint">{hint}</span>}
    </label>
  );
}

const LOCK_WORDS = { none: 'always available', coin: 'unlocked with coins', reputation: 'reputation gate', brand_exclusive: 'brand exclusive', season_drop: 'season drop' };

/** "Lala owns it · purchased · always available": what In the story holds, closed. */
const storyLine = (f) => [
  f.isOwned ? 'Lala owns it' : 'Lala does not own it yet',
  f.acquisitionType || 'purchased',
  LOCK_WORDS[f.lockType || 'none'] || f.lockType,
  f.coinCost ? `${Number(f.coinCost).toLocaleString()} coins` : null,
].filter(Boolean).join(' · ');

export default function AddPieceDialog({ showId, onClose, onAdded }) {
  const titleId = useId();
  const [form, setForm] = useState({ ...EMPTY_PIECE });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fictionalBrand, setFictionalBrand] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoFillError, setAutoFillError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const missing = missingForAdd(form, file);
  const dirty = useMemo(() => Boolean(file) || Object.keys(EMPTY_PIECE).some((k) => form[k] !== EMPTY_PIECE[k]), [form, file]);
  const busy = analyzing || saving;

  // The preview's object URL is released when it changes or the dialog closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Escape closes a dialog with nothing in it; a started piece needs Cancel.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !dirty && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, busy, onClose]);

  const choose = (f) => {
    if (!f || !String(f.type || '').startsWith('image/')) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setAutoFillError(null);
    setFictionalBrand(false);
  };

  const clearPhoto = () => { setFile(null); setPreview(null); setAutoFillError(null); setFictionalBrand(false); };

  const autoFill = async () => {
    setAnalyzing(true);
    setAutoFillError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      // With the show, the server adds the gameplay suggestions.
      if (showId) fd.append('showId', showId);
      const res = await api.post('/api/v1/wardrobe-library/analyze-image', fd, { timeout: AUTO_FILL_TIMEOUT_MS });
      const answer = res.data || {};
      if (!answer.success || !answer.data) {
        console.error('[AddPiece] auto-fill refused:', answer.error, answer);
        setAutoFillError(autoFillErrorText({ message: answer.error || '' }));
        return;
      }
      setFictionalBrand(Boolean(answer.data.brand_is_fictional));
      setForm((prev) => applyAutoFill(prev, answer));
    } catch (err) {
      console.error('[AddPiece] auto-fill failed:', err);
      setAutoFillError(autoFillErrorText(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/wardrobe', pieceFormData(form, file, showId));
      const saved = res.data?.data || null;
      onAdded?.(saved, { photoDropped: photoDropped(file, saved), response: res.data });
    } catch (err) {
      console.error('[AddPiece] upload failed:', err);
      setError(uploadErrorText(err));
      setSaving(false);
    }
  };

  return (
    <div className="apd-backdrop" onClick={() => { if (!dirty && !busy) onClose(); }} data-testid="add-piece-backdrop">
      <div className="apd-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} data-testid="add-piece-dialog">
        <header className="apd-head">
          <div>
            <h3 id={titleId} className="apd-title">Add a piece</h3>
            <p className="apd-sub">To Lala&apos;s closet. Start from a photo; the rest can fill itself in.</p>
          </div>
          <button type="button" className="apd-icon" onClick={onClose} disabled={saving} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="apd-body">
          <div className="apd-photo-col">
            <div
              className={`apd-drop${preview ? ' has-photo' : ''}`}
              role="button" tabIndex={0} aria-label={preview ? 'Change the photo' : 'Choose a photo'}
              onClick={() => document.getElementById(`${titleId}-file`)?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById(`${titleId}-file`)?.click(); } }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files?.[0]); }}
              data-testid="add-piece-drop"
            >
              {preview ? (
                <img src={preview} alt="The piece" />
              ) : (
                <span className="apd-drop-empty">
                  <ImagePlus size={26} aria-hidden="true" />
                  <strong>Add a photo</strong>
                  <span>Drop it here or click to choose</span>
                </span>
              )}
              <input
                id={`${titleId}-file`} type="file" accept="image/*" hidden data-testid="add-piece-file"
                onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
            {file && (
              <div className="apd-photo-actions">
                <button type="button" className="apd-btn is-soft" onClick={autoFill} disabled={busy} data-testid="add-piece-autofill">
                  {analyzing ? <Loader2 size={14} className="apd-spin" aria-hidden="true" /> : <Wand2 size={14} aria-hidden="true" />}
                  {analyzing ? 'Reading the photo…' : 'Fill in from the photo'}
                </button>
                <button type="button" className="apd-link" onClick={clearPhoto} disabled={busy}>Remove photo</button>
              </div>
            )}
            {autoFillError && <p className="apd-error" role="alert" data-testid="add-piece-autofill-error">{autoFillError}</p>}
          </div>

          <div className="apd-fields">
            <section className="apd-section" aria-label="The piece">
              <div className="apd-grid">
                <Field label="Name *" wide>
                  <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Floral mini dress" />
                </Field>
                <Field label="Category *">
                  <select value={form.clothingCategory} onChange={(e) => set({ clothingCategory: e.target.value })}>
                    <option value="">Choose…</option>
                    {SLOT_KEYS.map((slot) => (
                      <optgroup key={slot} label={SLOT_DEFS[slot].label}>
                        {SLOT_SUBCATEGORIES[slot].map((sub) => <option key={sub.value} value={sub.value}>{sub.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Brand" hint={fictionalBrand ? 'A LalaVerse brand, filled in from the photo' : null}>
                  <input value={form.brand} onChange={(e) => { setFictionalBrand(false); set({ brand: e.target.value }); }} placeholder="Velvet House" />
                </Field>
                <Field label="Colour">
                  <input value={form.color} onChange={(e) => set({ color: e.target.value })} placeholder="Blush pink" />
                </Field>
                <Field label="Tier">
                  <select value={form.tier} onChange={(e) => set({ tier: e.target.value })}>
                    {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Price ($)">
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="650" />
                </Field>
                <Field label="Season">
                  <select value={form.season} onChange={(e) => set({ season: e.target.value })}>
                    <option value="">Any</option>
                    {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Occasion" wide>
                  <input value={form.occasion} onChange={(e) => set({ occasion: e.target.value })} placeholder="Gala, brunch, casual" />
                </Field>
                <Field label="Description" wide>
                  <textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Material, cut, fit, details" />
                </Field>
                <Field label="Tags" hint="Separated by commas" wide>
                  <input value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="elegant, evening, silk" />
                </Field>
                <Field label="Where to buy it" wide>
                  <input type="url" value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://…" />
                </Field>
              </div>
              <label className="apd-check">
                <input type="checkbox" checked={form.isFavorite} onChange={(e) => set({ isFavorite: e.target.checked })} />
                <Heart size={14} aria-hidden="true" /> A favourite
              </label>
            </section>

            <details className="apd-more" data-testid="add-piece-story">
              <summary>
                <span className="apd-more-title">In the story</span>
                <span className="apd-more-line">{storyLine(form)}</span>
              </summary>
              <div className="apd-grid">
                <Field label="Story price (coins)" hint="Empty: the price, a coin a dollar">
                  <input type="number" min="0" step="1" value={form.coinCost} onChange={(e) => set({ coinCost: e.target.value })} placeholder="2400" />
                </Field>
                <Field label="How Lala got it">
                  <select value={form.acquisitionType} onChange={(e) => set({ acquisitionType: e.target.value })}>
                    {ACQUISITIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Lock">
                  <select value={form.lockType} onChange={(e) => set({ lockType: e.target.value, isOwned: e.target.value === 'none' })}>
                    {LOCKS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </Field>
                <Field label="Era">
                  <select value={form.eraAlignment} onChange={(e) => set({ eraAlignment: e.target.value })}>
                    {ERAS.map((era) => <option key={era.value} value={era.value}>{era.label}</option>)}
                  </select>
                </Field>
                {form.lockType === 'reputation' && (
                  <Field label="Reputation needed">
                    <input type="number" min="0" step="1" value={form.reputationRequired} onChange={(e) => set({ reputationRequired: e.target.value })} placeholder="5" />
                  </Field>
                )}
              </div>
              <label className="apd-check">
                <input type="checkbox" checked={form.isOwned} onChange={(e) => set({ isOwned: e.target.checked })} /> Lala already owns it
              </label>
            </details>

            <details className="apd-more">
              <summary>
                <span className="apd-more-title">More</span>
                <span className="apd-more-line">Lala&apos;s reactions, tag buckets, scoring and unlocks</span>
              </summary>
              <div className="apd-grid">
                <Field label="Lala, when she owns it" wide>
                  <textarea rows={2} value={form.lalaReactionOwn} onChange={(e) => set({ lalaReactionOwn: e.target.value })} placeholder="My ride-or-die for red carpets" />
                </Field>
                <Field label="Lala, when it is locked" wide>
                  <textarea rows={2} value={form.lalaReactionLocked} onChange={(e) => set({ lalaReactionLocked: e.target.value })} placeholder="One day…" />
                </Field>
                <Field label="Lala, when she passes on it" wide>
                  <textarea rows={2} value={form.lalaReactionReject} onChange={(e) => set({ lalaReactionReject: e.target.value })} placeholder="Not the vibe for tonight" />
                </Field>
                <Field label="Aesthetic tags" hint="Separated by commas" wide>
                  <input value={form.aestheticTags} onChange={(e) => set({ aestheticTags: e.target.value })} placeholder="romantic, bold, editorial" />
                </Field>
                <Field label="Event types" hint="Separated by commas" wide>
                  <input value={form.eventTypes} onChange={(e) => set({ eventTypes: e.target.value })} placeholder="gala, brunch, meetup" />
                </Field>
                <Field label="Match weight (1–10)">
                  <input type="number" min="1" max="10" step="1" value={form.outfitMatchWeight} onChange={(e) => set({ outfitMatchWeight: e.target.value })} placeholder="5" />
                </Field>
                <Field label="Influence needed">
                  <input type="number" min="0" step="1" value={form.influenceRequired} onChange={(e) => set({ influenceRequired: e.target.value })} placeholder="0" />
                </Field>
                <Field label="Unlocks at episode">
                  <input type="number" min="1" step="1" value={form.seasonUnlockEpisode} onChange={(e) => set({ seasonUnlockEpisode: e.target.value })} placeholder="1" />
                </Field>
              </div>
              <label className="apd-check">
                <input type="checkbox" checked={form.isVisible !== false} onChange={(e) => set({ isVisible: e.target.checked })} /> Shown in the closet
              </label>
            </details>
          </div>
        </div>

        <footer className="apd-foot">
          {error && <p className="apd-error" role="alert" data-testid="add-piece-error">{error}</p>}
          {!error && missing.length > 0 && <p className="apd-missing" data-testid="add-piece-missing">{missingText(missing)}</p>}
          <div className="apd-actions">
            <button type="button" className="apd-btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="apd-btn is-primary" onClick={add} disabled={busy || missing.length > 0} data-testid="add-piece-save">
              {saving && <Loader2 size={14} className="apd-spin" aria-hidden="true" />}
              {saving ? 'Adding…' : 'Add to closet'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
