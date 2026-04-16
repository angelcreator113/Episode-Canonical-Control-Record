/**
 * ZoneBadges — the three-line at-a-glance summary rendered on every zone card.
 *
 *   👁  Locked until  talked_to_ex = true
 *   ⚡ On tap       set_state(read_messages) → navigate(messages)
 *   ⚠  no target                                   (existing warning)
 *
 * Keeps cognitive load low — creators don't have to expand a zone just to remember
 * what it does. If a line is empty, it's omitted (no visual noise).
 */
import React from 'react';
import { Lock, Unlock, Zap, AlertTriangle } from 'lucide-react';
import { summarizeConditions, summarizeActions, evaluate } from '../../lib/phoneRuntime';

export default function ZoneBadges({ zone, context }) {
  const condSummary = summarizeConditions(zone.conditions);
  const actionSummary = summarizeActions(zone.actions, zone);
  const isLockedNow = condSummary ? !evaluate(zone.conditions, context || {}) : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, fontFamily: "'DM Mono', monospace", color: '#8a7e65', lineHeight: 1.4 }}>
      {condSummary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: isLockedNow ? '#8a5a2c' : '#7a8a5a' }}>
          {isLockedNow ? <Lock size={10} /> : <Unlock size={10} />}
          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 8, letterSpacing: 0.4 }}>
            {isLockedNow ? 'Locked until' : 'Unlocked when'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{condSummary}</span>
        </div>
      )}
      {actionSummary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={10} color="#B8962E" />
          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 8, letterSpacing: 0.4, color: '#B8962E' }}>On tap</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionSummary}</span>
        </div>
      )}
      {!zone.target && !actionSummary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#dc2626' }}>
          <AlertTriangle size={10} />
          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 8, letterSpacing: 0.4 }}>No target</span>
        </div>
      )}
    </div>
  );
}
