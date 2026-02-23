/**
 * ScriptIntelligencePanel.jsx
 * frontend/src/components/ScriptIntelligencePanel.jsx
 *
 * The right intelligence panel for ScriptEditor.jsx.
 * Slides in alongside the existing editor — does not replace anything.
 *
 * Props:
 *   parseResult   — response from POST /api/v1/scripts/parse (the existing Analyze call)
 *   scriptContent — raw script string (for client-side extraction)
 *   episode       — episode object { title, id, show_id, season_number, episode_number }
 *   isOpen        — boolean (controlled by Writing Mode toggle)
 *   onClose       — callback
 *
 * Usage in ScriptEditor.jsx:
 *
 *   import ScriptIntelligencePanel from './ScriptIntelligencePanel';
 *
 *   // Add to state:
 *   const [intelligenceOpen, setIntelligenceOpen] = useState(true);
 *   // parseResult already exists from your handleAnalyze callback
 *
 *   // Add to JSX (alongside existing editor, not replacing it):
 *   <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
 *     <div style={{ flex: 1 }}>{existing editor}</div>
 *     <ScriptIntelligencePanel
 *       parseResult={parseResult}
 *       scriptContent={content}
 *       episode={episode}
 *       isOpen={intelligenceOpen}
 *       onClose={() => setIntelligenceOpen(false)}
 *     />
 *   </div>
 *
 *   // Add Writing Mode toggle button to existing toolbar:
 *   <button onClick={() => setIntelligenceOpen(v => !v)}>
 *     {intelligenceOpen ? 'Writing Mode' : 'Structure Mode'}
 *   </button>
 */

import { useState, useMemo, useCallback } from 'react';

const GOLD   = '#B8963F';
const GOLD_D = 'rgba(168,136,40,0.8)';
const INK    = 'rgba(26,26,46,0.85)';
const DIM    = 'rgba(26,26,46,0.45)';
const FAINT  = 'rgba(26,26,46,0.05)';
const PANEL  = '#FDFCFA';
const EDGE   = 'rgba(26,26,46,0.08)';

// ── Character voice colors ────────────────────────────────────────────────
const CHAR_COLORS = {
  'LALA':                    '#E879F9',
  'JUSTAWOMAN':              GOLD,
  'JUSTAWOMANINHERPRIME':    GOLD,
  'PRIME':                   GOLD,
  'NARRATOR':                GOLD,
  'NARRATOR (JUSTAWOMAN)':   GOLD,
  'GUEST':                   '#60A5FA',
  'default':                 '#94A3B8',
};

function charColor(speaker) {
  if (!speaker) return CHAR_COLORS.default;
  const key = speaker.toUpperCase().replace(/[^A-Z()\s]/g, '').trim();
  return CHAR_COLORS[key] || CHAR_COLORS.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

export default function ScriptIntelligencePanel({
  parseResult,
  scriptContent = '',
  episode,
  isOpen,
  onClose,
}) {
  const [activeTab,       setActiveTab]       = useState('structure');
  const [metadataResult,  setMetadataResult]  = useState(null);
  const [metaLoading,     setMetaLoading]     = useState(false);
  const [metaError,       setMetaError]       = useState(null);

  // ── Client-side derivations ─────────────────────────────────────────────

  // Character dialogue balance — aggregate speaker lines from beats
  const charBalance = useMemo(() => {
    if (!parseResult?.beats) return {};
    const counts = {};
    let total = 0;
    parseResult.beats.forEach(beat => {
      (beat.lines || []).forEach(line => {
        if (line.type === 'dialogue' && line.speaker) {
          const key = line.speaker.toUpperCase();
          counts[key] = (counts[key] || 0) + 1;
          total++;
        }
      });
    });
    // Convert to percentages
    const result = {};
    Object.entries(counts).forEach(([k, v]) => {
      result[k] = { count: v, pct: total > 0 ? Math.round((v / total) * 100) : 0 };
    });
    return result;
  }, [parseResult]);

  // Emotional arc — derive from beat sequence and types
  const emotionalArc = useMemo(() => {
    if (!parseResult?.beats?.length) return null;
    const beats = parseResult.beats;
    const third  = Math.floor(beats.length / 3);
    const start  = beats.slice(0, third);
    const mid    = beats.slice(third, third * 2);
    const end    = beats.slice(third * 2);

    function arcLabel(beatSlice) {
      const types = beatSlice.map(b => b.type);
      if (types.includes('cinematic'))  return 'elevated';
      if (types.some(t => t === 'gameplay' && beatSlice.some(b => b.has_stat_changes))) return 'pressured';
      if (types.includes('narrative'))  return 'reflective';
      return 'building';
    }

    return {
      start: arcLabel(start),
      mid:   arcLabel(mid),
      end:   arcLabel(end),
    };
  }, [parseResult]);

  // Event detection — scan script content
  const eventData = useMemo(() => {
    if (!scriptContent) return null;

    const eventMatch   = scriptContent.match(/\[EVENT:[^\]]+\]/);
    const mailMatches  = [...scriptContent.matchAll(/\[MAIL[^\]]+\]/g)];
    const wardrobeSwap = [...scriptContent.matchAll(/\[WARDROBE_SWAP[^\]]+\]/g)];
    const statEffects  = [...scriptContent.matchAll(/\[STAT_EFFECT[^\]]+\]/g)];
    const locationHint = scriptContent.match(/\[LOCATION_HINT:[^\]]+\]/);

    let eventAttrs = {};
    if (eventMatch) {
      const raw = eventMatch[0];
      const prestige = raw.match(/prestige=(\d+)/)?.[1];
      const name     = raw.match(/name="([^"]+)"/)?.[1];
      const cost     = raw.match(/cost=(\d+)/)?.[1];
      const strict   = raw.match(/strictness=(\d+)/)?.[1];
      const deadline = raw.match(/deadline="([^"]+)"/)?.[1];
      eventAttrs = { name, prestige, cost, strictness: strict, deadline };
    }

    // Detect missing wardrobe on high-prestige event
    const prestige = Number(eventAttrs.prestige || 0);
    const warnings = [];
    if (prestige >= 7 && wardrobeSwap.length === 0) {
      warnings.push('High-prestige event detected but no WARDROBE_SWAP found');
    }
    if (mailMatches.length > 1) {
      warnings.push(`${mailMatches.length} mail events — World Bible max is 1 per type per episode`);
    }

    return {
      event:        eventAttrs,
      hasEvent:     !!eventMatch,
      mailCount:    mailMatches.length,
      wardrobeSwaps: wardrobeSwap.length,
      statEffects:  statEffects.length,
      locationHint: locationHint ? locationHint[0].replace(/\[LOCATION_HINT:\s*"?|"?\]/g, '').trim() : null,
      warnings,
    };
  }, [scriptContent]);

  // Canon warnings — client-side pattern checks
  const canonWarnings = useMemo(() => {
    const warnings = [];
    if (!scriptContent) return warnings;

    const lines = scriptContent.split('\n');
    let voiceActivated = false;

    lines.forEach((line, i) => {
      const trimmed = line.trim();

      // Track VOICE_ACTIVATE
      if (trimmed.includes('[UI:VOICE_ACTIVATE]')) {
        voiceActivated = true;
      }

      // Lala dialogue without VOICE_ACTIVATE
      if (/^Lala:/i.test(trimmed) && !voiceActivated) {
        warnings.push({
          type:    'voice',
          line:    i + 1,
          message: `Line ${i + 1}: Lala dialogue before [UI:VOICE_ACTIVATE]`,
          fix:     'Add [UI:VOICE_ACTIVATE] before this dialogue block',
        });
      }

      // Reset voice on new beat
      if (/^##\s*BEAT:/i.test(trimmed)) voiceActivated = false;
    });

    // Missing login window
    if (!/\[UI:OPEN LoginWindow\]/i.test(scriptContent) &&
        !/LoginWindow/i.test(scriptContent)) {
      warnings.push({
        type:    'structure',
        line:    null,
        message: 'No Login Window detected — expected in OPENING_RITUAL beat',
        fix:     'Add [UI:OPEN LoginWindow] to Opening Ritual beat',
      });
    }

    // Stat change without event context
    const statLines = scriptContent.match(/\[STAT_EFFECT[^\]]+\]/g) || [];
    const eventPresent = /\[EVENT:/i.test(scriptContent);
    if (statLines.length > 0 && !eventPresent) {
      warnings.push({
        type:    'logic',
        line:    null,
        message: `${statLines.length} STAT_EFFECT tag(s) but no [EVENT:] block found`,
        fix:     'Add an [EVENT:] block or verify stat changes are intentional',
      });
    }

    // Lala reacting to UI (she should never do this)
    const lalaUIReaction = scriptContent.match(/Lala:.*\[UI:/gi) || [];
    if (lalaUIReaction.length > 0) {
      warnings.push({
        type:    'canon',
        line:    null,
        message: 'Lala dialogue contains UI tags — Lala never reacts to UI elements',
        fix:     'UI tags belong on their own lines, not inside Lala dialogue',
      });
    }

    // Merge with backend warnings
    (parseResult?.warnings || []).forEach(w => {
      warnings.push({ type: 'parser', line: null, message: w, fix: null });
    });

    return warnings;
  }, [scriptContent, parseResult]);

  // Beat duration estimate (8 seconds per line, rough)
  function estimateDuration(lineCount) {
    const secs = lineCount * 8;
    const m    = Math.floor(secs / 60);
    const s    = secs % 60;
    return m > 0 ? `~${m}m ${s}s` : `~${s}s`;
  }

  // Total runtime
  const totalRuntime = useMemo(() => {
    if (!parseResult?.total_lines) return null;
    const secs = parseResult.total_lines * 8;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }, [parseResult]);

  // ── Metadata generation ────────────────────────────────────────────────

  const generateMetadata = useCallback(async () => {
    if (!scriptContent || metaLoading) return;
    setMetaLoading(true);
    setMetaError(null);
    try {
      const res  = await fetch('/api/v1/memories/script-metadata', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          script_content: scriptContent.slice(0, 3000), // first 3000 chars enough for metadata
          episode_title:  episode?.title,
          beat_count:     parseResult?.beat_count,
          tag_summary:    parseResult?.tag_summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMetadataResult(data);
    } catch (err) {
      setMetaError(err.message);
    } finally {
      setMetaLoading(false);
    }
  }, [scriptContent, episode, parseResult, metaLoading]);

  // ── Panel visibility ──────────────────────────────────────────────────

  if (!isOpen) return null;

  const tabs = [
    { key: 'structure',  label: 'Structure'  },
    { key: 'characters', label: 'Characters' },
    { key: 'events',     label: 'Events'     },
    { key: 'metadata',   label: 'Metadata'   },
    { key: 'canon',      label: 'Canon'      },
  ];

  const warningCount = canonWarnings.length +
    (eventData?.warnings?.length || 0) +
    (parseResult?.beats?.reduce((sum, b) => sum + (b.warnings?.length || 0), 0) || 0);

  return (
    <div style={p.panel}>

      {/* Panel header */}
      <div style={p.header}>
        <div style={p.headerLeft}>
          <div style={p.panelTitle}>NARRATIVE INTELLIGENCE</div>
          {parseResult && (
            <div style={p.parseStatus}>
              {parseResult.beat_count} beats · {parseResult.total_lines} lines
              {totalRuntime && ` · ${totalRuntime}`}
            </div>
          )}
        </div>
        <button style={p.closeBtn} onClick={onClose} type='button' title='Writing Mode'>
          ←
        </button>
      </div>

      {/* Tabs */}
      <div style={p.tabs}>
        {tabs.map(t => (
          <button
            key={t.key}
            style={{
              ...p.tab,
              color:       activeTab === t.key ? GOLD : DIM,
              borderBottom: activeTab === t.key
                ? `2px solid ${GOLD}`
                : '2px solid transparent',
            }}
            onClick={() => setActiveTab(t.key)}
            type='button'
          >
            {t.label}
            {t.key === 'canon' && warningCount > 0 && (
              <span style={p.warnBadge}>{warningCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={p.content}>

        {/* ── STRUCTURE TAB ── */}
        {activeTab === 'structure' && (
          <StructureTab
            parseResult={parseResult}
            emotionalArc={emotionalArc}
            estimateDuration={estimateDuration}
          />
        )}

        {/* ── CHARACTERS TAB ── */}
        {activeTab === 'characters' && (
          <CharactersTab
            charBalance={charBalance}
            emotionalArc={emotionalArc}
            parseResult={parseResult}
          />
        )}

        {/* ── EVENTS TAB ── */}
        {activeTab === 'events' && (
          <EventsTab
            eventData={eventData}
            parseResult={parseResult}
          />
        )}

        {/* ── METADATA TAB ── */}
        {activeTab === 'metadata' && (
          <MetadataTab
            result={metadataResult}
            loading={metaLoading}
            error={metaError}
            onGenerate={generateMetadata}
            episode={episode}
            parseResult={parseResult}
          />
        )}

        {/* ── CANON TAB ── */}
        {activeTab === 'canon' && (
          <CanonTab
            warnings={canonWarnings}
            eventWarnings={eventData?.warnings || []}
            beatWarnings={parseResult?.beats?.flatMap(b =>
              (b.warnings || []).map(w => ({ beat: b.title, message: w }))
            ) || []}
          />
        )}

        {/* Empty state */}
        {!parseResult && activeTab !== 'metadata' && (
          <div style={p.emptyState}>
            <div style={p.emptyGlyph}>◈</div>
            <div style={p.emptyText}>Click Analyze to surface intelligence</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure Tab
// ─────────────────────────────────────────────────────────────────────────────

function StructureTab({ parseResult, emotionalArc, estimateDuration }) {
  if (!parseResult) return <EmptyState />;

  const beats = parseResult.beats || [];

  return (
    <div style={t.wrap}>

      {/* Arc summary */}
      {emotionalArc && (
        <Section title='EMOTIONAL ARC'>
          <div style={t.arcRow}>
            <ArcPoint label='Opens' value={emotionalArc.start} />
            <div style={t.arcLine} />
            <ArcPoint label='Mid' value={emotionalArc.mid} />
            <div style={t.arcLine} />
            <ArcPoint label='Closes' value={emotionalArc.end} />
          </div>
        </Section>
      )}

      {/* Beat list */}
      <Section title={`DETECTED BEATS (${beats.length})`}>
        {beats.map((beat, i) => (
          <BeatRow
            key={beat.id || i}
            beat={beat}
            index={i}
            duration={estimateDuration(beat.line_count || 0)}
          />
        ))}
      </Section>

      {/* Tag summary */}
      {parseResult.tag_summary && (
        <Section title='TAG DENSITY'>
          <div style={t.tagGrid}>
            <TagStat label='UI Actions'    value={parseResult.tag_summary.ui_actions}    color='#60A5FA' />
            <TagStat label='Stat Changes'  value={parseResult.tag_summary.stat_changes}  color='#34D399' />
            <TagStat label='Mail Events'   value={parseResult.tag_summary.mail_events}   color='#F472B6' />
            <TagStat label='Dialogue'      value={parseResult.tag_summary.dialogue_lines} color={GOLD}   />
            <TagStat label='Actions'       value={parseResult.tag_summary.action_lines}  color='#94A3B8' />
          </div>
        </Section>
      )}
    </div>
  );
}

function BeatRow({ beat, index, duration }) {
  const [expanded, setExpanded] = useState(false);
  const hasWarnings = beat.warnings?.length > 0;

  const typeColors = {
    gameplay:  '#60A5FA',
    narrative: GOLD,
    cinematic: '#A78BFA',
  };

  return (
    <div style={{
      ...t.beatRow,
      borderLeft: `2px solid ${typeColors[beat.type] || '#94A3B8'}`,
      background: hasWarnings ? 'rgba(251,191,36,0.04)' : FAINT,
    }}>
      <div
        style={t.beatRowHeader}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={t.beatNum}>{String(index + 1).padStart(2, '0')}</div>
        <div style={t.beatTitle}>{beat.title}</div>
        <div style={t.beatMeta}>
          <span style={{ ...t.beatType, color: typeColors[beat.type] || '#94A3B8' }}>
            {beat.type}
          </span>
          <span style={t.beatDuration}>{duration}</span>
          {hasWarnings && <span style={t.warnFlag}>⚠</span>}
          <span style={t.expandChevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={t.beatDetail}>
          <div style={t.beatStats}>
            <span>{beat.line_count} lines</span>
            {beat.has_ui_actions  && <span style={{ color: '#60A5FA' }}>UI</span>}
            {beat.has_stat_changes && <span style={{ color: '#34D399' }}>STAT</span>}
            {beat.has_mail         && <span style={{ color: '#F472B6' }}>MAIL</span>}
          </div>
          {beat.warnings?.map((w, i) => (
            <div key={i} style={t.beatWarning}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Characters Tab
// ─────────────────────────────────────────────────────────────────────────────

function CharactersTab({ charBalance, emotionalArc, parseResult }) {
  const entries = Object.entries(charBalance).sort((a, b) => b[1].count - a[1].count);

  if (entries.length === 0) return (
    <div style={t.wrap}>
      <EmptyState message='No dialogue detected. Analyze the script first.' />
    </div>
  );

  return (
    <div style={t.wrap}>
      <Section title='DIALOGUE BALANCE'>
        {entries.map(([speaker, data]) => (
          <div key={speaker} style={t.charRow}>
            <div style={t.charName}>
              <div style={{
                ...t.charDot,
                background: charColor(speaker),
              }} />
              <span style={{ color: charColor(speaker) }}>{speaker}</span>
            </div>
            <div style={t.charBar}>
              <div style={{
                ...t.charBarFill,
                width:      `${data.pct}%`,
                background: charColor(speaker),
              }} />
            </div>
            <div style={t.charPct}>{data.pct}%</div>
            <div style={t.charCount}>{data.count}L</div>
          </div>
        ))}
      </Section>

      {emotionalArc && (
        <Section title='EMOTIONAL ARC'>
          <div style={t.arcProse}>
            <ArcProse label='Opens' value={emotionalArc.start} />
            <ArcProse label='Mid'   value={emotionalArc.mid}   />
            <ArcProse label='Closes' value={emotionalArc.end}  />
          </div>
        </Section>
      )}

      {/* Speaking time breakdown */}
      {parseResult?.tag_summary && (
        <Section title='SCRIPT COMPOSITION'>
          <div style={t.compRow}>
            <CompStat
              label='Dialogue'
              value={parseResult.tag_summary.dialogue_lines}
              total={parseResult.total_lines}
              color={GOLD}
            />
            <CompStat
              label='Action / Tags'
              value={parseResult.tag_summary.action_lines}
              total={parseResult.total_lines}
              color='#94A3B8'
            />
          </div>
        </Section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Events Tab
// ─────────────────────────────────────────────────────────────────────────────

function EventsTab({ eventData, parseResult }) {
  if (!eventData) return (
    <div style={t.wrap}><EmptyState message='Analyze the script to surface event data.' /></div>
  );

  return (
    <div style={t.wrap}>

      {/* Event block */}
      {eventData.hasEvent ? (
        <Section title='DETECTED EVENT'>
          {eventData.event.name && (
            <MetaLine label='Name'       value={eventData.event.name} highlight />
          )}
          {eventData.event.prestige && (
            <MetaLine label='Prestige'   value={`${eventData.event.prestige} / 10`} />
          )}
          {eventData.event.cost && (
            <MetaLine label='Cost'       value={`${eventData.event.cost} coins`} />
          )}
          {eventData.event.strictness && (
            <MetaLine label='Strictness' value={`${eventData.event.strictness} / 10`} />
          )}
          {eventData.event.deadline && (
            <MetaLine label='Deadline'   value={eventData.event.deadline} />
          )}
        </Section>
      ) : (
        <Section title='DETECTED EVENT'>
          <div style={t.noEvent}>No [EVENT:] tag detected in script.</div>
        </Section>
      )}

      {/* Location */}
      {eventData.locationHint && (
        <Section title='LOCATION HINT'>
          <div style={t.locationText}>"{eventData.locationHint}"</div>
        </Section>
      )}

      {/* Deliverables */}
      <Section title='SCRIPT ELEMENTS'>
        <MetaLine label='Mail Events'    value={eventData.mailCount}    />
        <MetaLine label='Wardrobe Swaps' value={eventData.wardrobeSwaps} />
        <MetaLine label='Stat Effects'   value={eventData.statEffects}   />
      </Section>

      {/* Event warnings */}
      {eventData.warnings?.length > 0 && (
        <Section title='EVENT WARNINGS'>
          {eventData.warnings.map((w, i) => (
            <WarningRow key={i} message={w} type='warn' />
          ))}
        </Section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Tab
// ─────────────────────────────────────────────────────────────────────────────

function MetadataTab({ result, loading, error, onGenerate, episode, parseResult }) {
  return (
    <div style={t.wrap}>
      <Section title='EPISODE METADATA'>
        <div style={t.metaIntro}>
          Generate title suggestions, description, tone summary, and keywords from the script content.
        </div>
        <button
          style={{
            ...t.generateBtn,
            opacity: loading ? 0.6 : 1,
            cursor:  loading ? 'not-allowed' : 'pointer',
          }}
          onClick={onGenerate}
          disabled={loading}
          type='button'
        >
          {loading ? '◌ Generating…' : '✦ Generate Metadata'}
        </button>
        {error && <div style={t.errorText}>{error}</div>}
      </Section>

      {result && (
        <>
          {result.title_suggestions?.length > 0 && (
            <Section title='TITLE SUGGESTIONS'>
              {result.title_suggestions.map((title, i) => (
                <div key={i} style={t.titleSuggestion}>
                  <span style={t.titleNum}>{i + 1}</span>
                  <span style={t.titleText}>{title}</span>
                </div>
              ))}
            </Section>
          )}

          {result.description && (
            <Section title='DESCRIPTION'>
              <div style={t.descriptionText}>{result.description}</div>
            </Section>
          )}

          {result.tone_summary && (
            <Section title='TONE'>
              <div style={t.toneText}>{result.tone_summary}</div>
            </Section>
          )}

          {result.keywords?.length > 0 && (
            <Section title='KEYWORDS'>
              <div style={t.keywordWrap}>
                {result.keywords.map((kw, i) => (
                  <span key={i} style={t.keyword}>{kw}</span>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Canon Tab
// ─────────────────────────────────────────────────────────────────────────────

function CanonTab({ warnings, eventWarnings, beatWarnings }) {
  const allWarnings = [
    ...warnings.map(w => ({ ...w, source: 'script' })),
    ...eventWarnings.map(w => ({ type: 'event', message: w, fix: null, source: 'event' })),
    ...beatWarnings.map(w => ({ type: 'beat', message: `${w.beat}: ${w.message}`, fix: null, source: 'beat' })),
  ];

  const typeOrder = { voice: 0, canon: 1, structure: 2, logic: 3, event: 4, beat: 5, parser: 6 };
  allWarnings.sort((a, b) => (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9));

  return (
    <div style={t.wrap}>
      <Section title={`CANON & STRUCTURE CHECKS (${allWarnings.length})`}>
        {allWarnings.length === 0 ? (
          <div style={t.clean}>
            <span style={{ color: '#34D399' }}>✓</span> No warnings detected
          </div>
        ) : (
          allWarnings.map((w, i) => (
            <CanonWarning key={i} warning={w} />
          ))
        )}
      </Section>

      <Section title='RULES CHECKED'>
        <RuleRow rule='Lala speaks only after VOICE_ACTIVATE' />
        <RuleRow rule='Login Window present in Opening Ritual' />
        <RuleRow rule='Stat effects tied to event context' />
        <RuleRow rule='Lala never reacts to UI elements' />
        <RuleRow rule='Max 1 mail per type per episode' />
        <RuleRow rule='High-prestige events include wardrobe swap' />
      </Section>
    </div>
  );
}

function CanonWarning({ warning }) {
  const typeColors = {
    voice:    '#FBBF24',
    canon:    '#F87171',
    structure: '#FBBF24',
    logic:    '#FBBF24',
    event:    '#FBBF24',
    beat:     '#94A3B8',
    parser:   '#94A3B8',
  };
  const color = typeColors[warning.type] || '#94A3B8';

  return (
    <div style={{ ...t.canonWarn, borderLeftColor: color }}>
      <div style={{ ...t.canonWarnType, color }}>{warning.type?.toUpperCase()}</div>
      <div style={t.canonWarnMsg}>{warning.message}</div>
      {warning.fix && (
        <div style={t.canonWarnFix}>→ {warning.fix}</div>
      )}
    </div>
  );
}

function RuleRow({ rule }) {
  return (
    <div style={t.ruleRow}>
      <span style={{ color: '#34D399', fontSize: 9 }}>✓</span>
      <span style={t.ruleText}>{rule}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={sc.section}>
      <div style={sc.sectionTitle}>{title}</div>
      <div style={sc.sectionBody}>{children}</div>
    </div>
  );
}

function ArcPoint({ label, value }) {
  return (
    <div style={sc.arcPoint}>
      <div style={sc.arcLabel}>{label}</div>
      <div style={sc.arcValue}>{value}</div>
    </div>
  );
}

function ArcProse({ label, value }) {
  return (
    <div style={sc.arcProse}>
      <span style={sc.arcProseLabel}>{label}:</span>
      <span style={{ color: GOLD_D, fontStyle: 'italic' }}>{value}</span>
    </div>
  );
}

function TagStat({ label, value, color }) {
  return (
    <div style={sc.tagStat}>
      <div style={{ ...sc.tagDot, background: color }} />
      <div style={sc.tagLabel}>{label}</div>
      <div style={{ ...sc.tagValue, color }}>{value || 0}</div>
    </div>
  );
}

function CompStat({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={sc.compStat}>
      <div style={sc.compLabel}>{label}</div>
      <div style={sc.compBar}>
        <div style={{ ...sc.compBarFill, width: `${pct}%`, background: color }} />
      </div>
      <div style={{ ...sc.compPct, color }}>{pct}%</div>
    </div>
  );
}

function MetaLine({ label, value, highlight }) {
  return (
    <div style={sc.metaLine}>
      <div style={sc.metaLabel}>{label}</div>
      <div style={{ ...sc.metaValue, color: highlight ? GOLD : INK }}>{value}</div>
    </div>
  );
}

function WarningRow({ message, type }) {
  return (
    <div style={sc.warnRow}>
      <span style={{ color: '#FBBF24' }}>⚠</span>
      <span style={sc.warnText}>{message}</span>
    </div>
  );
}

function EmptyState({ message = 'Analyze the script to surface intelligence' }) {
  return (
    <div style={sc.empty}>
      <div style={sc.emptyGlyph}>◈</div>
      <div style={sc.emptyText}>{message}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const p = {
  panel: {
    width:         300,
    flexShrink:    0,
    borderLeft:    `1px solid ${EDGE}`,
    background:    PANEL,
    display:       'flex',
    flexDirection: 'column',
    overflow:      'hidden',
    fontFamily:    'DM Mono, monospace',
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    padding:        '12px 14px 10px',
    borderBottom:   `1px solid ${EDGE}`,
    flexShrink:     0,
  },
  headerLeft:   { display: 'flex', flexDirection: 'column', gap: 3 },
  panelTitle:   { fontSize: 8, letterSpacing: '0.22em', color: GOLD, fontWeight: 600 },
  parseStatus:  { fontSize: 7, color: DIM, letterSpacing: '0.06em' },
  closeBtn: {
    background:  'none', border: 'none',
    color:       DIM, fontSize: 14, cursor: 'pointer',
    padding:     0, lineHeight: 1,
    title:       'Writing Mode',
  },
  tabs: {
    display:      'flex',
    borderBottom: `1px solid ${EDGE}`,
    flexShrink:   0,
    overflowX:    'auto',
  },
  tab: {
    flex:          1,
    background:    'none',
    border:        'none',
    borderBottom:  '2px solid transparent',
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    letterSpacing: '0.1em',
    padding:       '8px 4px',
    cursor:        'pointer',
    transition:    'color 0.12s',
    position:      'relative',
    whiteSpace:    'nowrap',
  },
  warnBadge: {
    position:   'absolute',
    top:        4, right: 2,
    background: '#FBBF24',
    color:      '#111',
    fontSize:   6,
    fontWeight: 700,
    borderRadius: 8,
    padding:    '1px 4px',
    lineHeight: 1.2,
  },
  content: {
    flex:      1,
    overflowY: 'auto',
  },
  emptyState: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    height:         200,
    padding:        20,
  },
  emptyGlyph: { fontSize: 24, color: FAINT },
  emptyText:  { fontSize: 9, color: DIM, textAlign: 'center', lineHeight: 1.5 },
};

const t = {
  wrap:  { padding: '8px 0', display: 'flex', flexDirection: 'column' },
  arcRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         0,
    padding:     '4px 0',
  },
  arcLine: {
    flex:       1,
    height:     1,
    background: `${GOLD}25`,
    margin:     '0 4px',
  },
  beatRow: {
    borderLeft:   '2px solid',
    borderRadius: '0 3px 3px 0',
    marginBottom: 4,
    overflow:     'hidden',
  },
  beatRowHeader: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    padding:    '6px 8px',
    cursor:     'pointer',
  },
  beatNum: {
    fontSize:      7,
    letterSpacing: '0.14em',
    color:         GOLD_D,
    flexShrink:    0,
    width:         16,
  },
  beatTitle: { fontSize: 9, color: INK, flex: 1, letterSpacing: '0.02em' },
  beatMeta: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 },
  beatType: { fontSize: 7, letterSpacing: '0.08em' },
  beatDuration: { fontSize: 7, color: DIM },
  warnFlag: { color: '#FBBF24', fontSize: 9 },
  expandChevron: { fontSize: 7, color: DIM },
  beatDetail: {
    padding:    '4px 8px 8px 30px',
    background: 'rgba(26,26,46,0.03)',
  },
  beatStats: {
    display:    'flex',
    gap:        8,
    fontSize:   7,
    color:      DIM,
    marginBottom: 4,
  },
  beatWarning: {
    fontSize:   8,
    color:      '#FBBF24',
    lineHeight: 1.5,
    padding:    '2px 0',
  },
  tagGrid: {
    display:             'grid',
    gridTemplateColumns: '1fr 1fr',
    gap:                 4,
  },
  charRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
    padding:    '5px 0',
    borderBottom: `1px solid ${FAINT}`,
  },
  charName: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    width:      120,
    flexShrink: 0,
    fontSize:   8,
    letterSpacing: '0.04em',
    overflow:   'hidden',
  },
  charDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  charBar: {
    flex:       1,
    height:     4,
    background: FAINT,
    borderRadius: 2,
    overflow:   'hidden',
  },
  charBarFill: {
    height:       '100%',
    borderRadius: 2,
    transition:   'width 0.3s ease',
    opacity:      0.7,
  },
  charPct:   { fontSize: 8, color: DIM, width: 28, textAlign: 'right', flexShrink: 0 },
  charCount: { fontSize: 7, color: FAINT, width: 24, textAlign: 'right', flexShrink: 0 },
  arcProse:  { padding: '4px 0', borderBottom: `1px solid ${FAINT}` },
  compRow:   { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' },
  noEvent: {
    fontSize:   9,
    color:      DIM,
    fontStyle:  'italic',
    padding:    '4px 0',
  },
  locationText: {
    fontSize:   9,
    color:      GOLD_D,
    fontStyle:  'italic',
    lineHeight: 1.5,
  },
  metaIntro: {
    fontSize:   8,
    color:      DIM,
    lineHeight: 1.6,
    marginBottom: 10,
  },
  generateBtn: {
    width:         '100%',
    background:    `${GOLD}12`,
    border:        `1px solid ${GOLD}30`,
    borderRadius:  3,
    fontFamily:    'DM Mono, monospace',
    fontSize:      9,
    letterSpacing: '0.14em',
    color:         GOLD,
    padding:       '9px 0',
    cursor:        'pointer',
    marginBottom:  12,
  },
  errorText: {
    fontSize: 8, color: '#F87171', lineHeight: 1.5,
  },
  titleSuggestion: {
    display:    'flex',
    gap:        8,
    padding:    '6px 0',
    borderBottom: `1px solid ${FAINT}`,
  },
  titleNum: {
    fontSize:   8,
    color:      GOLD_D,
    flexShrink: 0,
    width:      12,
  },
  titleText: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize:   13,
    fontStyle:  'italic',
    color:      INK,
    lineHeight: 1.4,
  },
  descriptionText: {
    fontSize:   9,
    color:      'rgba(26,26,46,0.55)',
    lineHeight: 1.7,
    fontStyle:  'italic',
  },
  toneText: {
    fontSize:   9,
    color:      GOLD_D,
    lineHeight: 1.6,
  },
  keywordWrap: {
    display:  'flex',
    flexWrap: 'wrap',
    gap:      5,
    padding:  '4px 0',
  },
  keyword: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    color:         GOLD_D,
    background:    `${GOLD}10`,
    border:        `1px solid ${GOLD}20`,
    borderRadius:  2,
    padding:       '2px 7px',
    letterSpacing: '0.06em',
  },
  canonWarn: {
    borderLeft:   '2px solid',
    borderRadius: '0 3px 3px 0',
    padding:      '7px 8px',
    marginBottom: 5,
    background:   FAINT,
  },
  canonWarnType: {
    fontSize:      6,
    letterSpacing: '0.16em',
    marginBottom:  3,
    fontWeight:    700,
  },
  canonWarnMsg: {
    fontSize:   8,
    color:      'rgba(26,26,46,0.6)',
    lineHeight: 1.5,
  },
  canonWarnFix: {
    fontSize:   7,
    color:      '#34D399',
    marginTop:  4,
    lineHeight: 1.4,
  },
  ruleRow: {
    display:      'flex',
    gap:          7,
    alignItems:   'center',
    padding:      '5px 0',
    borderBottom: `1px solid ${FAINT}`,
  },
  ruleText: { fontSize: 8, color: DIM, letterSpacing: '0.03em' },
  clean: {
    fontSize:   9,
    color:      DIM,
    padding:    '8px 0',
    display:    'flex',
    gap:        7,
    alignItems: 'center',
  },
};

const sc = {
  section: {
    padding:      '12px 14px',
    borderBottom: `1px solid ${EDGE}`,
  },
  sectionTitle: {
    fontSize:      7,
    letterSpacing: '0.2em',
    color:         'rgba(26,26,46,0.3)',
    marginBottom:  10,
  },
  sectionBody:  {},
  arcPoint: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           3,
    flex:          1,
  },
  arcLabel: { fontSize: 7, color: DIM, letterSpacing: '0.1em' },
  arcValue: { fontSize: 9, color: GOLD_D, fontStyle: 'italic' },
  arcProse: { display: 'flex', gap: 6, padding: '4px 0', borderBottom: `1px solid ${FAINT}` },
  arcProseLabel: { fontSize: 8, color: DIM, width: 40, flexShrink: 0 },
  tagStat: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '5px 0',
    borderBottom: `1px solid ${FAINT}`,
  },
  tagDot:   { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  tagLabel: { fontSize: 8, color: DIM, flex: 1 },
  tagValue: { fontSize: 9, fontWeight: 600 },
  compStat: { display: 'flex', alignItems: 'center', gap: 8 },
  compLabel: { fontSize: 7, color: DIM, width: 80, flexShrink: 0 },
  compBar: {
    flex:         1,
    height:       4,
    background:   FAINT,
    borderRadius: 2,
    overflow:     'hidden',
  },
  compBarFill: { height: '100%', borderRadius: 2, opacity: 0.7 },
  compPct:     { fontSize: 8, width: 28, textAlign: 'right', flexShrink: 0 },
  metaLine: {
    display:      'flex',
    gap:          8,
    padding:      '5px 0',
    borderBottom: `1px solid ${FAINT}`,
    alignItems:   'baseline',
  },
  metaLabel: {
    fontSize:      7,
    letterSpacing: '0.12em',
    color:         DIM,
    width:         80,
    flexShrink:    0,
  },
  metaValue: { fontSize: 9 },
  warnRow: {
    display:    'flex',
    gap:        7,
    padding:    '5px 0',
    alignItems: 'flex-start',
    borderBottom: `1px solid ${FAINT}`,
  },
  warnText: { fontSize: 8, color: 'rgba(26,26,46,0.55)', lineHeight: 1.5 },
  empty: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    padding:        '24px 16px',
    textAlign:      'center',
  },
  emptyGlyph: { fontSize: 20, color: FAINT },
  emptyText:  { fontSize: 8, color: DIM, lineHeight: 1.6 },
};
