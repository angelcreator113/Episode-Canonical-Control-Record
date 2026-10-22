/**
 * Production → Style Page (was Lookbook; docs/design/2026-10-landing-and-
 * stylesheet.md Part 2, "Style Page"; Task #2876). The style sheet is the
 * editor: it is drawn at its real layout on the left (scaled to fit), every
 * empty spot is a dashed "+ Add" button in place, and the spot you tap opens
 * in the panel on the right: Choose from Files, and the readiness bar
 * ("Ready x of 12", one chip per item, from styleReadiness). What you see is
 * what exports. Three steps across the top (Evoni, 2026-10-22): Fill (the
 * sheet is the editor), Approve (what is missing, Approve or Reopen) and
 * Share (every download and Send to Distribution, open once approved); the
 * sheet stays on the left in each. Photos are uploaded in Files › Style photos, never here
 * (Evoni, 2026-10-22: "i dont want the uploads in the style page move them
 * to the files tab"); taking one off the sheet sends it back to To sort.
 *
 * Data: the Lookbook routes (lib/lookbookApi) and GET /episodes/:id/style-
 * sheet for the sheet itself. Share & export (Task #2877) downloads the
 * approved sheet in each size, drawn on the server; editing an approved
 * sheet returns it to Draft. Every value is the episode's
 * own data; an empty one shows its "+ Add" spot (Evoni, 2026-10-10: real
 * data only). Reloads keep the page in place, and tapping never scrolls it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FolderOpen, ImagePlus, Loader2, Lock, RotateCcw, Send, Shirt, X } from 'lucide-react';
import { downloadStyleDesign, downloadStyleDesignsZip, downloadStyleSheetExport, styleSheetDistributionApi, styleSheetError } from '../../lib/styleSheetApi';
import { lookbookApi } from '../../lib/lookbookApi';
import { CHARACTERS, POSES, episodePosesApi } from '../../lib/episodePosesApi';
import { STYLE_FOLDERS, filesIn, folderLabel } from '../../lib/stylePhotoFolders';
import StyleAudiencePick from './StyleAudiencePick';
import { styleReadiness } from '../../lib/styleReadiness';
import { extractPalette } from '../../lib/stylePalette';
import { styleSheetApi } from './EpisodeStyleSheetPanel';
import StyleSheetTemplate, { SHEET_HEIGHT, SHEET_WIDTH } from './StyleSheetTemplate';
import StyleDesign, { DESIGN_HEIGHT, DESIGN_WIDTH, designValues } from './StyleDesign';
import './EpisodeStylePage.css';

const MAX_INSPO = 2;
const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

// Every spot on the sheet: its section, its name, and the panel's one-line hint.
export const SPOT_INFO = {
  // Front, Side and Back are Lala's starred poses in Files (Evoni, 2026-10-22).
  front: { section: 'Lala in the look', label: 'Front', hint: "Lala's starred Front pose in Files › Photos.", photo: true, angle: true },
  side: { section: 'Lala in the look', label: 'Side', hint: "Lala's starred Side pose in Files › Photos.", photo: true, angle: true },
  back: { section: 'Lala in the look', label: 'Back', hint: "Lala's starred Back pose in Files › Photos.", photo: true, angle: true },
  hero: { section: 'Lala in the look', label: 'Hero', hint: 'The big shot, in the tilted frame.', photo: true },
  detail: { section: 'Lala in the look', label: 'Detail', hint: 'A close-up of the outfit: Detail shot and Outfit detail in your designs.', photo: true },
  hair: { section: 'Wardrobe breakdown', label: 'Hair', hint: 'A photo of the hair and its name; the name prints under HAIR.', photo: true, name: 'hair_name' },
  nails: { section: 'Wardrobe breakdown', label: 'Nails', hint: 'A photo of the nails and their name; the name prints under NAILS.', photo: true, name: 'nails_name' },
  eyes: { section: 'Beauty details', label: 'Eyes', hint: 'A close-up of the eye makeup.', photo: true, notes: true },
  lips: { section: 'Beauty details', label: 'Lips', hint: 'A close-up of the lips.', photo: true, notes: true },
  skin: { section: 'Beauty details', label: 'Skin', hint: 'A close-up of the skin and base.', photo: true, notes: true },
  venue: { section: 'The venue', label: 'Venue', hint: "From the event's scene set: Swap cycles its images, or choose your own from Files.", photo: true },
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

// A photo frame on one of the five designs opens its spot in the panel
// (Evoni's Canva deck, 2026-10-22; src/services/styleSheetDesigns.js).
const DESIGN_SPOT = {
  hero: 'hero', front: 'front', side: 'side', back: 'back', detail: 'detail', venue: 'venue', inspo: 'inspo',
  beauty: 'eyes', hair: 'hair', nails: 'nails', body: 'wardrobe', shoes: 'wardrobe', bag: 'wardrobe', jewelry: 'wardrobe', perfume: 'wardrobe',
};
const CLASSIC = 'classic';
const STEPS = [{ key: 'fill', label: 'Fill' }, { key: 'approve', label: 'Approve' }, { key: 'share', label: 'Share' }];

/** The panel spots one design shows. */
const designPanelSpots = (design) => [...new Set(design.elements.filter((e) => e.kind === 'photo').map((e) => DESIGN_SPOT[e.spot]).filter(Boolean))];

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
  const sheetCol = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [view, setView] = useState(CLASSIC);
  const [step, setStep] = useState('fill');

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
  const readiness = styleReadiness({ lookbook: lb, sheet, palette });
  const info = selected ? SPOT_INFO[selected] : null;
  const designs = sheet.designs || [];
  const design = designs.find((d) => d.key === view) || null;
  const values = designValues(sheet);
  const designScale = scale * (SHEET_WIDTH / DESIGN_WIDTH);
  // "In 3 of 5 designs" for the open spot; "Not on this design" under the preview.
  const designUse = selected ? designs.filter((d) => designPanelSpots(d).includes(selected)).length : 0;
  const notOnDesign = design ? Object.keys(DESIGN_SPOT).map((k) => DESIGN_SPOT[k]).filter((v, i, a) => a.indexOf(v) === i)
    .filter((spot) => !designPanelSpots(design).includes(spot)).map((spot) => (spot === 'eyes' ? 'Beauty' : SPOT_INFO[spot].label)) : [];

  const fromPose = (poseId, category) => run(() => lookbookApi.fromPose(episodeId, poseId, category));
  // Front, Side, Back: starring a Lala pose makes it the sheet's (the server reads the starred one).
  const starPose = (poseId) => run(async () => { await episodePosesApi.update(episodeId, poseId, { is_default: true }); return null; });
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
    const next = await lookbookApi.get(episodeId);
    setStep('share');
    return next;
  });
  const reopen = () => run(async () => { await styleSheetApi.reopen(episodeId); return lookbookApi.get(episodeId); });

  const filling = step === 'fill';
  // A readiness chip opens its spot in Fill.
  const openSpot = (spot) => { setStep('fill'); setSelected(spot); };
  const stepNote = {
    fill: `Ready ${readiness.done} of ${readiness.total}`,
    approve: approved ? (sheet.stale ? 'Out of date' : 'Approved') : 'Draft',
    share: canExport ? 'Ready to export' : 'After approval',
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
    <div className="esp2-page" data-testid="episode-style-page">
      <header className="esp2-header">
        <div className="esp2-title-row">
          <h2 className="esp2-title">Style Page</h2>
          <span className={`esp2-pill ${approved ? 'is-approved' : 'is-draft'}`} data-testid="esp2-status">
            {approved ? <><Lock size={12} aria-hidden="true" /> Approved</> : 'Draft'}
          </span>
          {sheet.stale && <span className="esp2-pill is-stale">Out of date: the event or look changed since approval</span>}
        </div>
        <div className="esp2-header-actions">
          <button type="button" className="esp2-btn" disabled={!onOpenTab} data-testid="esp2-open-files" onClick={() => onOpenTab && onOpenTab('files')}>
            <FolderOpen size={16} aria-hidden="true" /> Photos in Files
          </button>
        </div>
      </header>

      <div className="esp2-steps" role="tablist" aria-label="Steps" data-testid="esp2-steps">
        {STEPS.map((st, i) => (
          <button key={st.key} type="button" role="tab" aria-selected={step === st.key} data-testid={`esp2-step-${st.key}`}
            className={`esp2-step${step === st.key ? ' is-active' : ''}${(st.key === 'approve' && approved) || (st.key === 'share' && canExport) ? ' is-done' : ''}`}
            onClick={() => setStep(st.key)}>
            <span className="esp2-step-num" aria-hidden="true">{i + 1}</span>
            <span className="esp2-step-text"><span className="esp2-step-label">{st.label}</span><span className="esp2-step-note">{stepNote[st.key]}</span></span>
          </button>
        ))}
      </div>

      {approved && <p className="esp2-note">Approved. Editing anything returns it to Draft, and it needs approving again before it can be exported.</p>}
      {error && <p className="esp2-error" role="alert">{error}</p>}

      {designs.length > 0 && (
        <div className="esp2-designs" role="tablist" aria-label="Designs" data-testid="esp2-designs">
          {[{ key: CLASSIC, number: 'Classic', name: 'The style sheet' }, ...designs].map((d) => (
            <button key={d.key} type="button" role="tab" aria-selected={view === d.key} className={`esp2-design-tab${view === d.key ? ' is-active' : ''}`}
              data-testid={`esp2-design-${d.key}`} onClick={() => setView(d.key)}>
              <span className="esp2-design-num">{d.number}</span>
              <span className="esp2-design-name">{d.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="esp2-layout">
        <div className="esp2-sheet-col" ref={sheetCol}>
          {design ? (
            <>
              <div className="esp2-sheet-frame" style={{ height: DESIGN_HEIGHT * designScale }} data-testid="esp2-design-preview">
                <div className="esp2-sheet-scale" style={{ transform: `scale(${designScale})`, width: DESIGN_WIDTH }}>
                  <StyleDesign design={design} values={values}
                    edit={filling ? { isSelected: (spot) => DESIGN_SPOT[spot] === selected, onSelect: (spot) => setSelected(DESIGN_SPOT[spot]) } : null} />
                </div>
              </div>
              <p className="esp2-hint esp2-design-note">
                {filling ? 'Tap a frame to edit it. ' : ''}Empty text shows faintly here and is left blank in downloads.
                {notOnDesign.length > 0 && <> Not on this design: {notOnDesign.join(', ')}.</>}
              </p>
            </>
          ) : (
            <div className="esp2-sheet-frame" style={{ height: SHEET_HEIGHT * scale }}>
              <div className="esp2-sheet-scale" style={{ transform: `scale(${scale})`, width: SHEET_WIDTH }}>
                <StyleSheetTemplate sheet={sheet} palette={palette} edit={filling ? edit : null} />
              </div>
            </div>
          )}
        </div>

        <aside className="esp2-panel" aria-label={step === 'fill' ? 'Editing panel' : step === 'approve' ? 'Approve' : 'Share'}>
          {step === 'fill' && (
            <>
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
                  locked={locked}
                  venueCandidates={venueCandidates}
                  fromPose={fromPose}
                  starPose={starPose}
                  move={move}
                  saveFields={saveFields}
                  swapVenue={swapVenue}
                  toggleOption={(o) => run(() => lookbookApi.venue(episodeId, { source: o.source, ref_id: o.ref_id, in_lookbook: !o.in_lookbook }))}
                  onOpenTab={onOpenTab}
                  episode={episode}
                  designUse={designs.length ? { used: designUse, total: designs.length } : null}
                />
              ) : (
                <p className="esp2-panel-empty">Tap a spot on the sheet to edit it. Dashed spots are waiting for a photo.</p>
              )}
              <Readiness readiness={readiness} selected={selected} onPick={openSpot} />
            </>
          )}

          {step === 'approve' && (
            <section className="esp2-approve" aria-labelledby="esp2-approve-title" data-testid="esp2-approve">
              <h3 id="esp2-approve-title" className="esp2-spot-title">{approved ? 'Approved' : 'Approve the sheet'}</h3>
              <p className="esp2-hint">
                {approved
                  ? (sheet.stale ? 'The event or the look changed since approval: approve it again to export.' : 'It can be exported. Reopen it to change anything; it needs approving again after.')
                  : readiness.done < readiness.total
                    ? `${readiness.total - readiness.done} still to fill. Tap one to fill it, or approve the sheet as it is.`
                    : 'Everything is filled. Approve it to export and share.'}
              </p>
              <Readiness readiness={readiness} selected={null} onPick={openSpot} />
              <div className="esp2-row">
                {approved && !sheet.stale ? (
                  <>
                    <button type="button" className="esp2-btn esp2-btn-primary" onClick={() => setStep('share')}><Send size={16} aria-hidden="true" /> Go to Share</button>
                    <button type="button" className="esp2-btn" disabled={busy} onClick={reopen}><RotateCcw size={16} aria-hidden="true" /> Reopen</button>
                  </>
                ) : (
                  <button type="button" className="esp2-btn esp2-btn-primary" disabled={busy} onClick={approve}><CheckCircle2 size={16} aria-hidden="true" /> Approve</button>
                )}
              </div>
            </section>
          )}

          {step === 'share' && (
            <>
              {!canExport && (
                <div className="esp2-gate" data-testid="esp2-share-gate">
                  <p className="esp2-hint">{approved && sheet.stale ? 'The event or the look changed since approval: approve the sheet again to share it.' : 'Approve the sheet first; then every size downloads from here.'}</p>
                  <button type="button" className="esp2-btn" onClick={() => setStep('approve')}><CheckCircle2 size={16} aria-hidden="true" /> Go to Approve</button>
                </div>
              )}
              <ShareExport episodeId={episodeId} episodeNumber={sheet.episode?.number} canExport={canExport} approved={approved} stale={sheet.stale} onOpenTab={onOpenTab}
                designs={designs} sizes={sheet.design_sizes || []} design={design} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Ready x of 12, a chip per item; a chip opens its spot. */
function Readiness({ readiness, selected, onPick }) {
  return (
    <section className="esp2-ready" aria-label="Readiness">
      <div className="esp2-ready-head">
        <span className="esp2-ready-label" data-testid="esp2-ready">Ready {readiness.done} of {readiness.total}</span>
      </div>
      <div className="esp2-bar" role="progressbar" aria-label="Style sheet readiness" aria-valuemin={0} aria-valuemax={readiness.total} aria-valuenow={readiness.done}>
        <span style={{ width: `${Math.round((readiness.done / readiness.total) * 100)}%` }} />
      </div>
      <ul className="esp2-chips">
        {readiness.items.map((c) => {
          const spot = CHIP_SPOT[c.key] || c.key;
          return (
            <li key={c.key}>
              <button type="button" className={`esp2-chip${c.ready ? ' is-ready' : ''}${selected === spot ? ' is-selected' : ''}`}
                aria-pressed={selected === spot} data-testid={`esp2-chip-${c.key}`} onClick={() => onPick(spot)}>
                {c.ready ? <CheckCircle2 size={14} aria-hidden="true" /> : <span className="esp2-chip-dot" aria-hidden="true" />}
                {c.label}<span className="esp2-sr">{c.ready ? ', ready' : ', not ready'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SpotPanel({ spot, info, lb, sheet, palette, setPalette, savePalette, text, setText, commitText, locked, venueCandidates, fromPose, starPose, move, saveFields, swapVenue, toggleOption, onOpenTab, episode, designUse }) {
  const images = lb.images || {};
  const current = info.photo && !info.angle && spot !== 'venue' && spot !== 'inspo' ? (images[spot] || [])[0] || null : null;
  // Front, Side and Back show Lala's pose from Files until a photo is put there.
  const fromFiles = !current ? sheet.look_from_files?.[spot] || null : null;
  const inspo = (images.inspo || []).filter((i) => i.source === 'upload');
  const notes = lb.beauty_notes || {};
  const fullInspo = spot === 'inspo' && inspo.length >= MAX_INSPO;
  // Off the sheet, still in Files: back to To sort.
  const takeOff = (id) => move(id, { category: 'unsorted' });

  return (
    <section className="esp2-spot" aria-labelledby="esp2-spot-title" data-testid="esp2-spot-panel">
      <h3 id="esp2-spot-title" className="esp2-spot-title">Editing {info.section} · {info.label}</h3>
      <p className="esp2-hint">{info.hint}</p>
      {designUse && <p className="esp2-hint" data-testid="esp2-design-use">In {designUse.used} of {designUse.total} designs</p>}

      {current && (
        <div className="esp2-current">
          <img src={current.image_url} alt={`${info.label} photo`} />
          <button type="button" className="esp2-icon-btn" aria-label={`Take the ${info.label} photo off the sheet (it stays in Files)`} title="Off the sheet; it stays in Files" disabled={locked} onClick={() => takeOff(current.id)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {fromFiles && (
        <div className="esp2-current" data-testid="esp2-from-files">
          <img src={fromFiles.url} alt={`${info.label}: ${fromFiles.label}`} />
          <span className="esp2-hint">From Files · {fromFiles.label}. Choose another {info.label} pose to replace it.</span>
        </div>
      )}

      {spot === 'inspo' && inspo.length > 0 && (
        <ul className="esp2-thumbs">
          {inspo.map((p, i) => (
            <li key={p.id} className="esp2-current">
              <img src={p.image_url} alt={`Inspo ${i + 1}`} />
              <button type="button" className="esp2-icon-btn" aria-label={`Take inspo ${i + 1} off the sheet (it stays in Files)`} title="Off the sheet; it stays in Files" disabled={locked} onClick={() => takeOff(p.id)}>
                <X size={16} aria-hidden="true" />
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
          {!lb.scene_set && <p className="esp2-hint">{lb.event ? 'The event has no scene set yet; choose a venue photo from Files.' : 'This episode has no event yet; choose a venue photo from Files.'}</p>}
          {(images.venue || []).filter((i) => i.source === 'upload').map((v) => (
            <div key={v.id} className="esp2-current">
              <img src={v.image_url} alt="Your venue photo" />
              <button type="button" className="esp2-chip" aria-pressed={v.in_lookbook} disabled={locked} onClick={() => move(v.id, { in_lookbook: !v.in_lookbook })}>
                {v.in_lookbook ? 'In lookbook' : 'Add to lookbook'}
              </button>
              <button type="button" className="esp2-icon-btn" aria-label="Take your venue photo off the sheet (it stays in Files)" title="Off the sheet; it stays in Files" disabled={locked} onClick={() => takeOff(v.id)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </>
      )}

      {info.photo && (
        <FilesPicker episodeId={episode?.id} lb={lb} spot={spot} label={info.label} disabled={locked || fullInspo} angle={Boolean(info.angle)}
          onPickPose={(poseId) => (info.angle ? starPose(poseId) : fromPose(poseId, spot))} onPickFile={(imageId) => move(imageId, { category: spot })} onOpenTab={onOpenTab} />
      )}
      {fullInspo && <p className="esp2-hint">Key inspo holds two of your photos; take one off to choose another.</p>}

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
          {/* The audience's pick (Task #3007): a suggestion, never applied by itself. */}
          <StyleAudiencePick episode={episode} />
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
          {/* Taken from the pieces but not saved: the Palette chip counts once
              the five colours are saved (Task #3155). */}
          {!sheet.palette && (palette || []).length > 0 && !locked && (
            <button type="button" className="esp2-btn" data-testid="esp2-palette-save" onClick={() => savePalette(palette)}>
              <CheckCircle2 size={16} aria-hidden="true" /> Save these colours
            </button>
          )}
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

/**
 * Choose from Files (Evoni, 2026-10-22): the episode's photos in Files ›
 * Photos: the Style spots folder by folder (To sort first), and the ready
 * photos of Lala and JustAWoman. A Style photo is filed in this spot's
 * folder; a pose is copied into it. For Front, Side and Back (`angle`) only
 * Lala's poses of that angle are offered, and picking one stars it.
 * Uploading happens in Files.
 */
function FilesPicker({ episodeId, lb, spot, label, disabled, angle = false, onPickPose, onPickFile, onOpenTab }) {
  const [open, setOpen] = useState(false);
  const [poses, setPoses] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || poses || !episodeId) return undefined;
    let cancelled = false;
    episodePosesApi.list(episodeId)
      .then((rows) => { if (!cancelled) setPoses(rows.filter((r) => r.status === 'ready' && r.final_url)); })
      .catch((err) => {
        console.error('[StylePage] Files photos could not be read:', err);
        if (!cancelled) setError(errorText(err));
      });
    return () => { cancelled = true; };
  }, [open, poses, episodeId]);

  const poseLabel = (key) => POSES.find((p) => p.key === key)?.label || key;
  const folders = angle ? [] : STYLE_FOLDERS.filter((f) => f.key !== spot).map((f) => ({ ...f, photos: filesIn(lb, f.key) })).filter((f) => f.photos.length);
  const offered = poses && (angle ? poses.filter((p) => p.character_key === 'lala' && p.pose === spot) : poses);
  const nothing = offered && offered.length === 0 && folders.length === 0;
  const openFiles = (
    <button type="button" className="esp2-link" disabled={!onOpenTab} onClick={() => onOpenTab && onOpenTab('files')}>Open Files</button>
  );
  return (
    <div className="esp2-files">
      <button type="button" className="esp2-btn" aria-expanded={open} disabled={disabled} data-testid="esp2-files-open" onClick={() => setOpen((o) => !o)}>
        <ImagePlus size={16} aria-hidden="true" /> Choose from Files
      </button>
      {open && (
        <div className="esp2-files-body" data-testid="esp2-files">
          {error && <p className="esp2-error" role="alert">{error}</p>}
          {!poses && !error && <p className="esp2-hint"><Loader2 size={14} className="esp2-spin" aria-hidden="true" /> Loading your Files photos…</p>}
          {nothing && <p className="esp2-hint">{angle ? `No ready ${label} pose of Lala in Files yet.` : 'No photos in Files yet.'} Upload them in Files › Photos. {openFiles}</p>}
          {folders.map((f) => (
            <div key={f.key} data-testid={`esp2-files-folder-${f.key}`}>
              <p className="esp2-tray-label">Style photos · {f.label}</p>
              <ul className="esp2-thumbs">
                {f.photos.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="esp2-thumb" disabled={disabled} aria-label={`Use ${p.file_name || `this ${folderLabel(f.key).toLowerCase()} photo`} for ${label}`}
                      onClick={() => { onPickFile(p.id); setOpen(false); }}>
                      <img src={p.image_url} alt="" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {offered && CHARACTERS.map((c) => {
            const mine = offered.filter((p) => p.character_key === c.key);
            if (!mine.length) return null;
            return (
              <div key={c.key}>
                <p className="esp2-tray-label">{c.label}</p>
                <ul className="esp2-thumbs">
                  {mine.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={`esp2-thumb${angle && p.is_default ? ' is-in' : ''}`} disabled={disabled} aria-label={`Use ${c.label} ${poseLabel(p.pose)}${angle && p.is_default ? ' (starred)' : ''} for ${label}`}
                        onClick={() => { onPickPose(p.id); setOpen(false); }}>
                        <img src={p.final_url} alt="" />
                        <span>{poseLabel(p.pose)}{p.is_default ? ' ★' : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!nothing && offered && <p className="esp2-hint">To add photos, upload them in Files. {openFiles}</p>}
        </div>
      )}
    </div>
  );
}

// Each export size as a download, enabled only while the sheet is approved
// and up to date; the server refuses the rest (409). Send to Distribution
// puts every size in the episode's Distribution with a caption draft (Task #2878).
function ShareExport({ episodeId, episodeNumber, canExport, approved, stale, onOpenTab, designs = [], sizes = [], design = null }) {
  const [busySize, setBusySize] = useState(null);
  const [sizeKey, setSizeKey] = useState('pinterest');
  const [error, setError] = useState(null);
  const [withLinks, setWithLinks] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const download = async (size) => {
    setBusySize(size);
    setError(null);
    try {
      await downloadStyleSheetExport(episodeId, size, episodeNumber);
    } catch (err) {
      console.error('[StylePage] export failed:', err);
      setError(await styleSheetError(err, 'The export could not be made.'));
    } finally {
      setBusySize(null);
    }
  };
  // The five designs (Evoni, 2026-10-22): this one, all five, or all five in every size.
  const fetchDesigns = async (busyKey, fn) => {
    setBusySize(busyKey);
    setError(null);
    try {
      await fn();
    } catch (err) {
      console.error('[StylePage] design export failed:', err);
      setError(await styleSheetError(err, 'The export could not be made.'));
    } finally {
      setBusySize(null);
    }
  };
  const send = async () => {
    setSending(true);
    setError(null);
    try {
      setSent(await styleSheetDistributionApi.send(episodeId, withLinks));
    } catch (err) {
      console.error('[StylePage] send to Distribution failed:', err);
      setError(await styleSheetError(err, 'The style sheet could not be sent to Distribution.'));
    } finally {
      setSending(false);
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
      {designs.length > 0 && (
        <div className="esp2-design-export" data-testid="esp2-design-export">
          <p className="esp2-tray-label">Your {designs.length} designs</p>
          <div className="esp2-sizes" role="radiogroup" aria-label="Size">
            {sizes.map((z) => (
              <button key={z.key} type="button" role="radio" aria-checked={sizeKey === z.key} className={`esp2-size${sizeKey === z.key ? ' is-active' : ''}`}
                data-testid={`esp2-size-${z.key}`} onClick={() => setSizeKey(z.key)}>
                <span>{z.label}</span><span className="esp2-export-detail">{z.width} × {z.height}</span>
              </button>
            ))}
          </div>
          <div className="esp2-row">
            <button type="button" className="esp2-btn" disabled={!canExport || !design || busySize !== null} data-testid="esp2-design-download"
              onClick={() => fetchDesigns('one', () => downloadStyleDesign(episodeId, design.key, sizeKey))}>
              {busySize === 'one' ? <Loader2 size={16} className="esp2-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              {design ? `Download ${design.name}` : 'Pick a design to download it'}
            </button>
            <button type="button" className="esp2-btn" disabled={!canExport || busySize !== null} data-testid="esp2-designs-zip"
              onClick={() => fetchDesigns('zip', () => downloadStyleDesignsZip(episodeId, sizeKey))}>
              {busySize === 'zip' ? <Loader2 size={16} className="esp2-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              All {designs.length} · zip
            </button>
            <button type="button" className="esp2-btn" disabled={!canExport || busySize !== null} data-testid="esp2-designs-zip-all"
              onClick={() => fetchDesigns('all', () => downloadStyleDesignsZip(episodeId, 'all'))}>
              {busySize === 'all' ? <Loader2 size={16} className="esp2-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              Every size · zip
            </button>
          </div>
        </div>
      )}
      <div className="esp2-send">
        <label className="esp2-check" htmlFor="esp2-send-links">
          <input id="esp2-send-links" type="checkbox" checked={withLinks} disabled={!canExport || sending} onChange={(e) => setWithLinks(e.target.checked)} />
          <span>Include Shop the Look links</span>
        </label>
        <button type="button" className="esp2-btn esp2-btn-primary" disabled={!canExport || sending} onClick={send} data-testid="esp2-send-distribution">
          {sending ? <Loader2 size={16} className="esp2-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          Send to Distribution
        </button>
      </div>
      {sent?.sent && (
        <p className="esp2-hint" role="status" data-testid="esp2-sent">
          Sent: {sent.items.length} sizes{sent.designs?.length ? `, your ${sent.designs.length} designs in every size` : ''} and a caption draft are in Distribution.
          {sent.disclosure ? ' The disclosure is added.' : ''}{' '}
          <button type="button" className="esp2-link" disabled={!onOpenTab} onClick={() => onOpenTab && onOpenTab('distribution')}>Open Distribution</button>
        </p>
      )}
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
