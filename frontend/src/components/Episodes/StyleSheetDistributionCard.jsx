// frontend/src/components/Episodes/StyleSheetDistributionCard.jsx
import React, { useEffect, useState } from 'react';
import { Copy, Download, Loader2, Lock, Trash2 } from 'lucide-react';
import { downloadStyleSheetExport, styleSheetDistributionApi, styleSheetError } from '../../lib/styleSheetApi';

/**
 * The approved style sheet in Distribution (Task #2878): every export size as
 * a download, the caption draft she edits, Shop the Look links, and the
 * affiliate disclosure. The disclosure is the server's: it leads the post
 * whenever an included link is an affiliate link and has no edit control.
 * Nothing here posts anywhere; "Copy post text" puts it on the clipboard.
 */
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
    } catch (err) {
      console.error(`[Distribution] style sheet ${key} failed:`, err);
      setError(await styleSheetError(err, fallback));
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
