// frontend/src/components/Episodes/StyleSheetDistributionCard.jsx
import React, { useEffect, useState } from 'react';
import { Copy, Download, Loader2, Lock, Trash2 } from 'lucide-react';
import { downloadStyleDesign, downloadStyleSheetExport, styleSheetDistributionApi, styleSheetError } from '../../lib/styleSheetApi';

/**
 * The approved style sheet in Distribution (Task #2878): every export size as
 * a download, the caption draft she edits, Shop the Look links, and the
 * disclosure. The disclosure is the server's: it leads the post when an
 * included link is an affiliate link, with the Amazon Associates sentence
 * when that link is Amazon's (Task #3170; Evoni, 2026-11-15), and has no edit control.
 * Nothing here posts anywhere; "Copy post text" puts it on the clipboard.
 */
/** Why the look cannot go on the website yet, or null when it can. */
export function siteBlocker(entry) {
  if (!entry.include_shop_links) return 'Include the Shop the Look links to put this look on the website.';
  if (!(entry.shop_links || []).length) return 'Add a real-world link to a piece first.';
  return null;
}

/** What the card says of how Distribution now differs from the published look. */
export const DIFFERS = {
  pieces: 'The look has different pieces now.',
  links: "A product's link changed in Wardrobe.",
  image: 'The image is of an earlier sheet.',
  no_snapshot: 'This look was published before products were confirmed.',
};

/** The review rows: each piece of the look, starting from what is published, else from Wardrobe. Nothing is confirmed yet. */
export function reviewRows(entry) {
  const published = new Map(((entry.site && entry.site.links) || []).map((l) => [String(l.piece_id), l]));
  return (entry.site_review || []).map((p) => {
    const was = published.get(String(p.piece_id));
    const from = was && was.url ? was : p;
    return {
      piece_id: p.piece_id, piece: p.piece || 'Piece',
      include: Boolean(from.url),
      real_brand: from.real_brand || '', real_product_name: from.real_product_name || '', retailer: from.retailer || '',
      url: from.url || '', affiliate: Boolean(from.affiliate), match: (was && was.match) || 'exact', confirmed: false,
    };
  });
}

/** What is sent: only the products she kept and confirmed; a piece she left out is shown on the website without a link. */
export const confirmedLinks = (rows) => rows.filter((r) => r.include).map((r) => ({
  piece_id: r.piece_id, real_brand: r.real_brand.trim(), real_product_name: r.real_product_name.trim(), retailer: r.retailer.trim(),
  url: r.url.trim(), affiliate: r.affiliate, match: r.match, confirmed: r.confirmed,
}));

/** Why the review cannot be published yet, or null. The server checks again. */
export function reviewBlocker(rows) {
  const kept = rows.filter((r) => r.include);
  if (!kept.length) return 'Keep at least one product with a link.';
  for (const r of kept) {
    if (!r.real_brand.trim() || !r.real_product_name.trim() || !r.retailer.trim()) return `${r.piece}: add the real brand, product name and retailer.`;
    if (!/^https:\/\/\S+\.\S+/.test(r.url.trim())) return `${r.piece}: the link must start with https://`;
    if (!r.confirmed) return `${r.piece}: open the link, check it is the right product, and tick the box.`;
  }
  return null;
}

/**
 * Review before publishing (Evoni, 2026-11-15): each piece of the look and
 * its real product. She confirms the real brand, product name, retailer and
 * https link of each, says whether it is the piece itself or a similar one,
 * and ticks that she checked it. Nothing here makes up a product or a link.
 */
function SiteReview({ entry, working, onPublish, onCancel }) {
  const [rows, setRows] = useState(() => reviewRows(entry));
  const set = (id, changes) => setRows((all) => all.map((r) => (r.piece_id === id ? { ...r, ...changes, ...(changes.confirmed === undefined ? { confirmed: false } : {}) } : r)));
  const blocker = reviewBlocker(rows);
  return (
    <div className="ssd-review" data-testid="ssd-site-review">
      <p className="ssd-hint">The website shows real products only. Check each one; a piece you leave out is shown without a link.</p>
      {rows.map((r) => (
        <fieldset key={r.piece_id} className="ssd-review-row" data-testid={`ssd-review-${r.piece_id}`}>
          <legend>{r.piece}</legend>
          <label className="ssd-check">
            <input type="checkbox" checked={r.include} disabled={working} onChange={(e) => set(r.piece_id, { include: e.target.checked })} />
            <span>It can be bought</span>
          </label>
          {r.include && (
            <>
              <label className="ssd-review-field"><span>Real brand</span>
                <input type="text" value={r.real_brand} disabled={working} onChange={(e) => set(r.piece_id, { real_brand: e.target.value })} /></label>
              <label className="ssd-review-field"><span>Real product name</span>
                <input type="text" value={r.real_product_name} disabled={working} onChange={(e) => set(r.piece_id, { real_product_name: e.target.value })} /></label>
              <label className="ssd-review-field"><span>Retailer</span>
                <input type="text" value={r.retailer} disabled={working} onChange={(e) => set(r.piece_id, { retailer: e.target.value })} /></label>
              <label className="ssd-review-field"><span>Link (https)</span>
                <input type="url" inputMode="url" value={r.url} disabled={working} onChange={(e) => set(r.piece_id, { url: e.target.value })} /></label>
              <label className="ssd-review-field"><span>This product is</span>
                <select value={r.match} disabled={working} onChange={(e) => set(r.piece_id, { match: e.target.value })}>
                  <option value="exact">The piece itself</option>
                  <option value="similar">A similar piece</option>
                </select></label>
              <label className="ssd-check">
                <input type="checkbox" checked={r.affiliate} disabled={working} onChange={(e) => set(r.piece_id, { affiliate: e.target.checked })} />
                <span>Affiliate link</span>
              </label>
              <label className="ssd-check">
                <input type="checkbox" checked={r.confirmed} disabled={working} onChange={(e) => set(r.piece_id, { confirmed: e.target.checked })} />
                <span>I opened this link and it is the right product</span>
              </label>
            </>
          )}
        </fieldset>
      ))}
      {blocker && <p className="ssd-hint" role="status" data-testid="ssd-review-blocker">{blocker}</p>}
      <div className="ssd-actions">
        <button type="button" className="ssd-btn ssd-btn-primary" disabled={working || Boolean(blocker)} onClick={() => onPublish(confirmedLinks(rows))}>
          {entry.site?.published ? 'Publish again' : 'Put on the website'}
        </button>
        <button type="button" className="ssd-btn" disabled={working} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * Show on the website (Task #3022; the server is #3021): publishes the
 * look's Shop the Look page, or takes it down. Only Evoni's switch makes a
 * look public, and only after she reviews each product (SiteReview); while
 * the links are off it stays published but hidden. What is published is a
 * snapshot: when Distribution differs from it, the card says so and offers
 * the review again. A product that can no longer be bought is marked here.
 */
function SiteSwitch({ entry, working, onPublish, onTakeDown, onAvailable }) {
  const site = entry.site || { published: false };
  const [reviewing, setReviewing] = useState(false);
  const blocker = site.published ? null : siteBlocker(entry);
  const differs = site.published ? (site.differs || []) : [];
  const publish = async (links) => { if (await onPublish(links)) setReviewing(false); };
  return (
    <div className="ssd-links" data-testid="ssd-site">
      <label className="ssd-check" htmlFor="ssd-site-switch">
        <input id="ssd-site-switch" type="checkbox" role="switch" checked={Boolean(site.published)}
          aria-checked={Boolean(site.published)} disabled={working || Boolean(blocker)}
          onChange={(e) => (e.target.checked ? setReviewing(true) : onTakeDown())} />
        <span>Show on the website</span>
      </label>
      {blocker && <p className="ssd-hint">{blocker}</p>}
      {reviewing && <SiteReview entry={entry} working={working} onPublish={publish} onCancel={() => setReviewing(false)} />}
      {site.published && site.showing && site.released !== false && (
        <p className="ssd-hint">On the website: <a href={site.path} target="_blank" rel="noopener noreferrer">{site.path}</a></p>
      )}
      {site.published && site.showing && site.released === false && (
        <p className="ssd-hint" role="status" data-testid="ssd-site-waiting">Ready for the website. It appears there once this episode is published.</p>
      )}
      {site.published && !site.showing && (
        <p className="ssd-hint" role="status">Hidden on the website while the Shop the Look links are off.</p>
      )}
      {differs.length > 0 && !reviewing && (
        <div data-testid="ssd-site-differs">
          <p className="ssd-warning" role="status">
            The website still shows the look as you published it. {differs.map((d) => DIFFERS[d]).filter(Boolean).join(' ')}
          </p>
        </div>
      )}
      {/* Always there once published: a product can change while nothing in Wardrobe does. */}
      {site.published && !reviewing && (
        <button type="button" className="ssd-btn" disabled={working} onClick={() => setReviewing(true)}>Review and publish again</button>
      )}
      {site.published && Array.isArray(site.links) && !reviewing && (
        <ul className="ssd-link-list" data-testid="ssd-site-links">
          {site.links.map((l) => (
            <li key={l.piece_id}>
              <span className="ssd-link-label">{l.label}{l.retailer ? ` · ${l.retailer}` : ''}</span>
              {l.match === 'similar' && <span className="ssd-badge">Similar</span>}
              {!l.available && <span className="ssd-badge">{l.url ? 'No longer available' : 'No product to shop'}</span>}
              {l.url && (
                <button type="button" className="ssd-btn" disabled={working} onClick={() => onAvailable(l.piece_id, !l.available)}>
                  {l.available ? 'Mark as no longer available' : 'Available again'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {site.published && site.image && site.image !== 'on_site' && !reviewing && (
        <div data-testid="ssd-site-image">
          <p className="ssd-hint" role="status">
            {site.image === 'failed'
              ? 'The look image could not be copied to the website.'
              : 'No look image on the website yet; it needs the website storage set up.'}
          </p>
          <button type="button" className="ssd-btn" disabled={working} onClick={() => setReviewing(true)}>
            {site.image === 'failed' ? 'Try the look image again' : 'Add the look image'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StyleSheetDistributionCard({ episodeId, episodeNumber }) {
  const [entry, setEntry] = useState(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    styleSheetDistributionApi.get(episodeId)
      .then((d) => { if (live) { setEntry(d || { sent: false }); setCaption(d?.caption || ''); } })
      .catch((err) => {
        console.error('[Distribution] style sheet entry failed to load:', err);
        if (live) { setEntry({ sent: false }); setError('The style sheet entry could not be read.'); }
      });
    return () => { live = false; };
  }, [episodeId]);

  const act = async (key, fn, fallback) => {
    setBusy(key);
    setError(null);
    try {
      const next = await fn();
      if (next) { setEntry(next); if (key !== 'download') setCaption(next.caption || ''); }
      return true;
    } catch (err) {
      console.error(`[Distribution] style sheet ${key} failed:`, err);
      setError(await styleSheetError(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(entry.post_text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[Distribution] copy failed:', err);
      setError('The post text could not be copied.');
    }
  };

  if (!entry) return null;
  if (!entry.sent) {
    return (
      <section className="ssd-card" aria-labelledby="ssd-title" data-testid="ssd-card">
        <h3 id="ssd-title" className="ssd-title">Style sheet</h3>
        {error && <p className="ssd-error" role="alert">{error}</p>}
        <p className="ssd-hint">Not sent yet. Approve the style sheet on the Style Page, then Send to Distribution.</p>
      </section>
    );
  }

  const max = entry.caption_max || 2200;
  const changed = caption !== (entry.caption || '');
  const working = busy !== null;
  return (
    <section className="ssd-card" aria-labelledby="ssd-title" data-testid="ssd-card">
      <div className="ssd-head">
        <h3 id="ssd-title" className="ssd-title">Style sheet</h3>
        <span className="ssd-sent">Sent {new Date(entry.sent_at).toLocaleString()}</span>
      </div>
      {error && <p className="ssd-error" role="alert">{error}</p>}
      {entry.out_of_date && (
        <p className="ssd-warning" role="status">The sheet changed since it was sent. Approve it again on the Style Page and send it again to download it.</p>
      )}

      <ul className="ssd-items">
        {entry.items.map((i) => (
          <li key={i.size}>
            <button type="button" className="ssd-btn ssd-item" disabled={entry.out_of_date || working}
              onClick={() => act('download', () => downloadStyleSheetExport(episodeId, i.size, episodeNumber), 'The export could not be made.')}
              data-testid={`ssd-item-${i.size}`}>
              <Download size={16} aria-hidden="true" />
              <span className="ssd-item-text"><span>{i.label}</span><span className="ssd-item-detail">{i.width} × {i.height}</span></span>
            </button>
          </li>
        ))}
      </ul>

      {(entry.designs || []).length > 0 && (
        <div className="ssd-designs" data-testid="ssd-designs">
          <p className="ssd-designs-title">Your {entry.designs.length} designs (the caption and Shop the Look links go with them)</p>
          {entry.designs.map((d) => (
            <div key={d.design} className="ssd-design">
              <span className="ssd-design-name">{d.name}</span>
              <ul className="ssd-items">
                {d.sizes.map((z) => (
                  <li key={z.size}>
                    <button type="button" className="ssd-btn ssd-item" disabled={entry.out_of_date || working}
                      onClick={() => act('download', () => downloadStyleDesign(episodeId, d.design, z.size), 'The export could not be made.')}
                      data-testid={`ssd-design-${d.design}-${z.size}`}>
                      <Download size={16} aria-hidden="true" />
                      <span className="ssd-item-text"><span>{z.label}</span><span className="ssd-item-detail">{z.width} × {z.height}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {entry.disclosure && (
        <p className="ssd-disclosure" data-testid="ssd-disclosure">
          <Lock size={14} aria-hidden="true" />
          <span>{entry.disclosure}</span>
          <span className="ssd-locked">Added because an affiliate link is included</span>
        </p>
      )}

      <div className="ssd-field">
        <label htmlFor="ssd-caption">Caption</label>
        <textarea id="ssd-caption" rows={5} maxLength={max} value={caption} disabled={working} onChange={(e) => setCaption(e.target.value)} />
        <span className="ssd-count">{caption.length} / {max}</span>
      </div>
      <div className="ssd-actions">
        <button type="button" className="ssd-btn ssd-btn-primary" disabled={!changed || working}
          onClick={() => act('caption', () => styleSheetDistributionApi.update(episodeId, { caption }), 'The caption could not be saved.')}>
          {busy === 'caption' && <Loader2 size={16} className="ssd-spin" aria-hidden="true" />}
          Save caption
        </button>
        <button type="button" className="ssd-btn" disabled={working || changed} onClick={copy} title={changed ? 'Save the caption first' : undefined}>
          <Copy size={16} aria-hidden="true" />
          {copied ? 'Copied' : 'Copy post text'}
        </button>
      </div>

      <div className="ssd-links">
        <label className="ssd-check" htmlFor="ssd-include-links">
          <input id="ssd-include-links" type="checkbox" checked={entry.include_shop_links} disabled={working}
            onChange={(e) => act('links', () => styleSheetDistributionApi.update(episodeId, { include_shop_links: e.target.checked }), 'The Shop the Look setting could not be saved.')} />
          <span>Include Shop the Look links</span>
        </label>
        {entry.shop_links.length ? (
          <ul className="ssd-link-list">
            {entry.shop_links.map((l) => (
              <li key={l.piece_id}>
                <span className="ssd-link-label">{l.label}{l.retailer ? ` · ${l.retailer}` : ''}</span>
                {l.affiliate && <span className="ssd-badge">Affiliate</span>}
                <span className="ssd-link-url">{l.url}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ssd-hint">No piece in the look has a real-world link yet. Add one on the piece in Wardrobe.</p>
        )}
      </div>

      <SiteSwitch entry={entry} working={working}
        onPublish={(links) => act('site', () => styleSheetDistributionApi.publish(episodeId, links), 'The look could not be put on the website.')}
        onAvailable={(pieceId, available) => act('site', () => styleSheetDistributionApi.setLinkAvailable(episodeId, pieceId, available), 'That could not be saved.')}
        onTakeDown={() => act('site', () => styleSheetDistributionApi.takeDown(episodeId), 'The look could not be taken off the website.')} />

      <div className="ssd-actions ssd-actions-end">
        <button type="button" className="ssd-btn ssd-btn-quiet" disabled={working}
          onClick={() => act('remove', () => styleSheetDistributionApi.remove(episodeId), 'The style sheet could not be removed.')}>
          <Trash2 size={16} aria-hidden="true" />
          Remove from Distribution
        </button>
      </div>
    </section>
  );
}
