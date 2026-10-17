/**
 * Admin › The Pulse at a glance (Evoni's Admin mock, 2026-10-17;
 * lib/pulseSummary): the four numbers across the top (PulseStats), and
 * under Review, Needs your attention and Recent activity. Each attention
 * row opens its Review section. Styles: pages/AdminPulse.css (pd-*).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, CalendarClock, CheckCircle2, ChevronRight, FileText, Heart, MessageCircle,
  MessageSquare, AlertTriangle, TrendingUp, Users, Send,
} from 'lucide-react';
import { posterOf, whenLabel } from '../../lib/pulsePosts';

const fmt = (n) => Number(n).toLocaleString('en-US');
const releaseWhen = (at) => new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Stat({ Icon, value, label, sub, testId }) {
  return (
    <div className="pd-stat" data-testid={testId}>
      <span className="pd-stat-icon" aria-hidden="true"><Icon size={24} /></span>
      <span className="pd-stat-text">
        <span className="pd-stat-value">{value}</span>
        <span className="pd-stat-label">{label}</span>
        <span className="pd-stat-sub">{sub}</span>
      </span>
    </div>
  );
}

/** The four numbers: scheduled posts, drafts waiting, comments to review, Lala's followers. */
export function PulseStats({ summary }) {
  const s = summary?.stats;
  const g = s?.growth;
  const growthValue = !g ? '—' : g.pct !== null ? `${g.pct > 0 ? '+' : ''}${g.pct}%` : fmt(g.count);
  const growthSub = !g ? 'No follower count yet' : g.pct !== null ? `${fmt(g.count)} followers${g.label ? ` · ${g.label}` : ''}` : 'Her starting count';
  return (
    <div className="pd-stats" aria-busy={!summary} data-testid="pd-stats">
      <Stat Icon={CalendarClock} testId="pd-stat-scheduled" value={s ? s.scheduled : '—'} label="Scheduled posts"
        sub={!s ? 'Loading…' : s.today ? `Next: ${s.today} today` : s.scheduled ? 'None today' : 'Nothing scheduled'} />
      <Stat Icon={FileText} testId="pd-stat-drafts" value={s ? s.drafts : '—'} label="Drafts to release" sub="Lala's and episodes'" />
      <Stat Icon={MessageCircle} testId="pd-stat-comments" value={s ? s.comments : '—'} label="Comments to review" sub="Drafted reactions" />
      <Stat Icon={TrendingUp} testId="pd-stat-growth" value={s ? growthValue : '—'} label="Audience growth" sub={s ? growthSub : 'Loading…'} />
    </div>
  );
}

const ATTENTION_ICONS = { drafts: Send, flagged: AlertTriangle, comments: MessageSquare, tomorrow: CalendarClock, numbers: Heart, followers: Users, closeness: Heart, dms: MessageCircle };

/** Each kind of thing waiting; Review opens its section. */
export function PulseAttention({ summary, onOpen }) {
  const rows = summary?.attention || [];
  return (
    <section className="pd-card pd-attention" aria-labelledby="pd-attention-heading" data-testid="pd-attention">
      <div className="pd-card-head">
        <h3 id="pd-attention-heading" className="pd-h3"><AlertTriangle size={18} aria-hidden="true" /> Needs your attention{summary ? ` (${rows.length})` : ''}</h3>
      </div>
      {!summary && <p className="pd-empty">Loading…</p>}
      {summary && rows.length === 0 && <p className="pd-empty"><CheckCircle2 size={16} aria-hidden="true" /> Nothing waiting. You're all caught up.</p>}
      <ul className="pd-rows">
        {rows.map((a) => {
          const Icon = ATTENTION_ICONS[a.key] || Activity;
          return (
            <li key={a.key} className="pd-row" data-testid={`pd-attention-${a.key}`}>
              <span className="pd-row-icon" aria-hidden="true"><Icon size={20} /></span>
              <span className="pd-row-text"><b>{a.title}</b><span>{a.hint}</span></span>
              <button type="button" className="pd-btn is-small" onClick={() => onOpen?.(a.section)}>Review</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The latest live posts and the scheduled drafts, newest first. */
export function PulseActivity({ summary, now = new Date() }) {
  const rows = summary?.activity || [];
  return (
    <section className="pd-card pd-activity" aria-labelledby="pd-activity-heading" data-testid="pd-activity">
      <div className="pd-card-head">
        <h3 id="pd-activity-heading" className="pd-h3"><Activity size={18} aria-hidden="true" /> Recent activity</h3>
        <Link className="pd-link" to="/pulse">View The Pulse <ChevronRight size={14} aria-hidden="true" /></Link>
      </div>
      {!summary && <p className="pd-empty">Loading…</p>}
      {summary && rows.length === 0 && <p className="pd-empty">Nothing yet. Released and scheduled posts show here.</p>}
      <ul className="pd-rows">
        {rows.map((a) => {
          const who = posterOf(a.post);
          const live = a.kind === 'live';
          return (
            <li key={a.key} className="pd-row" data-testid="pd-activity-row">
              <span className="pd-row-icon" aria-hidden="true">{live ? <CheckCircle2 size={20} /> : <CalendarClock size={20} />}</span>
              {a.post.image_url
                ? <img className="pd-row-thumb" src={a.post.image_url} alt="" />
                : <span className="pd-row-thumb is-empty" aria-hidden="true">{(who.name || '?').charAt(0).toUpperCase()}</span>}
              <span className="pd-row-text">
                <b>{live ? 'Post released' : 'Scheduled'}</b>
                <span>{live ? `${who.name}: ${(a.post.content_text || '').slice(0, 60)}` : `Going live ${releaseWhen(a.post.release_at)}`}</span>
              </span>
              <span className="pd-row-when">{whenLabel(a.at, now)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
