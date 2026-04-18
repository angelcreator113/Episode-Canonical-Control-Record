/**
 * AIAssistantPanel — a docked panel inside the Phone Hub for show-aware AI commands.
 *
 * Philosophy: AI is an editing accelerator, not a separate mode. This panel lives
 * alongside the phone and its editor, never replaces them. Commands are SCOPED:
 *   - show-level: operates on the whole phone system
 *   - screen-level: acts on the currently selected screen
 *   - zone-level: acts on a selected zone (tap or content zone)
 *
 * All commands follow propose → review → confirm. Propose returns JSON; a review
 * surface (either inline or a modal like AIProposalReview) shows the diff; approve
 * merges + saves via the existing validated routes.
 *
 * PR3 ships a minimal command set:
 *   - screen-level "Add zones to this screen" → POST /ai/add-zones
 *   - zone-level (content) "Fill content zone"  → POST /ai/fill-content-zone
 * More commands land as separate small PRs (generate-screen, generate-messages,
 * propose-navigation, generate-mission).
 */
import React, { useState } from 'react';
import { Sparkles, Loader, ChevronDown, ChevronUp, Zap } from 'lucide-react';

const TOKENS = { parchment: '#FAF7F0', gold: '#B8962E', ink: '#2C2C2C' };
const MONO = "'DM Mono', monospace";

export default function AIAssistantPanel({
  scope,              // 'show' | 'screen' | 'zone-tap' | 'zone-content' — decides which commands render
  scopeLabel,         // friendly label shown in the panel header (e.g. "Screen: Messages")
  activeScreen,       // the overlay currently focused, if any
  onRunAddZones,      // () => Promise<{proposal, context_summary}>  — screen scope
  onRunFillContent,   // () => Promise<{proposal, context_summary}>  — zone-content scope
  busy = false,
  className,
}) {
  const [expanded, setExpanded] = useState(true);
  const [hint, setHint] = useState('');

  const commands = getCommandsForScope(scope);

  const run = async (handler) => {
    if (!handler || busy) return;
    // Caller hits the server and decides how to surface the proposal
    // (inline preview, AIProposalReview modal, etc.).
    await handler(hint.trim() || undefined);
    setHint('');
  };

  return (
    <div className={className} style={{
      border: `1px solid ${TOKENS.gold}40`,
      borderRadius: 12,
      background: TOKENS.parchment,
      padding: expanded ? '12px 14px 14px' : '10px 14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      fontFamily: MONO,
    }}>
      {/* Header — click to collapse. Scope chip on the right. */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
      >
        <Sparkles size={16} color={TOKENS.gold} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.ink, fontFamily: "'Lora', serif" }}>
            AI Assistant
          </div>
          {scopeLabel && (
            <div style={{ fontSize: 9, color: '#8a7e65', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scopeLabel}
            </div>
          )}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: TOKENS.gold, background: `${TOKENS.gold}15`, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
          {scope.replace('-', ' ')}
        </span>
        {expanded ? <ChevronUp size={14} color="#8a7e65" /> : <ChevronDown size={14} color="#8a7e65" />}
      </div>

      {expanded && (
        <>
          {/* Prompt hint — optional free-text field for the creator to steer the AI */}
          <input
            value={hint}
            onChange={e => setHint(e.target.value)}
            placeholder="Optional hint (e.g. 'messy ex-boyfriend texts')"
            disabled={busy}
            style={{
              width: '100%', marginTop: 10,
              padding: '8px 10px', fontSize: 12,
              border: `1px solid ${TOKENS.gold}30`, borderRadius: 6,
              background: '#fff', color: TOKENS.ink,
              fontFamily: "'Lora', serif",
            }}
          />

          {/* Commands for the current scope */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {commands.length === 0 && (
              <div style={{ fontSize: 10, color: '#8a7e65', padding: '6px 2px' }}>
                No commands for this scope yet.
              </div>
            )}
            {commands.map(cmd => {
              const handler = {
                'add-zones': onRunAddZones,
                'fill-content': onRunFillContent,
              }[cmd.key];
              const disabled = !handler || busy;
              return (
                <button
                  key={cmd.key}
                  onClick={() => run(handler)}
                  disabled={disabled}
                  title={cmd.hint}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 12px', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${disabled ? '#e0d9ce' : `${TOKENS.gold}40`}`,
                    borderRadius: 8,
                    background: disabled ? '#faf7f0' : '#fff',
                    color: disabled ? '#aaa' : TOKENS.ink,
                    cursor: disabled ? (busy ? 'wait' : 'not-allowed') : 'pointer',
                    textAlign: 'left', minHeight: 36,
                    fontFamily: MONO,
                    letterSpacing: 0.2,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  {busy ? <Loader size={12} className="spin" /> : <Zap size={12} color={TOKENS.gold} />}
                  <span style={{ flex: 1 }}>{cmd.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Simple scope → command registry. Add new commands here as they land; keep the
// keys stable so UIOverlaysTab / ContentZoneEditor can register handlers.
function getCommandsForScope(scope) {
  switch (scope) {
    case 'screen':
      return [
        { key: 'add-zones', label: 'Propose tap zones for this screen', hint: 'AI scans the screen image + show context and suggests zones with labels, targets, and (where useful) conditions/actions. Review before apply.' },
      ];
    case 'zone-content':
      return [
        { key: 'fill-content', label: 'Fill this content zone with show data', hint: 'AI picks characters + beats that fit this zone type (feed, DMs, profile, etc.) and proposes a config.' },
      ];
    case 'show':
    case 'zone-tap':
    default:
      return [];
  }
}
