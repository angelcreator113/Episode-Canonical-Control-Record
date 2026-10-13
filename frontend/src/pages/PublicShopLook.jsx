/**
 * Shop the Look on the public website (Task #3022; The Pulse spec §10: Shop
 * the Look links appear on the public website, with the affiliate
 * disclosure). /shop-the-look lists the looks Evoni published, newest
 * first; /shop-the-look/:key shows one: its title, her caption, the
 * disclosure first whenever a link is an affiliate link, then each link.
 * Affiliate links carry rel="sponsored". Plain fetches of
 * GET /api/v1/public/looks (published only, no auth; #3021). A look's image
 * is the look strip copied to the public site bucket when Evoni publishes
 * (Task #3120); without one the page is text only. Inside the public site's frame
 * (PublicSiteLayout). Never linked from The Pulse or the game.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicSiteLayout from '../components/site/PublicSiteLayout';

export const PUBLIC_LOOKS_URL = '/api/v1/public/looks';

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** "12 October 2026" */
export const publishedLabel = (iso) => (iso ? new Date(iso)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');

/**
 * An affiliate link is sponsored; every link opens in a new tab without the
 * opener. No noreferrer: some affiliate programmes credit by the referrer.
 */
export const relFor = (link) => (link.affiliate ? 'sponsored noopener' : 'noopener');

function OneLook({ look }) {
  return (
    <article data-testid="site-shop-look">
      <h1 id="site-shop-heading">{look.title}</h1>
      {look.published_at && <p className="site-shop__date">{publishedLabel(look.published_at)}</p>}
      {look.image?.url && <img className="site-shop__image" src={look.image.url} alt={look.image.alt || ''} data-testid="site-shop-image" />}
      {look.disclosure && <p className="site-shop__disclosure" data-testid="site-shop-disclosure">{look.disclosure}</p>}
      {look.caption && <p className="site-shop__caption">{look.caption}</p>}
      <ul className="site-shop__links">
        {look.links.map((l, i) => (
          <li key={i} className="site-shop__link" data-testid="site-shop-link">
            <a href={l.url} target="_blank" rel={relFor(l)}>{l.label}</a>
            {l.retailer && <span> · {l.retailer}</span>}
            {l.affiliate && <span className="site-shop__badge">Affiliate link</span>}
          </li>
        ))}
      </ul>
      <p><Link to="/shop-the-look">Every look</Link></p>
    </article>
  );
}

export default function PublicShopLook() {
  const { key } = useParams();
  const [looks, setLooks] = useState(null);
  const [look, setLook] = useState(undefined);   // undefined: loading; null: none or not found
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLook(undefined);
    setError(false);
    (async () => {
      try {
        if (key) {
          const one = await getJson(`${PUBLIC_LOOKS_URL}/${encodeURIComponent(key)}`);
          if (!cancelled) setLook(one?.look || null);
        } else {
          const body = await getJson(PUBLIC_LOOKS_URL);
          if (!cancelled) { setLooks(Array.isArray(body?.looks) ? body.looks : []); setLook(null); }
        }
      } catch (err) {
        console.error('[PublicShopLook] the looks could not be read:', err.message);
        if (!cancelled) { setError(true); setLook(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  let body;
  if (look === undefined) body = <p>Loading…</p>;
  else if (look) body = <OneLook look={look} />;
  else if (error) body = <><h1 id="site-shop-heading">The looks could not be loaded.</h1><p>Try again in a moment.</p></>;
  else if (key) body = <><h1 id="site-shop-heading">That look is not here.</h1><p><Link to="/shop-the-look">Every look</Link></p></>;
  else if (!looks?.length) body = <><h1 id="site-shop-heading">No looks yet.</h1><p>Shop the Look is coming soon.</p></>;
  else {
    body = (
      <>
        <h1 id="site-shop-heading">Shop the Look</h1>
        <ul className="site-shop__list" data-testid="site-shop-list">
          {looks.map((l) => (
            <li key={l.key} className="site-shop__item">
              {l.image?.url && <img className="site-shop__thumb" src={l.image.url} alt="" loading="lazy" data-testid="site-shop-thumb" />}
              <span><Link to={`/shop-the-look/${l.key}`}>{l.title}</Link> <span>{publishedLabel(l.published_at)}</span></span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <PublicSiteLayout>
      <section className="site-section site-shop" aria-labelledby="site-shop-heading" data-testid="site-shop">
        <div className="site-wrap site-shop__inner">
          <p className="site-eyebrow">Shop the Look</p>
          {body}
        </div>
      </section>
    </PublicSiteLayout>
  );
}
