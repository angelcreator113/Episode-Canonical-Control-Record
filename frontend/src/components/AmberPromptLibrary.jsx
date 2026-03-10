/**
 * AmberPromptLibrary.jsx
 * Tap-to-copy prompt library for Amber conversations.
 * Light theme. Sits as a floating button or embeds into AppAssistant panel.
 *
 * Usage: drop into AppAssistant.jsx panel above the input row,
 * or mount as a standalone page at /amber-prompts.
 *
 * Props:
 *   onSelect(promptText) — called when user taps a prompt (optional)
 *                          use this to pipe directly into Amber's input
 */
import { useState } from 'react';

const CATEGORIES = [
  {
    label: 'System Status',
    icon: '\u2699\uFE0F',
    prompts: [
      "What's deployed right now?",
      "What's next in the build queue?",
      "What systems are partially built or blocked?",
      "What's still on the deploy checklist?",
      "Run a full mobile responsiveness audit on the frontend and fix everything that's broken.",
      "Audit the frontend for mobile, tablet, and desktop breakpoints. Flag anything clipped, overflowing, or misaligned and fix it.",
    ],
  },
  {
    label: 'Franchise Knowledge',
    icon: '\uD83D\uDCD6',
    prompts: [
      "What are the six franchise laws?",
      "Who is JustAWoman?",
      "What is the consciousness transfer and when does it happen?",
      "What are the three permanently locked systems?",
      "What is Lala's origin \u2014 the franchise-correct version?",
      "What does David know versus what he actually feels?",
      "What are the 8 pain point categories?",
      "What is the Career Echo system?",
      "Who are the Besties and why does that word matter?",
    ],
  },
  {
    label: 'Characters',
    icon: '\uD83D\uDC64',
    prompts: [
      "Pull JustAWoman's full character dossier.",
      "Pull Lala's full character dossier.",
      "Pull David's character dossier.",
      "What characters are pending generation right now?",
      "What is the difference between a PNOS character and a world character?",
      "Can interior monologue characters be promoted to LalaVerse canon?",
      "Generate a Character Spark for [character name, vibe, role].",
    ],
  },
  {
    label: 'Story & Writing',
    icon: '\u270D\uFE0F',
    prompts: [
      "Generate the next scene. Use tone: Longing.",
      "Generate the next scene. Use tone: Tension.",
      "Generate the next scene. Use tone: Sensual.",
      "Generate the next scene. Use tone: Explicit.",
      "Generate the next scene. Use tone: Aftermath.",
      "What chapter am I in and what has been established so far?",
      "What Lala seeds have been detected in approved stories?",
      "Propose a memory for the last approved scene.",
      "What plot threads have been discovered so far?",
    ],
  },
  {
    label: 'Navigation',
    icon: '\uD83D\uDDFA\uFE0F',
    prompts: [
      "Take me to the Character Registry.",
      "Take me to the StoryTeller.",
      "Take me to the Continuity Engine.",
      "Take me to Universe Admin.",
      "Take me to the Show Production system.",
      "Take me to Character Therapy.",
      "Take me to the Franchise Brain.",
    ],
  },
  {
    label: 'Show & Production',
    icon: '\uD83C\uDFAC',
    prompts: [
      "What are the 24 world events and how are they categorized?",
      "What is the 9-beat episode structure?",
      "What wardrobe pieces are in Lala's active inventory?",
      "What is the difference between the novel brain and the show brain?",
      "Why can't the show engine read novel brain knowledge?",
      "What is the series_id scoping rule?",
    ],
  },
  {
    label: 'Amber Herself',
    icon: '\u2726',
    prompts: [
      "What can you actually do?",
      "What are Amber's three core investments?",
      "What is the difference between what you can do and what Claude Code can do?",
      "Read me the last approved scene.",
      "What did you do while I was gone and why does it matter for the brand?",
    ],
  },
];

export default function AmberPromptLibrary({ onSelect }) {
  const [open,           setOpen]           = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [copied,         setCopied]         = useState(null);

  const handlePrompt = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard may not be available */ }

    if (onSelect) onSelect(text);
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        className="apl-trigger"
        onClick={() => setOpen(o => !o)}
        title="Prompt Library"
        aria-label="Open Amber prompt library"
      >
        {open ? '\u2715' : '\u26A1'}
      </button>

      {open && (
        <div className="apl-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {open && (
        <div className="apl-panel" role="dialog" aria-label="Amber Prompt Library">
          <div className="apl-header">
            <span className="apl-header-title">Prompt Library</span>
            <span className="apl-header-sub">Tap to copy &middot; paste into Amber</span>
            <button className="apl-close" onClick={() => setOpen(false)}>&times;</button>
          </div>

          <div className="apl-body">
            {/* Category sidebar */}
            <nav className="apl-nav">
              {CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  className={`apl-nav-item${activeCategory === i ? ' active' : ''}`}
                  onClick={() => setActiveCategory(i)}
                >
                  <span className="apl-nav-icon">{cat.icon}</span>
                  <span className="apl-nav-label">{cat.label}</span>
                </button>
              ))}
            </nav>

            {/* Prompt list */}
            <div className="apl-prompts">
              <p className="apl-category-label">
                {CATEGORIES[activeCategory].icon} {CATEGORIES[activeCategory].label}
              </p>
              <ul className="apl-prompt-list">
                {CATEGORIES[activeCategory].prompts.map((prompt) => (
                  <li key={prompt}>
                    <button
                      className={`apl-prompt-btn${copied === prompt ? ' copied' : ''}`}
                      onClick={() => handlePrompt(prompt)}
                    >
                      <span className="apl-prompt-text">{prompt}</span>
                      <span className="apl-prompt-action">
                        {copied === prompt ? '\u2713 Copied' : 'Copy'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Trigger ────────────────────────────────────────────────── */
        .apl-trigger {
          position: fixed;
          bottom: 160px;
          right: 24px;
          z-index: 9998;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1.5px solid #e8d5dd;
          background: #fff;
          color: #d4789a;
          font-size: 18px;
          cursor: pointer;
          box-shadow: 0 2px 12px rgba(212,120,154,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .apl-trigger:hover {
          box-shadow: 0 4px 20px rgba(212,120,154,0.25);
          transform: scale(1.06);
        }

        /* ── Overlay ────────────────────────────────────────────────── */
        .apl-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(0,0,0,0.08);
        }

        /* ── Panel ──────────────────────────────────────────────────── */
        .apl-panel {
          position: fixed;
          bottom: 80px;
          right: 24px;
          z-index: 9999;
          width: 560px;
          max-width: calc(100vw - 32px);
          max-height: 70vh;
          background: #fff;
          border: 1px solid #f0e4ea;
          border-radius: 16px;
          box-shadow: 0 8px 40px rgba(180,100,130,0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Georgia', serif;
        }

        /* ── Header ─────────────────────────────────────────────────── */
        .apl-header {
          display: flex;
          align-items: baseline;
          gap: 10px;
          padding: 16px 20px 12px;
          border-bottom: 1px solid #f5edf1;
          background: #fdf8fa;
          flex-shrink: 0;
        }
        .apl-header-title {
          font-size: 14px;
          font-weight: 600;
          color: #2d1f28;
          letter-spacing: 0.01em;
        }
        .apl-header-sub {
          font-size: 11px;
          color: #b08090;
          font-style: italic;
          flex: 1;
        }
        .apl-close {
          background: none;
          border: none;
          color: #c09aaa;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .apl-close:hover { color: #d4789a; }

        /* ── Body ───────────────────────────────────────────────────── */
        .apl-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* ── Nav sidebar ────────────────────────────────────────────── */
        .apl-nav {
          width: 148px;
          flex-shrink: 0;
          border-right: 1px solid #f5edf1;
          overflow-y: auto;
          padding: 8px 0;
          background: #fdf8fa;
        }
        .apl-nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 9px 14px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          border-radius: 0;
          transition: background 0.12s;
        }
        .apl-nav-item:hover { background: #f9eef4; }
        .apl-nav-item.active {
          background: #fff;
          border-right: 2px solid #d4789a;
        }
        .apl-nav-icon { font-size: 14px; flex-shrink: 0; }
        .apl-nav-label {
          font-size: 11px;
          color: #5a3a4a;
          font-family: system-ui, sans-serif;
          font-weight: 500;
          line-height: 1.3;
        }
        .apl-nav-item.active .apl-nav-label { color: #d4789a; }

        /* ── Prompt list ────────────────────────────────────────────── */
        .apl-prompts {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px 20px;
        }
        .apl-category-label {
          font-size: 11px;
          font-weight: 600;
          color: #c09aaa;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 10px;
          font-family: system-ui, sans-serif;
        }
        .apl-prompt-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .apl-prompt-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          background: #fdf8fa;
          border: 1px solid #f0e4ea;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
        }
        .apl-prompt-btn:hover {
          background: #fff;
          border-color: #d4789a;
          box-shadow: 0 2px 8px rgba(212,120,154,0.10);
        }
        .apl-prompt-btn.copied {
          background: #fef0f5;
          border-color: #d4789a;
        }
        .apl-prompt-text {
          font-size: 12.5px;
          color: #3d2030;
          line-height: 1.45;
          font-family: system-ui, sans-serif;
        }
        .apl-prompt-action {
          font-size: 10px;
          color: #d4789a;
          font-family: system-ui, sans-serif;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
          letter-spacing: 0.03em;
        }
        .apl-prompt-btn.copied .apl-prompt-action { color: #a889c8; }

        /* ── Mobile ─────────────────────────────────────────────────── */
        @media (max-width: 600px) {
          .apl-panel {
            bottom: 0;
            right: 0;
            left: 0;
            width: 100%;
            max-width: 100%;
            border-radius: 16px 16px 0 0;
            max-height: 80vh;
          }
          .apl-trigger {
            bottom: 140px;
            right: 16px;
          }
          .apl-nav { width: 120px; }
        }
      `}</style>
    </>
  );
}
