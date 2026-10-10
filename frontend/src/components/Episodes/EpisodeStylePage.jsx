/**
 * Production → Style Page (was Lookbook; docs/design/2026-10-landing-and-
 * stylesheet.md Part 2, "Style Page"; Task #2876). The style sheet is the
 * editor: it is drawn at its real layout on the left (scaled to fit), every
 * empty spot is a dashed "+ Add" button in place, and the spot you tap opens
 * in the panel on the right: Upload, a picker from the To sort tray, and the
 * readiness bar ("Ready x of 12", one chip per item, from styleReadiness).
 * What you see is what exports.
 *
 * Data: the Lookbook routes (lib/lookbookApi) and GET /episodes/:id/style-
 * sheet for the sheet itself. Share & export (Task #2877) downloads the
 * approved sheet in each size, drawn on the server; editing an approved
 * sheet returns it to Draft. Every value is the episode's
 * own data; an empty one shows its "+ Add" spot (Evoni, 2026-10-10: real
 * data only). Reloads keep the page in place, and tapping never scrolls it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, ImagePlus, Loader2, Lock, RotateCcw, Shirt, Trash2, Upload } from 'lucide-react';
import api from '../../services/api';
import { lookbookApi } from '../../lib/lookbookApi';
import { styleReadiness } from '../../lib/styleReadiness';
import { extractPalette } from '../../lib/stylePalette';
import { styleSheetApi } from './EpisodeStyleSheetPanel';
import StyleSheetTemplate, { SHEET_HEIGHT, SHEET_WIDTH } from './StyleSheetTemplate';
import './EpisodeStylePage.css';

const ACCEPT = 'image/png,image/jpeg,image/webp';
const MAX_INSPO = 2;
const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

// Every spot on the sheet: its section, its name, and the panel's one-line hint.
export const SPOT_INFO = {
  front: { section: 'Lala in the look', label: 'Front', hint: 'Full body, from the front.', photo: true },
  side: { section: 'Lala in the look', label: 'Side', hint: 'Full body, from the side.', photo: true },
  back: { section: 'Lala in the look', label: 'Back', hint: 'Full body, from the back.', photo: true },
  hero: { section: 'Lala in the look', label: 'Hero', hint: 'The big shot, in the tilted frame.', photo: true },
  hair: { section: 'Wardrobe breakdown', label: 'Hair', hint: 'A photo of the hair and its name; the name prints under HAIR.', photo: true, name: 'hair_name' },
  nails: { section: 'Wardrobe breakdown', label: 'Nails', hint: 'A photo of the nails and their name; the name prints under NAILS.', photo: true, name: 'nails_name' },
  eyes: { section: 'Beauty details', label: 'Eyes', hint: 'A close-up of the eye makeup.', photo: true, notes: true },
  lips: { section: 'Beauty details', label: 'Lips', hint: 'A close-up of the lips.', photo: true, notes: true },
  skin: { section: 'Beauty details', label: 'Skin', hint: 'A close-up of the skin and base.', photo: true, notes: true },
  venue: { section: 'The venue', label: 'Venue', hint: "From the event's scene set: Swap cycles its images, or add your own.", photo: true },
  inspo: { section: 'Key inspo', label: 'Inspo', hint: "Up to two of your photos; the two textures are cut from the look's pieces automatically.", photo: true },
  wardrobe: { section: 'Wardrobe breakdown', label: 'Pieces', hint: "The pieces come from the episode's saved look. Every required slot, Body included, needs one." },
  palette: { section: 'Color palette', label: 'Palette', hint: "Five colours taken from the pieces' images; adjust any of them." },
  tagline: { section: 'Footer', label: 'Tagline', hint: 'One line in script on the footer. Type it on the sheet or here.' },
};
// Share & export: each size of the approved sheet, drawn on the server.
export const EXPORT_SIZES = [
  { size: 'sheet', label: 'Style sheet PNG', detail: '1024 × 1536' },
  { size: 'pin', label: 'Pinterest pin', detail: '1000 × 1500' },
  { size: 'story', label: 'Instagram story', detail: '1080 × 1920, padded' },
  { size: 'post', label: 'Instagram post', detail: '1080 × 1350, the top of the sheet' },
  { size: 'look', label: 'The look only', detail: 'Front, side and back' },
  { size: 'pdf', label: 'Print PDF', detail: '8 × 12 in' },
];

// A readiness chip opens its spot (Beauty opens Eyes).
const CHIP_SPOT = { beauty: 'eyes' };

function FileButton({ label, onFiles, multiple = false, disabled, className = '', icon: Icon = Upload }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" className={`esp2-btn ${className}`} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Icon size={16} aria-hidden="true" /> {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        hidden
        aria-label={label}
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

export default function EpisodeStylePage({ episode, onOpenTab }) {
  const episodeId = episode?.id;
  const [lb, setLb] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [palette, setPalette] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState({ tagline: '', hair_name: '', nails_name: '' });
  const [dragging, setDragging] = useState(false);
  const sheetCol = useRef(null);
  const [scale, setScale] = useState(0.5);

  const loadSheet = useCallback(async () => {
    try {
      setSheet(await styleSheetApi.get(episodeId));
    } catch (err) {
      console.error('[StylePage] style sheet read failed:', err);
      setError(errorText(err));
    }
  }, [episodeId]);

  const load = useCallback(async () => {
    if (!episodeId) return;
    try {
      const [l] = await Promise.all([lookbookApi.get(episodeId), loadSheet()]);
      setLb(l);
      setError(null);
    } catch (err) {
      console.error('[StylePage] load failed:', err);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [episodeId, loadSheet]);
  useEffect(() => { load(); }, [load]);

  // The saved names and tagline, unless a field is being typed in.
  useEffect(() => {
    if (!lb) return;
    setText({ tagline: lb.tagline || '', hair_name: lb.hair_name || '', nails_name: lb.nails_name || '' });
  }, [lb]);

  // The saved palette, else five colours taken from the piece images.
  useEffect(() => {
    let cancelled = false;
    if (!sheet) return undefined;
    if (sheet.palette) { setPalette(sheet.palette); return undefined; }
    if (!sheet.palette_sources?.length) { setPalette(null); return undefined; }
    extractPalette(sheet.palette_sources).then((p) => { if (!cancelled) setPalette(p.length ? p : null); })
      .catch((err) => console.error('[StylePage] palette extraction failed:', err));
    return () => { cancelled = true; };
  }, [sheet]);

  // The sheet fits its column.
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (sheetCol.current?.clientWidth || SHEET_WIDTH / 2) / SHEET_WIDTH));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [loading]);

  // Every Lookbook write returns the Lookbook; the sheet is read again after.
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      const next = await fn();
      if (next && next.images) setLb(next);
      await loadSheet();
      setError(null);
    } catch (err) {
      console.error('[StylePage] save failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, [loadSheet]);

  if (loading) {
    return <div className="esp2-page esp2-loading"><Loader2 size={18} className="esp2-spin" aria-hidden="true" /> Loading the Style Page…</div>;
  }
  if (!lb || !sheet) {
    return <div className="esp2-page"><p className="esp2-error" role="alert">{error || 'The Style Page could not be loaded.'}</p></div>;
  }

  const approved = lb.sheet_status === 'approved' && sheet.status === 'approved';
  // Editing an approved sheet returns it to Draft (the server does it), so
  // nothing locks while it is approved; only a save in flight does.
  const locked = busy;
  const canExport = approved && !sheet.stale;
  const tray = lb.images?.unsorted || [];
  const readiness = styleReadiness({ lookbook: lb, sheet, palette });
  const info = selected ? SPOT_INFO[selected] : null;

  const upload = (files, category) => run(() => lookbookApi.upload(episodeId, files, category));
  const remove = (imageId) => run(() => lookbookApi.remove(episodeId, imageId));
  const move = (imageId, changes) => run(() => lookbookApi.move(episodeId, imageId, changes));
  const saveFields = (fields) => run(() => lookbookApi.save(episodeId, fields));
  const commitText = (field) => {
    const saved = lb[field] || '';
    if ((text[field] || '') !== saved) saveFields({ [field]: text[field] });
  };

  // Venue: the event scene set's images, then her own; Swap shows the next
  // one by putting it In lookbook and first in order (what the sheet shows).
  const venueCandidates = [
    ...(lb.venue_options || []).map((o) => ({ kind: 'option', key: `${o.source}-${o.ref_id}`, imageId: o.image_id, inLookbook: o.in_lookbook, opt: o })),
    ...(lb.images?.venue || []).filter((i) => i.source === 'upload').map((i) => ({ kind: 'upload', key: i.id, imageId: i.id, inLookbook: i.in_lookbook })),
  ];
  const swapVenue = () => run(async () => {
    if (venueCandidates.length < 2) return null;
    const shownId = sheet.venue?.chosen_image_id || null;
    const idx = Math.max(0, venueCandidates.findIndex((c) => c.imageId && c.imageId === shownId));
    const next = venueCandidates[(idx + 1) % venueCandidates.length];
    let now = lb;
    let nextId = next.imageId;
    if (!next.inLookbook) {
      if (next.kind === 'option') {
        now = await lookbookApi.venue(episodeId, { source: next.opt.source, ref_id: next.opt.ref_id, in_lookbook: true });
        nextId = (now.venue_options || []).find((o) => o.source === next.opt.source && o.ref_id === next.opt.ref_id)?.image_id || null;
      } else {
        now = await lookbookApi.move(episodeId, next.imageId, { in_lookbook: true });
      }
    }
    const order = [nextId, ...(now.images?.venue || []).filter((i) => i.in_lookbook && i.id !== nextId).map((i) => i.id)].filter(Boolean);
    for (let i = 0; i < order.length; i++) now = await lookbookApi.move(episodeId, order[i], { sort_order: i });
    return now;
  });

  const savePalette = (next) => run(() => lookbookApi.save(episodeId, { palette: next }));
  const approve = () => run(async () => {
    // The palette shown is the one approved: save one taken from the pieces first.
    if (!sheet.palette && palette?.length) await lookbookApi.save(episodeId, { palette });
    await styleSheetApi.approve(episodeId);
    return lookbookApi.get(episodeId);
  });
  const reopen = () => run(async () => { await styleSheetApi.reopen(episodeId); return lookbookApi.get(episodeId); });

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (locked) return;
    const files = [...(e.dataTransfer?.files || [])].filter((f) => ACCEPT.split(',').includes(f.type));
    if (files.length) upload(files);
  };

  const edit = {
    selected,
    onSelect: setSelected,
    locked: false,
    text,
    onText: (field, value) => setText((t) => ({ ...t, [field]: value })),
    onCommit: commitText,
    canSwapVenue: venueCandidates.length > 1,
    onSwapVenue: swapVenue,
  };

  return (
    <div
      className={`esp2-page${dragging ? ' is-dragging' : ''}`}
      data-testid="episode-style-page"
      onDragOver={(e) => { e.preventDefault(); if (!locked) setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={onDrop}
    >
      <header className="esp2-header">
        <div className="esp2-title-row">
          <h2 className="esp2-title">Style Page</h2>
          <span className={`esp2-pill ${approved ? 'is-approved' : 'is-draft'}`} data-testid="esp2-status">
            {approved ? <><Lock size={12} aria-hidden="true" /> Approved</> : 'Draft'}
          </span>
          {sheet.stale && <span className="esp2-pill is-stale">Out of date: the event or look changed since approval</span>}
        </div>
        <div className="esp2-header-actions">
          <FileButton label="Drop photos to sort" icon={ImagePlus} multiple onFiles={(files) => upload(files)} disabled={locked} />
          {approved ? (
            <button type="button" className="esp2-btn" disabled={busy} onClick={reopen}><RotateCcw size={16} aria-hidden="true" /> Reopen</button>
          ) : (
            <button type="button" className="esp2-btn esp2-btn-primary" disabled={busy} onClick={approve}><CheckCircle2 size={16} aria-hidden="true" /> Approve</button>
          )}
        </div>
      </header>

      {approved && <p className="esp2-note">Approved. Editing anything returns it to Draft, and it needs approving again before it can be exported.</p>}
      {error && <p className="esp2-error" role="alert">{error}</p>}

      <div className="esp2-layout">
        <div className="esp2-sheet-col" ref={sheetCol}>
          <div className="esp2-sheet-frame" style={{ height: SHEET_HEIGHT * scale }}>
            <div className="esp2-sheet-scale" style={{ transform: `scale(${scale})`, width: SHEET_WIDTH }}>
              <StyleSheetTemplate sheet={sheet} palette={palette} edit={edit} />
            </div>
          </div>
        </div>

        <aside className="esp2-panel" aria-label="Editing panel">
          {info ? (
            <SpotPanel
              spot={selected}
              info={info}
              lb={lb}
              sheet={sheet}
              palette={palette}
              setPalette={setPalette}
              savePalette={savePalette}
              text={text}
              setText={(field, value) => setText((t) => ({ ...t, [field]: value }))}
              commitText={commitText}
              tray={tray}
              locked={locked}
              venueCandidates={venueCandidates}
              upload={upload}
              remove={remove}
              move={move}
              saveFields={saveFields}
              swapVenue={swapVenue}
              toggleOption={(o) => run(() => lookbookApi.venue(episodeId, { source: o.source, ref_id: o.ref_id, in_lookbook: !o.in_lookbook }))}
              onOpenTab={onOpenTab}
            />
          ) : (
            <p className="esp2-panel-empty">Tap a spot on the sheet to edit it. Dashed spots are waiting for a photo.</p>
          )}

          <section className="esp2-ready" aria-label="Readiness">
            <div className="esp2-ready-head">
              <span className="esp2-ready-label" data-testid="esp2-ready">Ready {readiness.done} of {readiness.total}</span>
            </div>
            <div className="esp2-bar" role="progressbar" aria-label="Style sheet readiness" aria-valuemin={0} aria-valuemax={readiness.total} aria-valuenow={readiness.done}>
              <span style={{ width: `${Math.round((readiness.done / readiness.total) * 100)}%` }} />
            </div>
            <ul className="esp2-chips">
              {readiness.items.map((c) => (
                <li key={c.key}>
                  <button type="button" className={`esp2-chip${c.ready ? ' is-ready' : ''}${selected === (CHIP_SPOT[c.key] || c.key) ? ' is-selected' : ''}`}
                    aria-pressed={selected === (CHIP_SPOT[c.key] || c.key)} data-testid={`esp2-chip-${c.key}`}
                    onClick={() => setSelected(CHIP_SPOT[c.key] || c.key)}>
                    {c.ready ? <CheckCircle2 size={14} aria-hidden="true" /> : <span className="esp2-chip-dot" aria-hidden="true" />}
                    {c.label}<span className="esp2-sr">{c.ready ? ', ready' : ', not ready'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <ShareExport episodeId={episodeId} episodeNumber={sheet.episode?.number} canExport={canExport} approved={approved} stale={sheet.stale} />
        </aside>
      </div>
    </div>
  );
}

function SpotPanel({ spot, info, lb, sheet, palette, setPalette, savePalette, text, setText, commitText, tray, locked, venueCandidates, upload, remove, move, saveFields, swapVenue, toggleOption, onOpenTab }) {
  const images = lb.images || {};
  const current = info.photo && spot !== 'venue' && spot !== 'inspo' ? (images[spot] || [])[0] || null : null;
  const inspo = (images.inspo || []).filter((i) => i.source === 'upload');
  const notes = lb.beauty_notes || {};
  const fullInspo = spot === 'inspo' && inspo.length >= MAX_INSPO;

  return (
    <section className="esp2-spot" aria-labelledby="esp2-spot-title" data-testid="esp2-spot-panel">
      <h3 id="esp2-spot-title" className="esp2-spot-title">Editing {info.section} · {info.label}</h3>
      <p className="esp2-hint">{info.hint}</p>

      {current && (
        <div className="esp2-current">
          <img src={current.image_url} alt={`${info.label} photo`} />
          <button type="button" className="esp2-icon-btn" aria-label={`Remove ${info.label} photo`} disabled={locked} onClick={() => remove(current.id)}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {spot === 'inspo' && inspo.length > 0 && (
        <ul className="esp2-thumbs">
          {inspo.map((p, i) => (
            <li key={p.id} className="esp2-current">
              <img src={p.image_url} alt={`Inspo ${i + 1}`} />
              <button type="button" className="esp2-icon-btn" aria-label={`Remove inspo ${i + 1}`} disabled={locked} onClick={() => remove(p.id)}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {spot === 'venue' && (
        <>
          {venueCandidates.length > 1 && (
            <button type="button" className="esp2-btn" disabled={locked} onClick={swapVenue}><RotateCcw size={16} aria-hidden="true" /> Swap</button>
          )}
          {(lb.venue_options || []).length > 0 && (
            <ul className="esp2-thumbs" aria-label={`${lb.scene_set?.name || 'Scene set'} images`}>
              {lb.venue_options.map((o) => (
                <li key={`${o.source}-${o.ref_id}`}>
                  <button type="button" className={`esp2-thumb${o.in_lookbook ? ' is-in' : ''}`} aria-pressed={o.in_lookbook} disabled={locked} onClick={() => toggleOption(o)}>
                    <img src={o.image_url} alt={`${o.label}, ${lb.scene_set?.name || 'venue'}`} />
                    <span>{o.in_lookbook ? 'In lookbook' : o.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!lb.scene_set && <p className="esp2-hint">{lb.event ? "The event has no scene set yet; add your own venue photo." : 'This episode has no event yet; add your own venue photo.'}</p>}
          {(images.venue || []).filter((i) => i.source === 'upload').map((v) => (
            <div key={v.id} className="esp2-current">
              <img src={v.image_url} alt="Your venue photo" />
              <button type="button" className="esp2-chip" aria-pressed={v.in_lookbook} disabled={locked} onClick={() => move(v.id, { in_lookbook: !v.in_lookbook })}>
                {v.in_lookbook ? 'In lookbook' : 'Add to lookbook'}
              </button>
              <button type="button" className="esp2-icon-btn" aria-label="Remove venue photo" disabled={locked} onClick={() => remove(v.id)}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </>
      )}

      {info.photo && (
        <div className="esp2-row">
          <FileButton
            label={spot === 'venue' ? 'Upload your own' : current ? `Replace ${info.label}` : `Upload ${info.label}`}
            onFiles={(files) => upload(spot === 'inspo' || spot === 'venue' ? files.slice(0, spot === 'inspo' ? MAX_INSPO - inspo.length : files.length) : files.slice(0, 1), spot)}
            disabled={locked || fullInspo}
          />
        </div>
      )}

      {info.photo && (
        <div className="esp2-tray">
          <p className="esp2-tray-label">From To sort {tray.length > 0 && <span className="esp2-count">{tray.length}</span>}</p>
          {tray.length === 0 ? (
            <p className="esp2-hint">Nothing to sort. Drop photos on the page, or use "Drop photos to sort".</p>
          ) : (
            <ul className="esp2-thumbs">
              {tray.map((t) => (
                <li key={t.id}>
                  <button type="button" className="esp2-thumb" disabled={locked || fullInspo} aria-label={`Use ${t.file_name || 'this photo'} for ${info.label}`}
                    onClick={() => move(t.id, { category: spot })}>
                    <img src={t.image_url} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {info.name && (
        <label className="esp2-field" htmlFor={`esp2-${info.name}`}>
          <span>{info.label} name</span>
          <input id={`esp2-${info.name}`} type="text" maxLength={120} value={text[info.name] || ''} disabled={locked}
            onChange={(e) => setText(info.name, e.target.value)} onBlur={() => commitText(info.name)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </label>
      )}

      {info.notes && (
        <NotesField spot={spot} label={`${info.label} notes (optional)`} value={notes[spot]} disabled={locked}
          onSave={(v) => saveFields({ beauty_notes: { ...notes, [spot]: v } })} />
      )}

      {spot === 'tagline' && (
        <label className="esp2-field" htmlFor="esp2-tagline">
          <span>Tagline</span>
          <input id="esp2-tagline" type="text" maxLength={200} value={text.tagline || ''} disabled={locked}
            onChange={(e) => setText('tagline', e.target.value)} onBlur={() => commitText('tagline')}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </label>
      )}

      {spot === 'wardrobe' && (
        <>
          <ul className="esp2-pieces">
            {(sheet.wardrobe?.columns || []).filter((c) => c.key !== 'hair' && c.key !== 'nails').map((c) => (
              <li key={c.key} className={c.needed ? 'is-needed' : ''}>
                <span className="esp2-piece-slot">{c.label.charAt(0) + c.label.slice(1).toLowerCase()}</span>
                <span>{c.needed ? 'Needed' : (c.name || 'Not chosen')}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="esp2-btn" disabled={!onOpenTab} onClick={() => onOpenTab && onOpenTab('wardrobe')}>
            <Shirt size={16} aria-hidden="true" /> Open Wardrobe
          </button>
        </>
      )}

      {spot === 'palette' && (
        <div className="esp2-palette">
          {(palette || []).map((s, i) => (
            <label key={i} className="esp2-swatch" title={s.hex}>
              <input type="color" value={s.hex.toLowerCase()} disabled={locked} aria-label={`Palette colour ${i + 1}`}
                onChange={(e) => setPalette(palette.map((p, j) => (j === i ? { hex: e.target.value.toUpperCase(), source: 'edited' } : p)))}
                onBlur={() => { if (palette.some((p) => p.source === 'edited')) savePalette(palette); }} />
            </label>
          ))}
          {!(palette || []).length && <p className="esp2-hint">No colours yet: the palette is taken from the saved look's piece images.</p>}
          {sheet.palette && !locked && sheet.palette_sources?.length > 0 && (
            <button type="button" className="esp2-btn" onClick={async () => { const p = await extractPalette(sheet.palette_sources); if (p.length) savePalette(p); }}>
              <RotateCcw size={16} aria-hidden="true" /> Take from the pieces again
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// Each export size as a download, enabled only while the sheet is approved
// and up to date; the server refuses the rest (409).
function ShareExport({ episodeId, episodeNumber, canExport, approved, stale }) {
  const [busySize, setBusySize] = useState(null);
  const [error, setError] = useState(null);
  const download = async (size) => {
    setBusySize(size);
    setError(null);
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/style-sheet/export/${size}`, { responseType: 'blob' });
      const disposition = res.headers?.['content-disposition'] || '';
      const n = episodeNumber != null ? String(episodeNumber).padStart(2, '0') : 'episode';
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] || `style-sheet-episode-${n}-${size}.${size === 'pdf' ? 'pdf' : 'png'}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[StylePage] export failed:', err);
      let msg = err?.message || 'The export could not be made.';
      const data = err?.response?.data;
      if (data && typeof data.text === 'function') {
        try { msg = JSON.parse(await data.text()).error || msg; } catch (parseErr) { console.error('[StylePage] export error body unreadable:', parseErr); }
      } else if (data?.error) msg = data.error;
      setError(msg);
    } finally {
      setBusySize(null);
    }
  };
  return (
    <section className="esp2-export" aria-labelledby="esp2-export-title" data-testid="esp2-export">
      <h3 id="esp2-export-title" className="esp2-spot-title">Share &amp; export</h3>
      <p className="esp2-hint">
        {canExport ? 'Drawn on the server from the approved sheet.'
          : stale && approved ? 'The event or the look changed since approval: approve the sheet again to export it.'
            : 'Approve the sheet to export it.'}
      </p>
      {error && <p className="esp2-error" role="alert">{error}</p>}
      <ul className="esp2-exports">
        {EXPORT_SIZES.map((e) => (
          <li key={e.size}>
            <button type="button" className="esp2-btn esp2-export-btn" disabled={!canExport || busySize !== null} onClick={() => download(e.size)} data-testid={`esp2-export-${e.size}`}>
              {busySize === e.size ? <Loader2 size={16} className="esp2-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              <span className="esp2-export-text"><span>{e.label}</span><span className="esp2-export-detail">{e.detail}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotesField({ spot, label, value, disabled, onSave }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value, spot]);
  return (
    <label className="esp2-field" htmlFor={`esp2-notes-${spot}`}>
      <span>{label}</span>
      <textarea id={`esp2-notes-${spot}`} rows={2} maxLength={600} value={draft} disabled={disabled}
        onChange={(e) => setDraft(e.target.value)} onBlur={() => { if ((draft || '') !== (value || '')) onSave(draft); }} />
    </label>
  );
}
