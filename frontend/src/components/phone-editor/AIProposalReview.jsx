/**
 * AIProposalReview — modal that renders an AI-proposed zones batch for approval.
 *
 * The server returns proposed zones already validated against the same schema the
 * save route uses, so by the time they land here they're guaranteed to be saveable.
 * This UI is purely human review: glance at what the AI suggests, approve → merge
 * + save through the normal PUT, or reject → discard.
 */
import React from 'react';
import { X, Check, Sparkles, ChevronRight } from 'lucide-react';
import { summarizeConditions, summarizeActions } from '../../lib/phoneRuntime';

export default function AIProposalReview({ proposal, contextSummary, onApprove, onReject, busy }) {
  if (!proposal) return null;
  const zones = proposal.zones || [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9800,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onReject}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '80vh',
          background: '#FAF7F0', borderRadius: 16,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid #e8e0d0',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8e0d0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="#B8962E" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 17, fontWeight: 700, color: '#2C2C2C' }}>
              AI Proposal — {zones.length} zone{zones.length === 1 ? '' : 's'}
            </div>
            {contextSummary && (
              <div style={{ fontSize: 10, color: '#8a7e65', fontFamily: "'DM Mono', monospace", letterSpacing: 0.3, marginTop: 2 }}>
                {contextSummary.show} → {contextSummary.screen}
              </div>
            )}
          </div>
          <button onClick={onReject} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Zone list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {zones.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>
              The AI didn't propose any zones. Try again with a different hint.
            </div>
          )}
          {zones.map((z, i) => {
            const condSummary = summarizeConditions(z.conditions);
            const actSummary = summarizeActions(z.actions, z);
            return (
              <div key={z.id || i} style={{
                padding: '10px 12px', marginBottom: 8,
                background: '#fff', borderRadius: 10,
                border: '1px solid #e8e0d0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, color: '#2C2C2C', flex: 1 }}>
                    {z.label || 'Untitled'}
                  </span>
                  <span style={{ fontSize: 10, color: '#a89870', fontFamily: "'DM Mono', monospace" }}>
                    {Math.round(z.x)},{Math.round(z.y)} · {Math.round(z.w)}×{Math.round(z.h)}%
                  </span>
                </div>
                {condSummary && (
                  <div style={{ fontSize: 10, color: '#8a5a2c', fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>
                    🔒 {condSummary}
                  </div>
                )}
                {actSummary && (
                  <div style={{ fontSize: 10, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>
                    ⚡ {actSummary}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid #e8e0d0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onReject}
            disabled={busy}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, border: '1px solid #e0d9ce', borderRadius: 8, background: '#fff', cursor: busy ? 'wait' : 'pointer', color: '#666', fontFamily: "'DM Mono', monospace", minHeight: 36 }}
          >
            Discard
          </button>
          <button
            onClick={onApprove}
            disabled={busy || zones.length === 0}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 8, background: busy || zones.length === 0 ? '#ccc' : '#B8962E', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontFamily: "'DM Mono', monospace", minHeight: 36, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Check size={14} /> Add {zones.length} zone{zones.length === 1 ? '' : 's'} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
