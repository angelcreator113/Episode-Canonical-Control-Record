/**
 * Which show? (audit CTX-01, 2026-10-03). With several shows and none
 * active, a page asks instead of taking the first show the API returned.
 * ShowChooser is the full card; ShowSelect the inline control for a page
 * that only needs a target show for one action.
 */

const TEAL = '#2F7F76';
const PINK = '#C06E87';

export default function ShowChooser({ shows = [], onChoose, purpose = 'to continue' }) {
  return (
    <div role="group" aria-label="Which show" data-testid="show-chooser" style={{
      maxWidth: 520, margin: '24px auto', padding: '18px 20px', borderRadius: 12,
      background: '#FBEFF3', border: `1px solid ${PINK}`, color: '#2C2C2C',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Which show?</div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#7a6d62' }}>
        Choose the show {purpose}. It stays your active show until you open another.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {shows.map((s) => (
          <button
            key={s.id} type="button" data-testid={`show-chooser-${s.id}`} onClick={() => onChoose(String(s.id))}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: TEAL, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {s.name || s.title || s.id}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShowSelect({ shows = [], value, onChange, label = 'Show', prompt = 'Choose a show…' }) {
  return (
    <select
      value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={label} data-testid="show-select"
      style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${value ? TEAL : PINK}`, fontSize: 12, background: '#fff', color: '#2C2C2C' }}
    >
      <option value="" disabled>{prompt}</option>
      {shows.map((s) => <option key={s.id} value={s.id}>{s.name || s.title || s.id}</option>)}
    </select>
  );
}
