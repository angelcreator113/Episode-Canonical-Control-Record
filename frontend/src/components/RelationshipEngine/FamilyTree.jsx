/**
 * FamilyTree — the Family tab's tree (Evoni, 2026-10-23: "I want them all").
 * Prime Studios · LalaVerse
 *
 * Each family (a named family from GET /families, or people joined only by
 * family ties) is drawn with its generations top to bottom; step and chosen
 * family are dashed lines; romance is never in it (familyTree.js). Under
 * 600px the same tree is an indented list (FamilyTree.css). A tie's line
 * opens its Inspector.
 *
 * heritage (FamilyView's Heritage toggle, 2026-10-24): { byId, starterTags,
 * onSaved }. Each character shows their heritage under their name, or
 * "Heritage not set" with the inline edit; someone who is not a character
 * (a name, a Pulse-only profile) shows "—". It only shows: real families
 * include mixed heritage, adoption, step and chosen family.
 */
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { API } from './tokens';
import { buildFamilyTrees, isDashed } from './familyTree';
import { HeritageLine, HeritageEditor, heritageLabel } from '../CharacterFamily/Heritage';
import './FamilyTree.css';

export const fetchFamilies = () => apiClient.get(`${API}/families`);

/**
 * The named families, [] until they load (or when they cannot). skip: the
 * caller already has them (the Family tab reads them once and hands them
 * down), so no second GET /families.
 */
export function useFamilies({ skip = false } = {}) {
  const [families, setFamilies] = useState([]);
  useEffect(() => {
    if (skip) return undefined;
    let live = true;
    Promise.resolve(fetchFamilies())
      .then((res) => { if (live) setFamilies(res?.data?.families || []); })
      .catch((err) => console.error('[FamilyTree] families load failed:', err));
    return () => { live = false; };
  }, [skip]);
  return families;
}

const COL = 168;
const NODE_W = 140;
// With heritage on, each card has a third line, so rows stand further apart.
const sizes = (on) => ({ ROW: on ? 120 : 104, NODE_H: on ? 68 : 52 });
const PAD = 16;
const KIND_WORD = { blood: 'blood', step: 'step', adoptive: 'adoptive', married: 'married in', chosen: 'chosen' };

const roleWords = (e, names) => (e.role ? `${names[e.from]} is ${names[e.to]}'s ${e.role}` : `${names[e.from]} and ${names[e.to]}`);
const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const firstName = (n) => String(n || '').split(/\s+/)[0];

function TreeDrawing({ tree, onRelClick, heritage }) {
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();
  const { ROW, NODE_H } = sizes(!!heritage);
  const width = Math.max(...tree.rows.map((r) => r.length)) * COL + PAD * 2;
  const height = tree.rows.length * ROW + PAD;
  const pos = {};
  const names = {};
  tree.rows.forEach((row, ri) => {
    const offset = (width - PAD * 2 - row.length * COL) / 2;
    row.forEach((n, ci) => {
      pos[n.key] = { x: PAD + offset + ci * COL + (COL - NODE_W) / 2, y: PAD + ri * ROW };
      names[n.key] = n.name;
    });
  });
  const path = (e) => {
    const a = pos[e.from];
    const b = pos[e.to];
    if (a.y === b.y) {
      const [l, r] = a.x < b.x ? [a, b] : [b, a];
      const x1 = l.x + NODE_W;
      const x2 = r.x;
      if (x2 - x1 <= COL - NODE_W + 1) return { d: `M${x1},${l.y + NODE_H / 2} L${x2},${r.y + NODE_H / 2}` };
      // Not side by side: an arc over the row, clear of the people between.
      const mx = (l.x + r.x + NODE_W) / 2;
      return { d: `M${l.x + NODE_W / 2},${l.y} Q${mx},${l.y - 30} ${r.x + NODE_W / 2},${r.y}` };
    }
    const [top, bot] = a.y < b.y ? [a, b] : [b, a];
    const x1 = top.x + NODE_W / 2;
    const x2 = bot.x + NODE_W / 2;
    const y1 = top.y + NODE_H;
    const y2 = bot.y;
    return { d: `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}` };
  };
  return (
    <div className="re-ftree-scroll">
      <svg className="re-ftree-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${tree.name} family tree`}>
        {tree.edges.map((e, i) => {
          const p = path(e);
          const open = e.rel ? () => onRelClick?.(e.rel) : undefined;
          return (
            <g key={`${e.from}-${e.to}-${i}`} className={`re-ftree-edge is-${e.kind || 'unknown'}${open ? ' is-open' : ''}`}
              data-dashed={isDashed(e.kind) ? 'true' : 'false'}
              onClick={open} role={open ? 'button' : undefined} tabIndex={open ? 0 : undefined}
              aria-label={open ? roleWords(e, names) : undefined}
              onKeyDown={open ? (ev) => { if (ev.key === 'Enter') open(); } : undefined}>
              <path d={p.d} fill="none" strokeDasharray={isDashed(e.kind) ? '6 5' : undefined} />
              {e.role && <title>{roleWords(e, names)}</title>}
            </g>
          );
        })}
        {tree.rows.flat().map((n) => {
          // Their role, on the card: "Dre's grandmother" (the first tie they hold).
          const mine = tree.edges.filter((e) => e.from === n.key && e.role && names[e.to]);
          const sub = mine.length ? `${firstName(names[mine[0].to])}'s ${mine[0].role}${mine.length > 1 ? ` +${mine.length - 1}` : ''}` : '';
          const person = heritage && n.kind === 'character' ? heritage.byId[String(n.id)] : null;
          // Not a character: "—", and the way to Make them a character (on the page they were added from).
          const her = heritage ? (n.kind !== 'character' ? (n.of ? '— Make a character' : '—') : heritageLabel(person)) : null;
          const unset = heritage && n.kind === 'character' && !her;
          const editMe = unset && person ? () => setEditing(n)
            : heritage && n.kind !== 'character' && n.of ? () => navigate(`/character/${n.of}`) : undefined;
          return (
          <g key={n.key} className={`re-ftree-node is-${n.kind}`} transform={`translate(${pos[n.key].x},${pos[n.key].y})`}>
            <rect width={NODE_W} height={NODE_H} rx={12} strokeDasharray={n.kind === 'ghost' ? '4 3' : undefined} />
            <text x={NODE_W / 2} y={sub ? 22 : (heritage ? 28 : NODE_H / 2 + 4)} textAnchor="middle">{clip(n.name, 19)}</text>
            {sub && <text x={NODE_W / 2} y={39} textAnchor="middle" className="re-ftree-node-role">{clip(sub, 18)}</text>}
            {heritage && (
              <text x={NODE_W / 2} y={sub ? 57 : 48} textAnchor="middle"
                className={`re-ftree-node-heritage${unset ? ' is-unset' : ''}${editMe ? ' is-open' : ''}`}
                onClick={editMe} role={editMe ? 'button' : undefined} tabIndex={editMe ? 0 : undefined}
                aria-label={editMe ? (unset ? `Set heritage for ${n.name}` : `Make ${n.name} a character`) : undefined}
                onKeyDown={editMe ? (ev) => { if (ev.key === 'Enter') editMe(); } : undefined}>
                {clip(her || 'Heritage not set', 19)}
              </text>
            )}
            <title>{n.name}{n.kind === 'ghost' ? ' (not built yet)' : n.kind === 'profile' ? ' (on the Pulse)' : ''}{heritage ? ` · heritage: ${her || 'not set'}` : ''}</title>
          </g>
          );
        })}
      </svg>
      {heritage && editing && heritage.byId[String(editing.id)] && (
        <div className="re-ftree-heritage-edit">
          <strong>{editing.name}</strong>
          <HeritageEditor person={heritage.byId[String(editing.id)]} starterTags={heritage.starterTags}
            onCancel={() => setEditing(null)} onSaved={(p) => { setEditing(null); heritage.onSaved?.(p); }} />
        </div>
      )}
    </div>
  );
}

/** The same tree for a phone: each generation indented under the one above. */
function TreeList({ tree, onRelClick, heritage }) {
  const names = Object.fromEntries(tree.rows.flat().map((n) => [n.key, n.name]));
  return (
    <ol className="re-ftree-list" aria-label={`${tree.name}, by generation`}>
      {tree.rows.map((row, gi) => row.map((n) => {
        const mine = tree.edges.filter((e) => e.from === n.key && names[e.to]);
        return (
          <li key={n.key} className={`re-ftree-person is-${n.kind}`} style={{ '--gen': gi }} data-gen={gi}>
            <span className="re-ftree-person-name">
              {n.kind === 'character' && n.id ? <Link to={`/character/${n.id}`}>{n.name}</Link> : n.name}
              {n.kind === 'ghost' && <span className="re-ftree-tag">not built yet</span>}
              {n.kind === 'profile' && <span className="re-ftree-tag">on the Pulse</span>}
            </span>
            {heritage && (
              <HeritageLine kind={n.kind} person={n.kind === 'character' ? heritage.byId[String(n.id)] : null} name={n.name}
                starterTags={heritage.starterTags} onSaved={heritage.onSaved}
                makeHref={n.kind !== 'character' && n.of ? `/character/${n.of}` : null} />
            )}
            {mine.map((e, i) => (
              <button key={i} type="button" className={`re-ftree-tie${isDashed(e.kind) ? ' is-dashed' : ''}`}
                disabled={!e.rel} onClick={() => e.rel && onRelClick?.(e.rel)}>
                {names[e.to]}&rsquo;s {e.role || 'family'}{e.kind ? ` · ${KIND_WORD[e.kind] || e.kind}` : ''}
              </button>
            ))}
          </li>
        );
      }))}
    </ol>
  );
}

export default function FamilyTree({ rels = [], charById = {}, families: given, onRelClick, heritage = null }) {
  const loaded = useFamilies({ skip: !!given });
  const families = given || loaded;
  const trees = useMemo(() => buildFamilyTrees({ families, rels, charById }), [families, rels, charById]);
  if (!trees.length) return null;
  return (
    <div className="re-ftree" aria-label="Family trees" data-testid="re-family-tree">
      <div className="re-ftree-legend" aria-hidden="true">
        <span><i className="re-ftree-key is-solid" /> Blood, adoptive, married in</span>
        <span><i className="re-ftree-key is-dashed" /> Step &amp; chosen</span>
        <span><i className="re-ftree-key is-ghost" /> Not built yet</span>
      </div>
      {trees.map((t) => (
        <section key={t.key} className="re-ftree-family" aria-label={t.name}>
          <h3 className="re-ftree-name">{t.name}{t.city ? <span className="re-ftree-city"> · {t.city}</span> : null}</h3>
          <TreeDrawing tree={t} onRelClick={onRelClick} heritage={heritage} />
          <TreeList tree={t} onRelClick={onRelClick} heritage={heritage} />
        </section>
      ))}
    </div>
  );
}
