/**
 * CostOverview — the cost page's own sections on Admin › AI Costs
 * (AICostTracker; Evoni, 2026-10-19: "yes start the cost page with your
 * recommendations"). Reads GET /api/v1/ai-usage/cost-overview (ADMIN,
 * services/costOverview):
 *
 *   TodayBudgets     today against both daily budgets — all AI spend
 *                    (AI_DAILY_BUDGET_USD, text and images together) and
 *                    images (AI_DAILY_IMAGE_BUDGET_USD) — the figures the
 *                    gates enforce; unpriced calls are named, never $0
 *   PostPictures     today's post pictures against the daily limit, and
 *                    how many wait for tomorrow (when that exists)
 *   SpendChart       the last N days, text and image spend stacked per day,
 *                    with a hover tooltip and a table view
 *   TopLists         the five most expensive days and features
 *   FeatureTable     spend grouped by feature, today or over the range,
 *                    each opening to its raw route names
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, OctagonAlert, Image as ImageIcon, MessageSquareText, Clock } from 'lucide-react';

// Two categorical slots, validated (dataviz validate_palette.js, light surface).
export const SERIES = { text: '#2a78d6', image: '#eb6834' };
const LEVEL = {
  ok: { label: 'Within budget', Icon: CheckCircle2 },
  warn: { label: 'Past 80%', Icon: AlertTriangle },
  over: { label: 'Used up', Icon: OctagonAlert },
};

export function usd(v, places = 2) {
  const n = Number(v) || 0;
  if (n > 0 && n < 0.01 && places === 2) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(places)}`;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function BudgetMeter({ title, line, testId }) {
  const { label, Icon } = LEVEL[line.level] || LEVEL.ok;
  const pct = Math.min(100, Math.max(0, line.percent));
  return (
    <div className={`aic-budget is-${line.level}`} data-testid={testId}>
      <div className="aic-budget-head">
        <span className="aic-budget-title">{title}</span>
        <span className={`aic-level is-${line.level}`}><Icon size={14} aria-hidden /> {label}</span>
      </div>
      <p className="aic-budget-line">{usd(line.spent_usd)} <span className="aic-muted">of {usd(line.cap_usd)} · {usd(line.left_usd)} left · {line.percent}%</span></p>
      <div className="aic-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={`${title} used`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TodayBudgets({ data }) {
  const { budgets, today } = data;
  return (
    <section className="aic-card" aria-labelledby="aic-today" data-testid="aic-today">
      <h3 id="aic-today" className="aic-h3">Today ({data.day}, UTC)</h3>
      {!budgets.read_ok && (
        <p className="aic-note is-warn" role="status"><AlertTriangle size={14} aria-hidden /> Today&rsquo;s spend could not be read from the usage log, so the figures below may be low. The gates let calls through while the log can&rsquo;t be read.</p>
      )}
      <div className="aic-budgets">
        <BudgetMeter title="All AI spend (text and images)" line={budgets.all} testId="aic-budget-all" />
        <BudgetMeter title="Images" line={budgets.images} testId="aic-budget-images" />
      </div>
      <p className="aic-muted aic-split">
        <span><MessageSquareText size={14} aria-hidden style={{ color: SERIES.text }} /> Text {usd(today.text_usd)}</span>
        <span><ImageIcon size={14} aria-hidden style={{ color: SERIES.image }} /> Images {usd(today.image_usd)} · {plural(budgets.image_calls, 'image call')}</span>
        {today.unpriced_calls > 0 && <span data-testid="aic-unpriced">{plural(today.unpriced_calls, 'call')} with no price (not counted in the totals)</span>}
      </p>
    </section>
  );
}

export function PostPictures({ data }) {
  const p = data.post_pictures;
  const pct = p.limit > 0 ? Math.min(100, Math.round((p.made_today / p.limit) * 100)) : 100;
  return (
    <section className="aic-card" aria-labelledby="aic-pp" data-testid="aic-post-pictures">
      <h3 id="aic-pp" className="aic-h3">Post pictures today</h3>
      <p className="aic-budget-line">{p.made_today} <span className="aic-muted">of {p.limit} a day</span></p>
      <div className="aic-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Post pictures made today">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="aic-muted">
        <Clock size={14} aria-hidden />{' '}
        {p.waiting_available
          ? (p.waiting > 0 ? `${plural(p.waiting, 'post')} waiting for tomorrow's limit` : 'No posts waiting for tomorrow')
          : 'Waiting posts: not available yet (post pictures are not on this server yet)'}
      </p>
    </section>
  );
}

/** Stacked daily bars: text below, images above, one y-axis in USD. */
export function SpendChart({ daily }) {
  const [hover, setHover] = useState(null);
  // Drawn at the box's own width so text stays its real size on any screen.
  const boxRef = useRef(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => { if (el.clientWidth > 0) setW(Math.round(el.clientWidth)); };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220; const pad = { l: 52, r: 8, t: 12, b: 28 };
  const max = Math.max(0.01, ...daily.map((d) => d.text_usd + d.image_usd));
  const niceMax = useMemo(() => {
    const p = 10 ** Math.floor(Math.log10(max));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= max) || max;
  }, [max]);
  const plotW = W - pad.l - pad.r; const plotH = H - pad.t - pad.b;
  const step = plotW / Math.max(1, daily.length);
  const barW = Math.max(2, Math.min(18, step - 4));
  const y = (v) => pad.t + plotH - (v / niceMax) * plotH;
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(daily.length / Math.max(2, Math.floor(plotW / 70)));
  const empty = daily.every((d) => d.text_usd + d.image_usd === 0);
  // A rounded top on the upper segment only: data ends round, the baseline stays square.
  const roundedTop = (x, top, w, h) => {
    const r = Math.min(4, h, w / 2);
    return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`;
  };
  const tip = hover != null ? daily[hover] : null;
  return (
    <section className="aic-card" aria-labelledby="aic-chart" data-testid="aic-chart">
      <div className="aic-card-head">
        <h3 id="aic-chart" className="aic-h3">Spend by day</h3>
        <ul className="aic-legend" aria-label="Legend">
          <li><span className="aic-swatch" style={{ background: SERIES.text }} /> Text</li>
          <li><span className="aic-swatch" style={{ background: SERIES.image }} /> Images</li>
        </ul>
      </div>
      {empty ? <p className="aic-muted">No spend logged in this range.</p> : (
        <div className="aic-chart-wrap" ref={boxRef}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="aic-chart" role="img" aria-label="Daily spend, text and images stacked">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="aic-grid" />
                <text x={pad.l - 6} y={y(t)} className="aic-axis" textAnchor="end" dominantBaseline="middle">{usd(t)}</text>
              </g>
            ))}
            {daily.map((d, i) => {
              const x = pad.l + i * step + (step - barW) / 2;
              const hText = (d.text_usd / niceMax) * plotH;
              const hImg = (d.image_usd / niceMax) * plotH;
              const gap = hText > 0 && hImg > 0 ? 2 : 0;
              const textTop = y(d.text_usd);
              return (
                <g key={d.day}>
                  {hText > 0 && (hImg > 0
                    ? <rect x={x} y={textTop} width={barW} height={hText} fill={SERIES.text} />
                    : <path d={roundedTop(x, textTop, barW, hText)} fill={SERIES.text} />)}
                  {hImg > 0 && <path d={roundedTop(x, textTop - hImg, barW, Math.max(0, hImg - gap))} fill={SERIES.image} />}
                  {i % labelEvery === 0 && (
                    <text x={x + barW / 2} y={H - 8} className="aic-axis" textAnchor="middle">{shortDay(d.day)}</text>
                  )}
                  <rect
                    x={pad.l + i * step} y={pad.t} width={step} height={plotH} fill="transparent"
                    data-testid={`aic-bar-${d.day}`}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={-1}
                  />
                  {hover === i && <rect x={x - 1} y={pad.t} width={barW + 2} height={plotH} className="aic-hover" />}
                </g>
              );
            })}
          </svg>
          {tip && (
            <div className={`aic-tip${(pad.l + hover * step + step / 2) > W / 2 ? ' is-left' : ''}`} role="status" data-testid="aic-tip"
              style={{ left: `${pad.l + hover * step + step / 2}px` }}>
              <strong>{shortDay(tip.day)}</strong>
              <span><span className="aic-swatch" style={{ background: SERIES.text }} /> Text {usd(tip.text_usd)}</span>
              <span><span className="aic-swatch" style={{ background: SERIES.image }} /> Images {usd(tip.image_usd)}</span>
              <span className="aic-muted">{plural(tip.calls, 'call')}{tip.unpriced_calls ? ` · ${tip.unpriced_calls} with no price` : ''}</span>
            </div>
          )}
        </div>
      )}
      <details className="aic-details">
        <summary>Show as a table</summary>
        <div className="aic-table-wrap">
          <table className="aic-table">
            <thead><tr><th>Day</th><th>Text</th><th>Images</th><th>Total</th><th>Calls</th></tr></thead>
            <tbody>
              {daily.slice().reverse().map((d) => (
                <tr key={d.day}><td>{d.day}</td><td>{usd(d.text_usd)}</td><td>{usd(d.image_usd)}</td><td>{usd(d.total_usd)}</td><td>{d.calls}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function TopLists({ data }) {
  return (
    <div className="aic-two">
      <section className="aic-card" aria-labelledby="aic-topdays" data-testid="aic-top-days">
        <h3 id="aic-topdays" className="aic-h3">Most expensive days</h3>
        {data.top_days.length === 0 ? <p className="aic-muted">Nothing spent in this range.</p> : (
          <ol className="aic-rank">
            {data.top_days.map((d) => <li key={d.day}><span>{shortDay(d.day)}</span><span className="aic-mono">{usd(d.total_usd)}</span></li>)}
          </ol>
        )}
      </section>
      <section className="aic-card" aria-labelledby="aic-topfeat" data-testid="aic-top-features">
        <h3 id="aic-topfeat" className="aic-h3">Most expensive features</h3>
        {data.top_features.length === 0 ? <p className="aic-muted">Nothing spent in this range.</p> : (
          <ol className="aic-rank">
            {data.top_features.map((f) => <li key={f.key}><span>{f.label}</span><span className="aic-mono">{usd(f.total_usd)}</span></li>)}
          </ol>
        )}
      </section>
    </div>
  );
}

export function FeatureTable({ data }) {
  const [when, setWhen] = useState('today');
  const rows = when === 'today' ? data.features.today : data.features.range;
  return (
    <section className="aic-card" aria-labelledby="aic-features" data-testid="aic-features">
      <div className="aic-card-head">
        <h3 id="aic-features" className="aic-h3">Spend by feature</h3>
        <div className="aic-toggle" role="group" aria-label="Range">
          <button type="button" aria-pressed={when === 'today'} onClick={() => setWhen('today')}>Today</button>
          <button type="button" aria-pressed={when === 'range'} onClick={() => setWhen('range')}>Last {data.days} days</button>
        </div>
      </div>
      {rows.length === 0 ? <p className="aic-muted">No spend logged {when === 'today' ? 'today' : 'in this range'}.</p> : (
        <ul className="aic-features">
          {rows.map((f) => (
            <li key={f.key}>
              <details>
                <summary>
                  <span className="aic-feature-name">{f.label}</span>
                  <span className="aic-mono">{usd(f.total_usd)}</span>
                  <span className="aic-muted aic-feature-split">text {usd(f.text_usd)} · images {usd(f.image_usd)} · {plural(f.text_calls + f.image_calls, 'call')}{f.unpriced_calls ? ` · ${f.unpriced_calls} with no price` : ''}</span>
                </summary>
                <ul className="aic-routes">
                  {f.routes.map((r) => <li key={r.route_name}><code>{r.route_name}</code> <span className="aic-mono">{usd(r.usd)}</span></li>)}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
