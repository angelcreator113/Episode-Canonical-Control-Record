/**
 * ProfileView — character-centred overview for the Relationship Engine
 * Prime Studios · LalaVerse
 *
 * Every number here is derived from the confirmed relationships and the
 * pending seeds already loaded by the page; nothing is invented.
 */
import { useMemo } from 'react';
import {
  Heart, ChevronRight, Plus, Sparkles, GitBranch, Download,
  Users, Flame, HeartHandshake, Sprout, Link2, BookOpen, Activity,
} from 'lucide-react';
import {
  TENSION, LALA_CONN, STAGE_TONE, cname, initials, roleColor, roleLabel, sideName,
  typeLabel, stageLabel, humanize, isLoveInterest, isFamily,
} from './tokens';
import { Pill } from './primitives';
import { findLala } from '../../lib/theCast';

/* tension → closeness score (0 = strained, 100 = close) */
const CLOSENESS = { calm: 95, healing: 70, simmering: 45, volatile: 20, fractured: 5 };

const otherSide = (r, id, charById) => (r.character_id_a === id
  ? { id: r.character_id_b, name: sideName(r, 'b', charById) }
  : { id: r.character_id_a, name: sideName(r, 'a', charById) });

function Stage({ stage }) {
  if (!stage) return null;
  return <span className={`re-stage ${STAGE_TONE[stage] || ''}`}>{stageLabel(stage)}</span>;
}

function Avatar({ char, name, size = 'md' }) {
  const label = char ? cname(char) : (name || '?');
  const color = char ? roleColor(char.role_type) : undefined;
  return (
    <span className={`rp-avatar rp-avatar-${size}`} style={{ color }}>
      {char?.portrait_url
        ? <img src={char.portrait_url} alt="" />
        : initials(label)}
    </span>
  );
}

function Card({ icon: Icon, title, action, onAction, children, className = '' }) {
  return (
    <section className={`rp-card ${className}`}>
      <header className="rp-card-head">
        <h3 className="rp-card-title">{Icon && <Icon size={18} aria-hidden />}{title}</h3>
        {action && <button type="button" className="rp-viewall" onClick={onAction}>{action}</button>}
      </header>
      {children}
    </section>
  );
}

export default function ProfileView({
  char, chars, rels, cands,
  onSelectChar, onRelClick, onAdd, onGenerate, onExport, onTab,
}) {
  const charById = useMemo(() => {
    const m = {};
    chars.forEach(c => { m[c.id] = c; });
    return m;
  }, [chars]);

  const mine = useMemo(() => (char
    ? rels
      .filter(r => r.character_id_a === char.id || r.character_id_b === char.id)
      .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    : []), [rels, char]);

  const seeds = useMemo(() => (char
    ? cands.filter(c => c.character_id_a === char.id || c.character_id_b === char.id)
    : []), [cands, char]);

  const stats = useMemo(() => {
    const scored = mine.filter(r => r.tension_state in CLOSENESS);
    const closeness = scored.length
      ? Math.round(scored.reduce((n, r) => n + CLOSENESS[r.tension_state], 0) / scored.length)
      : null;
    const count = pred => mine.filter(pred).length;
    return {
      closeness,
      scored: scored.length,
      tiles: [
        { key: 'calm',     label: 'Calm',     icon: HeartHandshake, tone: 'rose',
          n: count(r => r.tension_state === 'calm' || r.tension_state === 'healing') },
        { key: 'family',   label: 'Family',   icon: Users,          tone: 'orchid',
          n: count(r => isFamily(r) || r.relationship_type === 'familial') },
        { key: 'romantic', label: 'Romantic', icon: Heart,          tone: 'teal',
          n: count(r => isLoveInterest(r) || r.relationship_type === 'romantic') },
        { key: 'tension',  label: 'Tension',  icon: Flame,          tone: 'gold',
          n: count(r => ['simmering', 'volatile', 'fractured'].includes(r.tension_state)) },
      ],
    };
  }, [mine]);

  const connections = useMemo(() => {
    const seen = new Map();
    mine.forEach(r => {
      const o = otherSide(r, char.id, charById);
      if (!seen.has(o.id)) seen.set(o.id, { ...o, char: charById[o.id], rel: r });
    });
    return [...seen.values()];
  }, [mine, char, charById]);

  const loves = mine.filter(isLoveInterest);

  if (!char) {
    return (
      <div className="re-empty" role="status">
        <div className="re-empty-icon"><Users size={32} aria-hidden /></div>
        <div className="re-empty-title">No one in Lala's world yet</div>
        <div className="re-empty-desc">The people here are Lala's Pulse profiles that have a character. Link one on the Characters page.</div>
      </div>
    );
  }

  // Lala is the show's Protagonist whatever her stored role (lib/theCast.js).
  const isLala = findLala([char]) === char;
  const roleType = isLala ? 'protagonist' : char.role_type;
  const lalaRel = mine.find(r => r.lala_connection && r.lala_connection !== 'none');
  const lalaLabel = lalaRel ? LALA_CONN.find(l => l.v === lalaRel.lala_connection)?.l : null;
  const statusWord = stats.closeness == null ? 'No tension recorded'
    : stats.closeness >= 67 ? 'Close' : stats.closeness >= 34 ? 'Neutral' : 'Strained';

  const about = [
    { label: 'Role',               value: char.role_label },
    { label: 'Core Belief',        value: char.core_belief },
    { label: 'Pressure',           value: char.pressure_type },
    { label: 'Emotional Function', value: char.emotional_function },
    ...(isLala ? [] : [{ label: 'Relationship With Lala', value: lalaLabel }]),
  ];

  return (
    <div className="rp-grid">
      {/* ── LEFT / CENTRE COLUMN ─────────────────────────────────── */}
      <div className="rp-col">
        <section className="rp-card rp-hero">
          <div className="rp-portrait">
            <Avatar char={char} size="xl" />
            <span className="rp-portrait-heart"><Heart size={18} fill="currentColor" aria-hidden /></span>
          </div>
          <div className="rp-hero-body">
            <h2 className="rp-name">{cname(char)}</h2>
            <div className="rp-chips">
              {/* the same role words as the sidebar and the Web (tokens' roleLabel) */}
              {roleType && <span className="rp-chip">{roleLabel(char)}</span>}
              {char.role_label && <span className="rp-chip">{char.role_label}</span>}
              {char.display_name && char.display_name !== cname(char) && <span className="rp-chip rp-chip-handle">{char.display_name}</span>}
              {char.status && <span className="rp-chip">{char.status}</span>}
            </div>
            <p className="rp-bio">{char.description || char.personality || 'No description yet.'}</p>
          </div>
        </section>

        <Card icon={BookOpen} title="About">
          <dl className="rp-about">
            {about.map(f => (
              <div key={f.label} className="rp-about-row">
                <dt>{f.label}</dt>
                <dd>{f.value || <span className="rp-muted">—</span>}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card icon={Activity} title="Recent Relationships"
          action={mine.length ? 'View All' : null} onAction={() => onTab('list')}>
          {mine.length === 0
            ? <p className="rp-muted rp-pad">No confirmed relationships yet.</p>
            : (
              <ul className="rp-rows">
                {mine.slice(0, 5).map(r => {
                  const o = otherSide(r, char.id, charById);
                  const tc = r.tension_state && TENSION[r.tension_state];
                  return (
                    <li key={r.id}>
                      <button type="button" className="rp-row" onClick={() => onRelClick(r)}>
                        <Avatar char={charById[o.id]} name={o.name} size="sm" />
                        <span className="rp-row-text">
                          <span className="rp-row-title">{o.name}</span>
                          <span className="rp-row-sub">{[typeLabel(r), r.connection_mode, r.status].filter(Boolean).join(' · ')}</span>
                        </span>
                        <Stage stage={r.stage} />
                        {tc && <Pill color={tc.color} bg={tc.bg}>{humanize(r.tension_state)}</Pill>}
                        <ChevronRight size={18} aria-hidden className="rp-chev" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>
      </div>

      {/* ── RIGHT COLUMN ─────────────────────────────────────────── */}
      <div className="rp-col">
        <Card icon={Heart} title="Love interests" className="rp-love">
          {loves.length === 0
            ? <p className="rp-muted rp-pad">No love interest for {cname(char)} yet.</p>
            : (
              <ul className="rp-rows">
                {loves.map(r => {
                  const o = otherSide(r, char.id, charById);
                  return (
                    <li key={r.id}>
                      <button type="button" className="rp-row" onClick={() => onRelClick(r)}>
                        <span className="rp-love-heart"><Heart size={16} fill="currentColor" aria-hidden /></span>
                        <span className="rp-row-text">
                          <span className="rp-row-title">{o.name}</span>
                          <span className="rp-row-sub">{r.situation || typeLabel(r)}</span>
                        </span>
                        <Stage stage={r.stage} />
                        <ChevronRight size={18} aria-hidden className="rp-chev" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>

        <Card icon={Heart} title="Relationship Status">
          <div className="rp-meter" role="meter" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={stats.closeness ?? undefined} aria-label={`Overall: ${statusWord}`}>
            <span className="rp-meter-fill" style={{ width: `${stats.closeness ?? 0}%` }} />
          </div>
          <div className="rp-meter-scale"><span>Strained</span><span>Neutral</span><span>Close</span></div>
          <p className="rp-meter-note">
            {stats.closeness == null
              ? 'Set a tension state on a relationship to see this.'
              : `${statusWord} · averaged over ${stats.scored} relationship${stats.scored === 1 ? '' : 's'}`}
          </p>
          <div className="rp-tiles">
            {stats.tiles.map(t => (
              <div key={t.key} className={`rp-tile is-${t.tone}`}>
                <t.icon size={22} aria-hidden />
                <span className="rp-tile-label">{t.label}</span>
                <span className="rp-tile-n">{t.n}</span>
                <span className="rp-tile-bar"><span style={{ width: mine.length ? `${(t.n / mine.length) * 100}%` : 0 }} /></span>
              </div>
            ))}
          </div>
        </Card>

        <Card icon={Link2} title="Connections"
          action={connections.length > 4 ? 'View All' : null} onAction={() => onTab('tree')}>
          {connections.length === 0
            ? <p className="rp-muted rp-pad">No connections yet.</p>
            : (
              <div className="rp-conn-grid">
                {connections.slice(0, 8).map(c => (
                  <button key={c.id} type="button" className="rp-conn"
                    onClick={() => c.char && onSelectChar(c.char)}
                    title={`${c.name} — ${typeLabel(c.rel)}`}>
                    <Avatar char={c.char} name={c.name} size="lg" />
                    <span className="rp-conn-name">{c.name}</span>
                    <span className="rp-conn-type">{typeLabel(c.rel)}</span>
                    <Stage stage={c.rel.stage} />
                  </button>
                ))}
              </div>
            )}
        </Card>

        <Card icon={Sprout} title="Pending Seeds"
          action={seeds.length ? 'View All' : null} onAction={() => onTab('candidates')}>
          {seeds.length === 0
            ? <p className="rp-muted rp-pad">No pending seeds for {cname(char)}.</p>
            : (
              <ul className="rp-rows">
                {seeds.slice(0, 3).map(sd => {
                  const o = otherSide(sd, char.id, charById);
                  return (
                    <li key={sd.id} className="rp-row is-static">
                      <span className="rp-seed-icon"><Sparkles size={16} aria-hidden /></span>
                      <span className="rp-row-text">
                        <span className="rp-row-title">{o.name}</span>
                        <span className="rp-row-sub">{typeLabel(sd)}{sd.situation ? ` · ${sd.situation}` : ''}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>

        <Card title="Actions" icon={Sparkles}>
          <div className="rp-actions">
            <button type="button" className="rp-action" onClick={onAdd}><Plus size={22} aria-hidden />Add Relationship</button>
            <button type="button" className="rp-action" onClick={onGenerate}><Sparkles size={22} aria-hidden />Generate Seeds</button>
            <button type="button" className="rp-action" onClick={() => onTab('tree')}><GitBranch size={22} aria-hidden />View in Tree</button>
            <button type="button" className="rp-action" onClick={onExport}><Download size={22} aria-hidden />Export</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
