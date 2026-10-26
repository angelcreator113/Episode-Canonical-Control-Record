// The rough length of each beat, under "Ready to film?"'s timing row
// (lib/scriptPacing; Evoni, 2026-10-25). Folded by default: a small list,
// a bar per beat against the longest one. Styles in EpisodeScriptPage.css.

export default function ScriptPacingList({ timings = [] }) {
  if (!timings.length) return null;
  const longest = Math.max(1, ...timings.map((t) => t.seconds || 0));
  return (
    <details className="esp-pacing" data-testid="script-pacing">
      <summary className="esp-pacing-sum">Time per beat</summary>
      <ol className="esp-pacing-list">
        {timings.map((t, i) => (
          <li key={t.beatId || `${t.number}-${i}`} className="esp-pacing-row" data-testid="script-pacing-row">
            <span className="esp-pacing-name">Beat {t.number}{t.name ? ` · ${t.name}` : ''}</span>
            <span className="esp-pacing-bar" aria-hidden="true"><span style={{ width: `${Math.round(((t.seconds || 0) / longest) * 100)}%` }} /></span>
            <span className="esp-pacing-time">{t.label}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
