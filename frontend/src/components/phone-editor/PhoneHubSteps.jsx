/**
 * PhoneHubSteps — guided 4-step progress header for the Overlays tab.
 *
 * Sits above the phone+grid and tells the creator, at a glance, WHAT STAGE they
 * are at and WHAT TO DO NEXT. The phone/grid below is still the workspace; the
 * steps just answer "what am I looking at."
 *
 *   1. Screens    — upload/generate phone screens
 *   2. Zones      — draw tap zones on each screen
 *   3. Missions   — author missions that watch state
 *   4. Play       — test the full phone
 *
 * Each step card shows:
 *   - number (1–4)
 *   - title + one-line what-this-means
 *   - status ("3 of 12 generated", "0 missions", etc.)
 *   - primary action button (or a "you're here" badge if current)
 *
 * State is derived: "current step" = first step with incomplete criteria.
 */
import React from 'react';
import { Check, ChevronRight, Sparkles, MapPin, Target, Play } from 'lucide-react';

const TOKENS = { parchment: '#FAF7F0', parchmentDeep: '#F6F0E4', gold: '#B8962E', goldSoft: '#d4b96a', ink: '#2C2C2C', muted: '#8a7e65' };
const MONO = "'DM Mono', monospace";
const PROSE = "'Lora', serif";

export default function PhoneHubSteps({
  // Derived counts supplied by the parent (already filtered to non-icon screens).
  screensGenerated = 0,
  screensTotal = 0,
  screensWithZones = 0,
  missionCount = 0,
  // Handlers wired to existing UIOverlaysTab functions.
  onGenerateAll,
  onOpenMissions,
  onOpenPreview,
  isGenerating = false,
}) {
  // Determine which step is "current" — the first one with work still to do.
  // Step 1 done when every planned screen has an image. Step 2 done when every
  // generated screen has at least one zone. Step 3 is optional but prompts once
  // zones exist. Step 4 is always available once step 1 is done.
  const step1Done = screensTotal > 0 && screensGenerated === screensTotal;
  const step2Done = screensGenerated > 0 && screensWithZones === screensGenerated;
  const step3Done = missionCount > 0;
  const step4Ready = screensGenerated > 0;

  const current =
    !step1Done ? 1 :
    !step2Done ? 2 :
    !step3Done ? 3 :
    4;

  const steps = [
    {
      n: 1,
      icon: Sparkles,
      title: 'Screens',
      subtitle: 'Generate or upload the phone screens.',
      status: screensTotal === 0
        ? 'No screens yet'
        : `${screensGenerated} of ${screensTotal} ready`,
      done: step1Done,
      action: screensTotal === 0
        ? null
        : { label: isGenerating ? 'Generating…' : 'Generate all', onClick: onGenerateAll, disabled: isGenerating || step1Done },
    },
    {
      n: 2,
      icon: MapPin,
      title: 'Zones',
      subtitle: 'Draw tap zones so screens link together.',
      status: screensGenerated === 0
        ? 'Waiting on screens'
        : `${screensWithZones} of ${screensGenerated} screens have zones`,
      done: step2Done,
      // No direct "open zone editor" button — opening a zone editor requires
      // picking a screen. The card directs you to do that.
      hint: screensGenerated > 0 && !step2Done ? 'Click a screen below to edit its zones' : null,
    },
    {
      n: 3,
      icon: Target,
      title: 'Missions',
      subtitle: 'Watch state, report progress, fire rewards.',
      status: missionCount === 0 ? 'None yet (optional)' : `${missionCount} defined`,
      done: step3Done,
      action: { label: 'Open missions', onClick: onOpenMissions, disabled: false },
    },
    {
      n: 4,
      icon: Play,
      title: 'Play',
      subtitle: 'Walk through the whole phone.',
      status: step4Ready ? 'Ready to test' : 'Needs at least one screen',
      done: false,  // never "done" — it's an action, not a checklist item
      action: { label: 'Test it', onClick: onOpenPreview, disabled: !step4Ready },
    },
  ];

  return (
    <div style={{
      background: `linear-gradient(135deg, ${TOKENS.parchment} 0%, ${TOKENS.parchmentDeep} 100%)`,
      border: `1px solid ${TOKENS.gold}25`,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      boxShadow: '0 2px 10px rgba(184,150,46,0.05)',
    }}>
      <div style={{ fontFamily: PROSE, fontSize: 18, fontWeight: 700, color: TOKENS.ink, marginBottom: 4 }}>
        Lala's Phone — build it in four steps
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.muted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 14 }}>
        You are on <span style={{ color: TOKENS.gold, fontWeight: 700 }}>step {current}</span>
      </div>

      <div className="phone-hub-steps-grid">
        {steps.map(s => (
          <StepCard key={s.n} step={s} isCurrent={s.n === current} />
        ))}
      </div>

      <style>{`
        .phone-hub-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        @media (max-width: 900px) {
          .phone-hub-steps-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 500px) {
          .phone-hub-steps-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function StepCard({ step, isCurrent }) {
  const { n, icon: Icon, title, subtitle, status, done, action, hint } = step;

  // Visual states: done (soft gold), current (bright gold), pending (neutral).
  const borderColor = done ? `${TOKENS.goldSoft}` : isCurrent ? TOKENS.gold : '#e8e0d0';
  const bg = done ? `${TOKENS.gold}0C` : isCurrent ? `${TOKENS.gold}10` : '#fff';
  const badgeBg = done ? TOKENS.gold : isCurrent ? TOKENS.gold : '#ccc';
  const badgeText = done ? '#fff' : isCurrent ? '#fff' : '#fff';

  return (
    <div style={{
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 130,
      position: 'relative',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 12,
          background: badgeBg, color: badgeText,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, fontFamily: MONO,
          flexShrink: 0,
        }}>
          {done ? <Check size={13} strokeWidth={3} /> : n}
        </div>
        <div style={{ fontFamily: PROSE, fontSize: 15, fontWeight: 700, color: TOKENS.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <Icon size={14} color={done ? TOKENS.gold : isCurrent ? TOKENS.gold : '#aaa'} />
      </div>

      <div style={{ fontSize: 11, color: TOKENS.muted, lineHeight: 1.4, marginBottom: 10, fontFamily: PROSE, flex: 1 }}>
        {subtitle}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, color: done ? TOKENS.gold : TOKENS.muted, letterSpacing: 0.3, marginBottom: hint || action ? 8 : 0 }}>
        {done ? '✓ ' : ''}{status}
      </div>

      {hint && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.gold, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={10} /> {hint}
        </div>
      )}

      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          style={{
            marginTop: 'auto',
            padding: '7px 12px',
            fontSize: 12, fontWeight: 700,
            border: 'none', borderRadius: 7,
            background: action.disabled ? '#e8e0d0' : isCurrent ? TOKENS.gold : '#fff',
            color: action.disabled ? '#aaa' : isCurrent ? '#fff' : TOKENS.ink,
            borderStyle: isCurrent || action.disabled ? 'none' : 'solid',
            borderWidth: isCurrent || action.disabled ? 0 : 1,
            borderColor: '#e0d9ce',
            cursor: action.disabled ? 'not-allowed' : 'pointer',
            fontFamily: MONO,
            letterSpacing: 0.3,
            minHeight: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {action.label} {!action.disabled && <ChevronRight size={12} />}
        </button>
      )}
    </div>
  );
}
