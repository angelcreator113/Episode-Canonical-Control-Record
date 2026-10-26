/**
 * The daily update's "Season: needs attention" (Evoni, 2026-10-26, Season
 * page round 3: the Season page's Needs attention list, in the daily
 * update). One list per show with a season in progress (the update's
 * `seasons`), each the Season page's own list: the same items, ranked and
 * worded by lib/seasonAttention, read by lib/seasonAttentionLoad, drawn by
 * SeasonAttention, every row a link to its fix on that show's Season page.
 *
 * Props: seasons ([{ show_id, show, season_number, title }]), api,
 * focusSlot (the AI mount point "Focus for today": an empty spot above the
 * lists until a later step fills it).
 */
import { Link } from 'react-router-dom';
import SeasonAttention from './SeasonAttention';
import { useSeasonAttention } from '../../lib/seasonAttentionLoad';
import { seasonPageHref } from '../../lib/seasonPage';
import './SeasonAttentionDigest.css';

function ShowSeason({ season, api }) {
  const { items, loading, error } = useSeasonAttention({ api, showId: season.show_id });
  const hrefFor = (link) => (link?.href ? link.href : seasonPageHref(season.show_id, link?.tab || null, link?.extra || null));
  const name = `${season.show ? `${season.show} · ` : ''}Season ${season.season_number}${season.title ? `: ${season.title}` : ''}`;
  return (
    <div className="sad-show" data-testid={`du-season-${season.show_id}`}>
      <p className="sad-name">
        <Link to={seasonPageHref(season.show_id)} className="sad-link">{name}</Link>
      </p>
      {error ? <p className="sad-error" role="alert">{error}</p> : (
        <SeasonAttention items={items} hrefFor={hrefFor} loading={loading}
          title="Needs attention" headingId={`sad-title-${season.show_id}`} testId={`du-season-attention-${season.show_id}`} />
      )}
    </div>
  );
}

export default function SeasonAttentionDigest({ seasons = [], api, focusSlot = null }) {
  if (!(seasons || []).length) return null;
  return (
    <section className="sad" aria-labelledby="sad-head" data-testid="du-seasons">
      <h2 id="sad-head" className="sad-head">The season</h2>
      {/* AI mount point: "Focus for today". Empty until a later step fills it. */}
      <div className="sad-ai-slot" data-slot="daily-focus" data-testid="du-slot-focus">{focusSlot}</div>
      {seasons.map((s) => <ShowSeason key={s.show_id} season={s} api={api} />)}
    </section>
  );
}
