/**
 * ChapterWardrobePanel.jsx
 * frontend/src/components/ChapterWardrobePanel.jsx
 *
 * Passive panel in the Book Editor.
 * Shows wardrobe pieces assigned to this chapter + its lines.
 * Sits between ChapterBrief and the manuscript lines.
 *
 * Props:
 *   chapterId: string (UUID)
 *   onAssign: function — opens WardrobeAssignmentModal in Book Scene tab
 */

import { useState, useEffect } from 'react';

const FUNCTION_LABELS = {
  establishes_status:  'Establishes status',
  marks_transition:    'Marks a transition',
  reveals_interior:    'Reveals interior',
  continuity_anchor:   'Continuity anchor',
  brand_moment:        'Brand moment',
};

const PRESS_COLORS = {
  uncovered: '#C9A84C',
  queued:    '#4A90D9',
  covered:   '#4A9B6F',
};

export default function ChapterWardrobePanel({ chapterId, onAssign }) {
  const [pieces,    setPieces]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!chapterId) return;
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch(`/api/v1/wardrobe-library/for-chapter/${chapterId}`);
        const data = await res.json();
        setPieces(data.all_pieces || []);
      } catch {}
      setLoading(false);
    }
    load();
  }, [chapterId]);

  if (loading) return null; // Passive — don't show skeleton
  if (pieces.length === 0 && collapsed) return null;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.label}>WARDROBE IN THIS CHAPTER</span>
          {pieces.length > 0 && (
            <span style={s.count}>{pieces.length}</span>
          )}
        </div>
        <div style={s.headerRight}>
          <button style={s.addBtn} onClick={onAssign}>+ Assign piece</button>
          {pieces.length > 0 && (
            <button style={s.collapseBtn} onClick={() => setCollapsed(c => !c)}>
              {collapsed ? '▼' : '▲'}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {pieces.length === 0 ? (
            <div style={s.empty}>
              No wardrobe pieces assigned yet. Assign a piece to describe
              what characters are wearing in this chapter.
            </div>
          ) : (
            <div style={s.pieceList}>
              {pieces.map(piece => (
                <PieceRow key={piece.id} piece={piece} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PieceRow({ piece }) {
  const item        = piece.item;
  const pressStatus = piece.press_triggered ? 'queued' : null;
  const fnLabel     = FUNCTION_LABELS[piece.narrative_function];
  const isLineLevel = piece.content_type === 'scene_line';

  return (
    <div style={s.pieceRow}>
      {/* Image */}
      <div style={s.imgBox}>
        {item?.image_url
          ? <img src={item.image_url} alt={item?.name} style={s.img} />
          : <div style={s.imgPlaceholder}>◈</div>
        }
      </div>

      {/* Info */}
      <div style={s.pieceInfo}>
        <div style={s.pieceName}>{item?.name || 'Unnamed piece'}</div>

        <div style={s.pieceMeta}>
          {item?.brand && <span style={s.brand}>{item.brand}</span>}
          {item?.brand && <span style={s.dot}>·</span>}
          <span style={s.level}>
            {isLineLevel ? 'Line-level' : 'Chapter-level'}
          </span>
        </div>

        {piece.scene_context && (
          <div style={s.context}>"{piece.scene_context}"</div>
        )}

        <div style={s.tags}>
          {fnLabel && <span style={s.fnTag}>{fnLabel}</span>}
          {pressStatus && (
            <span style={{ ...s.pressTag, color: PRESS_COLORS[pressStatus] }}>
              Press: {pressStatus}
            </span>
          )}
          {piece.character_name && (
            <span style={s.charTag}>{piece.character_name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const PARCHMENT = '#FAF7F0';
const CREAM     = '#F5F0E5';
const INK       = '#1C1814';
const INK_MID   = 'rgba(28,24,20,0.5)';
const INK_LIGHT = 'rgba(28,24,20,0.3)';
const GOLD      = '#C9A84C';

const s = {
  root: {
    background:   CREAM,
    border:       `1px solid rgba(201,168,76,0.2)`,
    borderRadius: 3,
    marginBottom: 16,
    overflow:     'hidden',
    fontFamily:   "'DM Mono', monospace",
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '10px 14px',
    borderBottom:   `1px solid rgba(201,168,76,0.15)`,
  },
  headerLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
  },
  label: {
    fontSize:      7.5,
    letterSpacing: '0.18em',
    color:         GOLD,
  },
  count: {
    background:    GOLD,
    color:         PARCHMENT,
    fontSize:      7,
    fontWeight:    600,
    borderRadius:  10,
    padding:       '1px 6px',
    letterSpacing: '0.06em',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  addBtn: {
    background:    'none',
    border:        `1px solid rgba(201,168,76,0.35)`,
    borderRadius:  2,
    padding:       '4px 10px',
    fontSize:      8,
    letterSpacing: '0.08em',
    color:         GOLD,
    cursor:        'pointer',
    fontFamily:    "'DM Mono', monospace",
  },
  collapseBtn: {
    background: 'none',
    border:     'none',
    color:      INK_LIGHT,
    fontSize:   10,
    cursor:     'pointer',
    padding:    '2px 4px',
  },
  empty: {
    padding:    '12px 14px',
    fontSize:   11,
    fontStyle:  'italic',
    color:      INK_LIGHT,
    fontFamily: "'Lora', Georgia, serif",
  },
  pieceList: {
    display:       'flex',
    flexDirection: 'column',
    gap:           0,
  },
  pieceRow: {
    display:     'flex',
    gap:         12,
    padding:     '10px 14px',
    borderBottom: `1px solid rgba(28,24,20,0.05)`,
    alignItems:  'flex-start',
  },
  imgBox: {
    width:        44,
    height:       44,
    flexShrink:   0,
    borderRadius: 2,
    overflow:     'hidden',
    background:   'rgba(28,24,20,0.05)',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
  },
  img: {
    width:      '100%',
    height:     '100%',
    objectFit:  'cover',
  },
  imgPlaceholder: {
    fontSize: 16,
    color:    INK_LIGHT,
  },
  pieceInfo: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
  },
  pieceName: {
    fontSize:      11,
    letterSpacing: '0.05em',
    color:         INK,
    fontWeight:    500,
  },
  pieceMeta: {
    display:    'flex',
    gap:        5,
    alignItems: 'center',
  },
  brand: {
    fontSize:      9,
    letterSpacing: '0.06em',
    color:         GOLD,
  },
  dot: {
    color:    INK_LIGHT,
    fontSize: 9,
  },
  level: {
    fontSize:      9,
    letterSpacing: '0.04em',
    color:         INK_LIGHT,
  },
  context: {
    fontFamily: "'Lora', Georgia, serif",
    fontStyle:  'italic',
    fontSize:   12,
    color:      INK_MID,
    lineHeight: 1.5,
  },
  tags: {
    display:    'flex',
    gap:        8,
    flexWrap:   'wrap',
    marginTop:  2,
  },
  fnTag: {
    fontSize:      8,
    letterSpacing: '0.06em',
    color:         INK_LIGHT,
    border:        `1px solid rgba(28,24,20,0.12)`,
    borderRadius:  10,
    padding:       '1px 7px',
  },
  pressTag: {
    fontSize:      8,
    letterSpacing: '0.06em',
  },
  charTag: {
    fontSize:      8,
    letterSpacing: '0.06em',
    color:         INK_LIGHT,
  },
};
