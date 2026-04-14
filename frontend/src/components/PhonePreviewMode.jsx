/**
 * PhonePreviewMode — Full-screen interactive phone simulator overlay
 * ScreenFlowMap — Visual diagram of screen connections
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { X, ChevronLeft, Wifi, Signal, BatteryFull } from 'lucide-react';
import { getScreenImageStyle, PHONE_SKINS } from '../components/PhoneHub';

const TOKENS = { parchment: '#FAF7F0', gold: '#B8962E', ink: '#2C2C2C' };
const MONO = "'DM Mono', monospace";
const PROSE = "'Lora', serif";
const TRANSITION_MS = 300;

function getLinks(screen) {
  return screen?.screen_links || screen?.metadata?.screen_links || [];
}

export default function PhonePreviewMode({ screens = [], initialScreen, onClose, globalFit, phoneSkin = 'midnight' }) {
  const skin = PHONE_SKINS.find(s => s.key === phoneSkin) || PHONE_SKINS[0];
  const [activeScreen, setActiveScreen] = useState(initialScreen || screens[0] || null);
  const [history, setHistory] = useState([]);
  const [slideDir, setSlideDir] = useState(null); // 'left' | 'right' | null
  const [animating, setAnimating] = useState(false);

  const findScreen = useCallback((key) => {
    if (!key) return null;
    const k = key.toLowerCase();
    return screens.find(s => {
      const id = (s.id || '').toLowerCase();
      const beat = (s.beat || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      return id === k || beat === k || name === k || beat.includes(k) || name.includes(k);
    });
  }, [screens]);

  const navigateTo = useCallback((targetKey, direction = 'left') => {
    const target = findScreen(targetKey);
    if (!target || animating) return;
    setSlideDir(direction);
    setAnimating(true);
    if (direction === 'left') setHistory(h => [...h, activeScreen]);
    setTimeout(() => {
      setActiveScreen(target);
      setSlideDir(null);
      setAnimating(false);
    }, TRANSITION_MS);
  }, [findScreen, activeScreen, animating]);

  const goBack = useCallback(() => {
    if (!history.length || animating) return;
    setSlideDir('right');
    setAnimating(true);
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setTimeout(() => {
      setActiveScreen(prev);
      setSlideDir(null);
      setAnimating(false);
    }, TRANSITION_MS);
  }, [history, animating]);

  const goHome = useCallback(() => {
    const home = initialScreen || screens[0];
    if (!home || animating) return;
    setSlideDir('right');
    setAnimating(true);
    setHistory([]);
    setTimeout(() => {
      setActiveScreen(home);
      setSlideDir(null);
      setAnimating(false);
    }, TRANSITION_MS);
  }, [initialScreen, screens, animating]);

  // ESC key handler
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Breadcrumb trail
  const breadcrumbs = useMemo(() => {
    const trail = history.map(s => s?.name || s?.beat || s?.id || '?');
    if (activeScreen) trail.push(activeScreen.name || activeScreen.beat || activeScreen.id || '?');
    return trail;
  }, [history, activeScreen]);

  const links = getLinks(activeScreen);

  const slideTransform = slideDir === 'left'
    ? 'translateX(-100%)' : slideDir === 'right'
    ? 'translateX(100%)' : 'translateX(0)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Close button */}
      <button onClick={onClose} title="Close (ESC)" style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
        padding: '8px 14px', cursor: 'pointer', color: '#fff',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 12,
      }}>
        <span style={{ opacity: 0.6 }}>ESC</span>
        <X size={16} />
      </button>

      {/* Phone device */}
      <div style={{
        width: 320, background: skin.body, borderRadius: 40,
        padding: '14px 10px', position: 'relative',
        boxShadow: `0 12px 48px ${skin.shadow}, inset 0 1px 0 ${skin.accent}`,
      }}>
        {/* Notch */}
        <div style={{
          width: 90, height: 7, borderRadius: 4,
          background: skin.notch, margin: '0 auto 6px',
        }} />

        {/* Screen area */}
        <div style={{
          width: '100%', aspectRatio: '9/19.5', borderRadius: 24,
          overflow: 'hidden', position: 'relative',
          background: activeScreen?.url ? '#000' : 'linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%)',
        }}>
          {/* Status bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 16px', background: 'linear-gradient(rgba(0,0,0,0.4), transparent)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: MONO }}>9:41</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Signal size={11} color="#fff" />
              <Wifi size={11} color="#fff" />
              <BatteryFull size={11} color="#fff" />
            </div>
          </div>

          {/* Back button */}
          {history.length > 0 && (
            <button onClick={goBack} style={{
              position: 'absolute', top: 26, left: 8, zIndex: 6,
              background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 12,
              padding: '4px 8px', cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', gap: 2,
              backdropFilter: 'blur(4px)', fontSize: 10, fontWeight: 700,
            }}>
              <ChevronLeft size={12} /> Back
            </button>
          )}

          {/* Screen content with slide transition */}
          <div style={{
            position: 'absolute', inset: 0,
            transform: slideDir ? slideTransform : 'translateX(0)',
            transition: slideDir ? `transform ${TRANSITION_MS}ms ease-in-out` : 'none',
          }}>
            {activeScreen?.url ? (
              <img
                src={activeScreen.url}
                alt={activeScreen.name}
                style={getScreenImageStyle(activeScreen, globalFit)}
                draggable={false}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#555',
              }}>
                <span style={{ fontSize: 36 }}>📱</span>
                <span style={{ fontSize: 11, marginTop: 8, fontFamily: MONO }}>
                  {activeScreen ? 'No image' : 'No screen'}
                </span>
              </div>
            )}

            {/* Tap zone hotspots */}
            {links.map(link => (
              <div
                key={link.id}
                onClick={(e) => { e.stopPropagation(); if (link.target) navigateTo(link.target, 'left'); }}
                title={link.label || link.target}
                style={{
                  position: 'absolute',
                  left: `${link.x}%`, top: `${link.y}%`,
                  width: `${link.w}%`, height: `${link.h}%`,
                  cursor: link.target ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, zIndex: 3, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,150,46,0.18)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {link.icon_url && (
                  <img src={link.icon_url} alt={link.label || ''} draggable={false}
                    style={{ width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Home button bar */}
        <div
          onClick={goHome}
          title="Home"
          style={{
            width: 44, height: 5, borderRadius: 3,
            background: skin.btn, margin: '8px auto 0', cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        />
      </div>

      {/* Screen name */}
      {activeScreen && (
        <div style={{
          marginTop: 12, textAlign: 'center', color: '#fff',
          fontFamily: PROSE, fontSize: 15, fontWeight: 600,
        }}>
          {activeScreen.name || activeScreen.beat || activeScreen.id}
        </div>
      )}

      {/* Breadcrumb trail */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.45)',
        flexWrap: 'wrap', justifyContent: 'center', maxWidth: 360, padding: '0 12px',
      }}>
        {breadcrumbs.map((name, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)' }}>{'>'}</span>}
            <span style={i === breadcrumbs.length - 1 ? { color: TOKENS.gold, fontWeight: 600 } : {}}>
              {name}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   ScreenFlowMap — Visual diagram of screen connections
   ────────────────────────────────────────────── */

function ScreenFlowMap({ screens = [], onSelectScreen, selectedScreen }) {
  // Only show screens that have images
  const nodes = useMemo(() => screens.filter(s => s.url), [screens]);
  const cols = Math.max(3, Math.ceil(Math.sqrt(nodes.length)));
  const nodeW = 80, nodeH = 56, gapX = 40, gapY = 50;
  const padX = 30, padY = 30;

  // Position map for each screen
  const positions = useMemo(() => {
    const map = {};
    nodes.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      map[s.id || s.beat || s.name] = {
        x: padX + col * (nodeW + gapX),
        y: padY + row * (nodeH + gapY),
        screen: s,
      };
    });
    return map;
  }, [nodes, cols]);

  // Build edges
  const edges = useMemo(() => {
    const result = [];
    nodes.forEach(s => {
      const links = getLinks(s);
      const fromKey = s.id || s.beat || s.name;
      const from = positions[fromKey];
      if (!from) return;
      links.forEach(link => {
        if (!link.target) return;
        // find target position
        const targetScreen = nodes.find(n => {
          const k = link.target.toLowerCase();
          const id = (n.id || '').toLowerCase();
          const beat = (n.beat || '').toLowerCase();
          const name = (n.name || '').toLowerCase();
          return id === k || beat === k || name === k || beat.includes(k) || name.includes(k);
        });
        if (!targetScreen) return;
        const toKey = targetScreen.id || targetScreen.beat || targetScreen.name;
        const to = positions[toKey];
        if (!to) return;
        result.push({ from, to, label: link.label });
      });
    });
    return result;
  }, [nodes, positions]);

  const totalRows = Math.ceil(nodes.length / cols);
  const svgW = padX * 2 + cols * (nodeW + gapX) - gapX;
  const svgH = padY * 2 + totalRows * (nodeH + gapY) - gapY;

  if (!nodes.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#888', fontFamily: MONO, fontSize: 12 }}>
        No screens with images to map.
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', background: TOKENS.ink, borderRadius: 12, padding: 8 }}>
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {/* Connection lines */}
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={edge.from.x + nodeW / 2} y1={edge.from.y + nodeH / 2}
            x2={edge.to.x + nodeW / 2} y2={edge.to.y + nodeH / 2}
            stroke={TOKENS.gold} strokeWidth={1.5} opacity={0.5}
            markerEnd="url(#arrowhead)"
          />
        ))}
        {/* Arrow marker */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={TOKENS.gold} opacity="0.6" />
          </marker>
        </defs>
        {/* Screen nodes */}
        {nodes.map(s => {
          const key = s.id || s.beat || s.name;
          const pos = positions[key];
          if (!pos) return null;
          const isSelected = selectedScreen && (selectedScreen.id || selectedScreen.beat) === (s.id || s.beat);
          return (
            <g key={key} style={{ cursor: 'pointer' }} onClick={() => onSelectScreen?.(s)}>
              <rect
                x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={6}
                fill="#1a1a2e"
                stroke={isSelected ? TOKENS.gold : 'rgba(255,255,255,0.15)'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <image
                href={s.url} x={pos.x + 2} y={pos.y + 2}
                width={nodeW - 4} height={nodeH - 14}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`inset(0 round 4px)`}
              />
              <text
                x={pos.x + nodeW / 2} y={pos.y + nodeH - 3}
                textAnchor="middle" fill="#ccc"
                fontSize={8} fontFamily={MONO}
              >
                {(s.name || s.beat || key).slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export { ScreenFlowMap };
