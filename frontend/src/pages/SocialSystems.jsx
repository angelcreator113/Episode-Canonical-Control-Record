/**
 * SocialSystems — Archetypes + Legends/Society + Rules + Trends (the
 * LalaVerse hub's Society tab)
 * Merges: InfluencerSystems + Legends from Infrastructure + Society from Calendar
 *
 * 2026-10-04: each sub-tab says who reads its lists (READS, below) and
 * carries the Brain Update button for the data it shows: the Social
 * Systems button (influencer_systems) on Archetypes and Social Rules, the
 * Calendar button (cultural_calendar: celebrity tiers, famous characters,
 * gossip outlets, algorithm forces, drama mechanics) on Legends & Society,
 * both on Trends. The Feed generator keeps its own built-in archetype
 * list and reads nothing from this page (src/services/feedScheduler.js).
 *
 * 2026-10-06, to the LalaVerse mock: in the hub the tabs sit under the
 * Society front page (components/Society/SocietySummary: the Feed's
 * archetypes counted, what is trending, Lala on the career ladder, the
 * legends), and the whole page is in the hub's design (SocialSystems.css,
 * tokens only; a list item's own color from the data is only its accent).
 */
import { useState } from 'react';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext } from '../components/EditItemModal';
import BrainUpdate from '../components/BrainUpdate';
import SocietySummary from '../components/Society/SocietySummary';
import { ARCHETYPES, RELATIONSHIP_TYPES, ECONOMY_STREAMS, FASHION_TREND_STAGES, BEAUTY_TREND_STAGES, MOMENTUM_WAVES, INFLUENCE_FORCES, LEGACY_SIGNALS, INFLUENCER_DEFAULTS } from '../data/influencerData';
import { CELEBRITY_HIERARCHY, ALGORITHM_FORCES, DRAMA_MECHANICS, GOSSIP_MEDIA, FAMOUS_CHARACTERS, CALENDAR_DEFAULTS } from '../data/calendarData';
import { tabFromSearch } from '../utils/worldRedirects';
import { LEGENDARY_GROUPS } from '../data/legendaryGroups';
import './SocialSystems.css';

const TABS = [
  { key: 'archetypes', label: 'Archetypes' },
  { key: 'legends', label: 'Legends & Society' },
  { key: 'rules', label: 'Social Rules' },
  { key: 'trends', label: 'Trends' },
];

// Who reads each sub-tab's lists, from the code (the wiring map,
// docs/reads/2026-10-06-lalaverse-wiring-map.md §1, §8): Brain Update
// writes these cards into the Show Bible, but no generator reads them yet;
// the shared loader (src/services/brainRules.js) takes only rules marked
// for every prompt, and synced cards are not. The page's saved edits are
// read only by Amber's read_world_page tool.
const READS = {
  archetypes: 'Brain Update writes each archetype into the Show Bible as a Social Archetype card. No generator reads those cards yet: the generators read only Show Bible rules marked for every prompt. The Feed generator picks archetypes from its own built-in list, not from here.',
  legends: 'The fifty legendary roles are fixed placeholders in code; nothing in the app links a role to a character yet. The celebrity tiers, famous characters and gossip outlets below are Culture\'s calendar data, and the Calendar Brain Update here writes them into the Show Bible.',
  rules: 'Brain Update writes the relationship types, economy streams, influence forces and legacy signals into the Show Bible as cards. No generator reads those cards yet: the generators read only Show Bible rules marked for every prompt.',
  trends: 'The fashion and beauty stages and the momentum waves sync through the Social Systems button; the algorithm forces and drama mechanics are Culture\'s calendar data and sync through the Calendar button. No generator reads the page or its cards yet.',
};

// A list item's own color (from the data files) as its accent only.
const accent = (color) => (color ? { '--item': color } : undefined);

/** A row of stages joined by arrows (the trend engines). */
function Stages({ items, meta }) {
  return (
    <ol className="ss-stages">
      {items.map((s) => (
        <li key={s.stage} className="ss-stage" style={accent(s.color)}>
          <span className="ss-stage-num">{s.stage}</span>
          <strong>{s.name}</strong>
          <span className="ss-meta">{meta(s)}</span>
          {s.story && <span className="ss-quote">{s.story}</span>}
        </li>
      ))}
    </ol>
  );
}

export default function SocialSystems({ embedded = false }) {
  // ?tab= opens a tab (audit IA-04): the retired duplicate editors land here.
  const [tab, setTab] = useState(() => tabFromSearch(TABS, 'archetypes', undefined, 'sub'));
  const [editItem, setEditItem] = useState(null);
  const { data: isData, updateItem: isUpdate, addItem: isAdd, removeItem: isRemove, saving: isSaving, loaded: isLoaded } = usePageData('influencer_systems', INFLUENCER_DEFAULTS);
  const { data: ccData, saving: ccSaving, loaded: ccLoaded } = usePageData('cultural_calendar', CALENDAR_DEFAULTS);
  const [openLegend, setOpenLegend] = useState('Fashion Icons');
  const [expandedArch, setExpandedArch] = useState(null);

  const saving = isSaving || ccSaving;
  // The front page's legend chips open a group on the Legends tab.
  const openFromSummary = (key, group) => { setTab(key); if (group) setOpenLegend(group); };

  return (
    <PageEditContext.Provider value={{ data: tab === 'legends' ? { ...isData, ...ccData, LEGENDARY_GROUPS } : isData, setEditItem, removeItem: isRemove }}>
    <div className={`ss${embedded ? ' is-embedded' : ''}`}>
      {embedded && <SocietySummary legendGroups={LEGENDARY_GROUPS} onOpen={openFromSummary} />}

      <section className="ss-shell" aria-label="Social systems">
        {/* Header; inside the LalaVerse hub the tab's banner is the heading */}
        <div className="ss-head">
          <div>
            {!embedded && <h1 className="ss-h1">Social Systems</h1>}
            <h2 className="ss-title">{embedded ? 'The rules of society' : 'Archetypes, legends, relationships, economy, trends'}</h2>
            <p className="ss-sub">The patterns the LalaVerse runs on. Brain Update copies them into the Show Bible.</p>
          </div>
          <div className="ss-head-actions">
            {saving && <span className="ss-saving">Saving…</span>}
            {/* The Brain Update for the data the open sub-tab shows */}
            {(tab === 'archetypes' || tab === 'rules' || tab === 'trends') && <BrainUpdate source="social_systems" data={isData} ready={isLoaded} />}
            {(tab === 'legends' || tab === 'trends') && <BrainUpdate source="cultural_calendar" name="Calendar" data={ccData} ready={ccLoaded} />}
          </div>
        </div>

        <div className="ss-tabs" role="tablist" aria-label="Social systems">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ss-tab${tab === t.key ? ' is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <p data-testid={`society-reads-${tab}`} className="ss-reads"><strong>Who reads this </strong>{READS[tab]}</p>

        {/* ARCHETYPES */}
        {tab === 'archetypes' && (
          <div className="ss-panel">
            <p className="ss-note">Every major creator tends to fall into one of these patterns. The tension between two archetypes in the same person is often the story. Open one for its effect on the audience and what it does in the story.</p>
            <ul className="ss-grid">
              {(isData.ARCHETYPES || ARCHETYPES).map((a) => {
                const open = expandedArch === a.num;
                return (
                  <li key={a.num} className={`ss-card ss-accent-top${open ? ' is-open' : ''}`} style={accent(a.color)}>
                    <button type="button" className="ss-card-btn" aria-expanded={open} onClick={() => setExpandedArch(open ? null : a.num)}>
                      <span className="ss-card-top"><span className="ss-num">{a.num}</span><span aria-hidden="true">{a.icon}</span></span>
                      <strong className="ss-card-title">{a.name}</strong>
                      <span className="ss-card-text">{a.content}</span>
                    </button>
                    {open && (
                      <div className="ss-card-more">
                        <span className="ss-label">Audience effect</span>
                        <p>{a.audience}</p>
                        <span className="ss-label">Narrative function</span>
                        <p className="ss-quote">{a.narrative}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* LEGENDS & SOCIETY */}
        {tab === 'legends' && (
          <div className="ss-panel">
            <h3 className="ss-h3">The 50 legendary influencers</h3>
            <p className="ss-note">The most powerful cultural figures in the LalaVerse. All placeholders: no role is linked to a character yet.</p>
            <div className="ss-chips" role="group" aria-label="Legend groups">
              {LEGENDARY_GROUPS.map((g) => (
                <button key={g.group} type="button" aria-pressed={openLegend === g.group} className={`ss-chip${openLegend === g.group ? ' is-active' : ''}`} onClick={() => setOpenLegend(g.group)}>
                  <span aria-hidden="true">{g.icon}</span> {g.group}
                </button>
              ))}
            </div>
            {LEGENDARY_GROUPS.filter((g) => g.group === openLegend).map((g) => (
              <ul key={g.group} className="ss-list" data-testid="ss-legend-roles">
                {g.roles.map((r) => (
                  <li key={r.role} className="ss-row ss-accent-left" style={accent(g.color)}>
                    <strong>{r.role}</strong> <span className="ss-chip-mini">Placeholder</span>
                    <span className="ss-card-text">{r.fn}</span>
                    <span className="ss-quote">"{r.signature}"</span>
                  </li>
                ))}
              </ul>
            ))}

            <h3 className="ss-h3">Celebrity hierarchy</h3>
            <ul className="ss-grid ss-grid-sm">
              {(ccData.CELEBRITY_HIERARCHY || CELEBRITY_HIERARCHY).map((h) => (
                <li key={h.tier} className="ss-card ss-accent-top" style={accent(h.color)}>
                  <span className="ss-card-top"><span className="ss-num">Tier {h.tier}</span><span className="ss-meta">{h.followers}</span></span>
                  <strong className="ss-card-title">{h.name}</strong>
                  <span className="ss-card-text">{h.desc}</span>
                </li>
              ))}
            </ul>

            <h3 className="ss-h3">The 25 most famous</h3>
            <ul className="ss-grid ss-grid-sm">
              {(ccData.FAMOUS_CHARACTERS || FAMOUS_CHARACTERS).map((c) => (
                <li key={c.rank} className="ss-card ss-accent-top" style={accent(c.color)}>
                  <span className="ss-card-top"><span className="ss-num">#{c.rank}</span><span aria-hidden="true">{c.icon}</span></span>
                  <strong className="ss-card-title">{c.title}</strong>
                  <span className="ss-card-text">{c.role}</span>
                </li>
              ))}
            </ul>

            <h3 className="ss-h3">Gossip media networks</h3>
            <ul className="ss-grid">
              {(ccData.GOSSIP_MEDIA || GOSSIP_MEDIA).map((m) => (
                <li key={m.name} className="ss-card ss-accent-top" style={accent(m.color?.text)}>
                  <strong className="ss-card-title">{m.name}</strong>
                  <span className="ss-meta">{[m.focus, m.style].filter(Boolean).join(' · ')}</span>
                  <span className="ss-card-text">{m.covers}</span>
                  <span className="ss-quote">{m.power}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* SOCIAL RULES */}
        {tab === 'rules' && (
          <div className="ss-panel">
            <h3 className="ss-h3">Relationship types</h3>
            <ul className="ss-list">
              {(isData.RELATIONSHIP_TYPES || RELATIONSHIP_TYPES).map((r) => (
                <li key={r.type} className="ss-row ss-accent-left" style={accent(r.color)}>
                  <strong className="ss-card-title"><span aria-hidden="true">{r.icon}</span> {r.type}</strong>
                  <div className="ss-three">
                    <div><span className="ss-label">Looks like</span><p>{r.looksLike}</p></div>
                    <div><span className="ss-label">Creates</span><p>{r.creates}</p></div>
                    <div><span className="ss-label">Breaks</span><p>{r.breaks}</p></div>
                  </div>
                  {r.storyBreaks && <span className="ss-quote">{r.storyBreaks}</span>}
                </li>
              ))}
            </ul>

            <h3 className="ss-h3">Creator economy</h3>
            <ul className="ss-grid ss-grid-sm">
              {(isData.ECONOMY_STREAMS || ECONOMY_STREAMS).map((e) => (
                <li key={e.stream} className="ss-card ss-accent-top" style={accent(e.color)}>
                  <span aria-hidden="true" className="ss-icon">{e.icon}</span>
                  <strong className="ss-card-title">{e.stream}</strong>
                  <span className="ss-card-text">{e.what}</span>
                  <span className="ss-meta">{e.who}</span>
                  {e.narrative && <span className="ss-quote">{e.narrative}</span>}
                </li>
              ))}
            </ul>

            <h3 className="ss-h3">Influence forces</h3>
            <ul className="ss-grid">
              {(isData.INFLUENCE_FORCES || INFLUENCE_FORCES).map((f) => (
                <li key={f.force} className="ss-card ss-accent-top" style={accent(f.color)}>
                  <span aria-hidden="true" className="ss-icon">{f.icon}</span>
                  <strong className="ss-card-title">{f.force}</strong>
                  <span className="ss-card-text">{f.definition}</span>
                  <span className="ss-built"><span className="ss-label">Built by</span> {f.built}</span>
                  <span className="ss-destroyed"><span className="ss-label">Destroyed by</span> {f.destroys}</span>
                </li>
              ))}
            </ul>

            <h3 className="ss-h3">Legacy signals</h3>
            <ul className="ss-list">
              {(isData.LEGACY_SIGNALS || LEGACY_SIGNALS).map((l) => (
                <li key={l.signal} className="ss-row ss-accent-left" style={accent(l.color)}>
                  <strong className="ss-card-title"><span aria-hidden="true">{l.icon}</span> {l.signal}</strong>
                  <span className="ss-card-text">{l.looksLike}</span>
                  {l.story && <span className="ss-quote">{l.story}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TRENDS */}
        {tab === 'trends' && (
          <div className="ss-panel">
            <h3 className="ss-h3">Fashion trend engine · 5 stages</h3>
            <Stages items={isData.FASHION_TREND_STAGES || FASHION_TREND_STAGES} meta={(s) => s.who} />
            <h3 className="ss-h3">Beauty trend engine · 4 stages</h3>
            <Stages items={isData.BEAUTY_TREND_STAGES || BEAUTY_TREND_STAGES} meta={(s) => s.where} />

            <h3 className="ss-h3">Momentum waves</h3>
            <ul className="ss-list">
              {(isData.MOMENTUM_WAVES || MOMENTUM_WAVES).map((m) => (
                <li key={m.event} className="ss-row ss-accent-left" style={accent(m.color)}>
                  <span className="ss-card-top"><strong><span aria-hidden="true">{m.icon}</span> {m.event}</strong><span className="ss-meta">{m.duration}</span></span>
                  <span className="ss-card-text">{m.feedEffect}</span>
                  {m.permanent && <span className="ss-quote">{m.permanent}</span>}
                </li>
              ))}
            </ul>

            <h3 className="ss-h3">Algorithm &amp; drama</h3>
            <div className="ss-two">
              <div>
                <span className="ss-label">Algorithm forces</span>
                <ul className="ss-list">
                  {(ccData.ALGORITHM_FORCES || ALGORITHM_FORCES).map((f) => (
                    <li key={f.name} className="ss-row ss-accent-left" style={accent(f.color)}>
                      <strong><span aria-hidden="true">{f.icon}</span> {f.name}</strong>
                      <span className="ss-meta">{f.measuredBy}</span>
                      {f.storyHook && <span className="ss-quote">{f.storyHook}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="ss-label">Drama mechanics</span>
                <ul className="ss-list">
                  {(ccData.DRAMA_MECHANICS || DRAMA_MECHANICS).map((d) => (
                    <li key={d.type} className="ss-row ss-accent-left" style={accent(d.color)}>
                      <strong><span aria-hidden="true">{d.icon}</span> {d.type}</strong>
                      <span className="ss-meta">{d.trigger}</span>
                      {d.storyThread && <span className="ss-quote">{d.storyThread}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {editItem && <EditItemModal item={editItem.item} title={`Edit ${editItem.key}`} onSave={(updated) => { if (editItem.index === -1) isAdd(editItem.key, updated); else isUpdate(editItem.key, editItem.index, updated); setEditItem(null); }} onCancel={() => setEditItem(null)} />}
    </div>
    </PageEditContext.Provider>
  );
}
