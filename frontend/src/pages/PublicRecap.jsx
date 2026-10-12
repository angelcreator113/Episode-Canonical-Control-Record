/**
 * The weekly Pulse recap on the public website (Task #3009; The Pulse spec
 * §11 "Weekly Pulse recap: a shareable digest of the week's biggest
 * revealed, published moments for the website"). /pulse-recap shows the
 * latest published recap; /pulse-recap/:id one week. Plain fetches of
 * GET /api/v1/public/recaps (published only, no auth; #3008): the title,
 * Evoni's intro, the posts as The Pulse shows them now (text, likes,
 * comments, the story moment), earlier weeks to open, and a share link
 * (this page's address). Text only: no images until website storage is
 * live. Inside the public site's frame (PublicSiteLayout).
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicSiteLayout from '../components/site/PublicSiteLayout';

export const PUBLIC_RECAPS_URL = '/api/v1/public/recaps';

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** "Week of 28 September 2026" */
export const weekLabel = (weekStart) => `Week of ${new Date(`${weekStart}T00:00:00Z`)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`;

const count = (n) => Number(n || 0).toLocaleString('en-US');

function ShareLink({ id }) {
  const [note, setNote] = useState(null);
  const url = `${window.location.origin}/pulse-recap/${id}`;
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ url }); return; }
      await navigator.clipboard.writeText(url);
      setNote('Link copied.');
    } catch (err) {
      console.warn('[PublicRecap] sharing did not finish:', err.message);
      setNote(url);
    }
  };
  return (
    <p className="site-recap__share">
      <button type="button" className="site-btn site-btn--outline" onClick={share}>Share this recap</button>
      {note && <span role="status">{note}</span>}
    </p>
  );
}

export default function PublicRecap() {
  const { id } = useParams();
  const [list, setList] = useState(null);
  const [recap, setRecap] = useState(undefined);   // undefined: loading; null: none or not found
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecap(undefined);
    setError(false);
    (async () => {
      try {
        const body = await getJson(PUBLIC_RECAPS_URL);
        const recaps = Array.isArray(body?.recaps) ? body.recaps : [];
        if (cancelled) return;
        setList(recaps);
        const wanted = id || recaps[0]?.id;
        if (!wanted) { setRecap(null); return; }
        const one = await getJson(`${PUBLIC_RECAPS_URL}/${encodeURIComponent(wanted)}`);
        if (!cancelled) setRecap(one?.recap || null);
      } catch (err) {
        console.error('[PublicRecap] the recap could not be read:', err.message);
        if (!cancelled) { setError(true); setRecap(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const earlier = (list || []).filter((r) => r.id !== recap?.id);

  return (
    <PublicSiteLayout>
      <section className="site-section site-recap" aria-labelledby="site-recap-heading" data-testid="site-recap">
        <div className="site-wrap site-recap__inner">
          <p className="site-eyebrow">The Pulse recap</p>
          {recap === undefined && <p>Loading…</p>}
          {recap === null && (
            <>
              <h1 id="site-recap-heading">{error ? 'The recap could not be loaded.' : (id ? 'That recap is not here.' : 'No recap yet.')}</h1>
              <p>{error ? 'Try again in a moment.' : 'The first weekly recap of The Pulse is coming soon.'}</p>
            </>
          )}
          {recap && (
            <article data-testid="site-recap-article">
              <h1 id="site-recap-heading">{recap.title}</h1>
              <p className="site-recap__week">{weekLabel(recap.week_start)}</p>
              {recap.intro && <p className="site-recap__intro">{recap.intro}</p>}
              <ol className="site-recap__posts">
                {recap.posts.map((p, i) => (
                  <li key={i} className="site-recap__post" data-testid="site-recap-post">
                    <p className="site-recap__who"><b>{p.poster_display_name || `@${p.poster_handle}`}</b> <span>@{p.poster_handle}</span>{p.moment ? <span> · {p.moment}</span> : null}</p>
                    {p.content_text && <p className="site-recap__text">{p.content_text}</p>}
                    <p className="site-recap__numbers">{count(p.likes)} likes · {count(p.comments_count)} comments</p>
                  </li>
                ))}
              </ol>
              <ShareLink id={recap.id} />
            </article>
          )}
          {earlier.length > 0 && (
            <nav className="site-recap__earlier" aria-label="Earlier weeks">
              <h2>Earlier weeks</h2>
              <ul>
                {earlier.map((r) => <li key={r.id}><Link to={`/pulse-recap/${r.id}`}>{r.title}</Link> <span>{weekLabel(r.week_start)}</span></li>)}
              </ul>
            </nav>
          )}
        </div>
      </section>
    </PublicSiteLayout>
  );
}
