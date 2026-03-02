import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './CharacterGenerator.css';

// ─── LocalStorage persistence helpers ─────────────────────────────────────────
const STORAGE_KEY = 'cg-session';
function saveSession(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}
function loadSession() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  pressure:    '#c0392b',
  mirror:      '#7c3aed',
  support:     '#0d9668',
  shadow:      '#546678',
  special:     '#b0922e',
};

const ROLE_ICONS = {
  pressure:    '⊗',
  mirror:      '◎',
  support:     '◉',
  shadow:      '◆',
  special:     '✦',
};

const MOMENTUM_COLORS = {
  rising:   '#0d9668',
  steady:   '#b0922e',
  falling:  '#c0392b',
  dormant:  '#94a3b8',
};

const WORLD_LABELS = {
  book1:     'Book 1',
  lalaverse: 'LalaVerse',
};

// ─── Ecosystem panel ──────────────────────────────────────────────────────────
function EcosystemPanel({ ecosystem, loading }) {
  if (loading) return (
    <div className="cg-ecosystem-loading">
      <div className="cg-spinner" />
      <span>Reading the world…</span>
    </div>
  );

  if (!ecosystem) return null;

  const worlds = ['book1', 'lalaverse'];

  return (
    <div className="cg-ecosystem">
      {worlds.map((worldId) => {
        const world = ecosystem[worldId];
        if (!world) return null;
        const stats = world.stats || {};
        const roleCount = stats.roleCount || {};

        return (
          <div key={worldId} className={`cg-world-card cg-health-${stats.health || 'unknown'}`}>
            <div className="cg-world-header">
              <span className="cg-world-label">{WORLD_LABELS[worldId]}</span>
              <span className={`cg-world-health cg-health-badge-${stats.health}`}>
                {stats.health || '—'}
              </span>
            </div>
            <div className="cg-world-total">{stats.total || 0} characters</div>

            {/* Role distribution */}
            <div className="cg-role-bars">
              {Object.entries(roleCount).map(([role, count]) => (
                <div key={role} className="cg-role-bar-row">
                  <span
                    className="cg-role-bar-label"
                    style={{ color: ROLE_COLORS[role] }}
                  >
                    {ROLE_ICONS[role]} {role}
                  </span>
                  <div className="cg-role-bar-track">
                    <div
                      className="cg-role-bar-fill"
                      style={{
                        width: `${Math.min(count / 6, 1) * 100}%`,
                        background: ROLE_COLORS[role],
                      }}
                    />
                  </div>
                  <span className="cg-role-bar-count">{count}</span>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {stats.saturated?.length > 0 && (
              <div className="cg-ecosystem-warning">
                ⚠ Saturated: {stats.saturated.join(', ')}
              </div>
            )}
            {stats.empty?.length > 0 && (
              <div className="cg-ecosystem-empty">
                ○ Empty: {stats.empty.join(', ')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Seed card ────────────────────────────────────────────────────────────────
function SeedCard({ seed, index, onApprove, onReject, onEdit }) {
  const [editing, setEditing]   = useState(false);
  const [editSeed, setEditSeed] = useState(seed);
  const color = ROLE_COLORS[seed.role_type] || '#94a3b8';

  function handleSave() {
    onEdit(index, editSeed);
    setEditing(false);
  }

  return (
    <div
      className={`cg-seed-card cg-seed-${seed._status || 'pending'}`}
      style={{ '--role-color': color }}
    >
      {/* Status indicator */}
      <div className="cg-seed-status-bar" style={{ background: color }} />

      <div className="cg-seed-body">
        {editing ? (
          <div className="cg-seed-edit-form">
            <div className="cg-seed-edit-row">
              <label>Name</label>
              <input
                value={editSeed.name}
                onChange={(e) => setEditSeed((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="cg-seed-edit-row">
              <label>Age</label>
              <input
                type="number"
                value={editSeed.age}
                onChange={(e) => setEditSeed((p) => ({ ...p, age: parseInt(e.target.value) }))}
              />
            </div>
            <div className="cg-seed-edit-row">
              <label>Gender</label>
              <select
                value={editSeed.gender}
                onChange={(e) => setEditSeed((p) => ({ ...p, gender: e.target.value }))}
              >
                <option value="woman">Woman</option>
                <option value="man">Man</option>
                <option value="nonbinary">Nonbinary</option>
              </select>
            </div>
            <div className="cg-seed-edit-row">
              <label>Role</label>
              <select
                value={editSeed.role_type}
                onChange={(e) => setEditSeed((p) => ({ ...p, role_type: e.target.value }))}
              >
                {['pressure', 'mirror', 'support', 'shadow', 'special'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="cg-seed-edit-row">
              <label>Career</label>
              <input
                value={editSeed.career}
                onChange={(e) => setEditSeed((p) => ({ ...p, career: e.target.value }))}
              />
            </div>
            <div className="cg-seed-edit-row">
              <label>Tension</label>
              <textarea
                value={editSeed.tension}
                onChange={(e) => setEditSeed((p) => ({ ...p, tension: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="cg-seed-edit-actions">
              <button className="cg-btn cg-btn-cancel" onClick={() => { setEditing(false); setEditSeed(seed); }}>
                Cancel
              </button>
              <button className="cg-btn cg-btn-save" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="cg-seed-top">
              <div className="cg-seed-name">{seed.name}</div>
              <div className="cg-seed-meta">
                <span className="cg-seed-age">{seed.age}</span>
                <span className="cg-seed-gender">{seed.gender}</span>
                <span className="cg-seed-world">{WORLD_LABELS[seed.world]}</span>
              </div>
            </div>
            <div className="cg-seed-role" style={{ color }}>
              {ROLE_ICONS[seed.role_type]} {seed.role_type}
            </div>
            <div className="cg-seed-career">{seed.career}</div>
            <div className="cg-seed-tension">"{seed.tension}"</div>
            <div className="cg-seed-why">{seed.why_this_world}</div>
          </>
        )}
      </div>

      {!editing && seed._status === 'pending' && (
        <div className="cg-seed-actions">
          <button className="cg-btn cg-btn-edit" onClick={() => setEditing(true)}>Edit</button>
          <button className="cg-btn cg-btn-reject" onClick={() => onReject(index)}>Skip</button>
          <button className="cg-btn cg-btn-approve" style={{ background: color }} onClick={() => onApprove(index)}>
            Approve
          </button>
        </div>
      )}

      {!editing && seed._status === 'approved' && (
        <div className="cg-seed-approved-badge">✓ Approved</div>
      )}
      {!editing && seed._status === 'rejected' && (
        <div className="cg-seed-rejected-badge">Skipped</div>
      )}
    </div>
  );
}

// ─── Staging card (full profile review) ──────────────────────────────────────
function StagingCard({ result, checks, onCommit, onDiscard, registries }) {
  const [expanded, setExpanded]       = useState(false);

  const { seed, profile, status, error } = result;
  const color = ROLE_COLORS[seed?.role_type] || '#94a3b8';
  const identity = profile?.identity || {};
  const living   = profile?.living_state || {};
  const psych    = profile?.psychology || {};
  const aesthetic = profile?.aesthetic_dna || {};
  const career   = profile?.career || {};
  const rels     = profile?.relationships || {};
  const voice    = profile?.voice || {};
  const dilemma  = profile?.dilemma || {};
  const threads  = profile?.plot_threads || [];

  if (status === 'failed') return (
    <div className="cg-staging-card cg-staging-failed">
      <div className="cg-staging-name">{seed?.name}</div>
      <div className="cg-staging-error">Generation failed: {error}</div>
      <button className="cg-btn cg-btn-discard" onClick={() => onDiscard(result)}>Remove</button>
    </div>
  );

  return (
    <div className="cg-staging-card" style={{ '--role-color': color }}>
      <div className="cg-staging-bar" style={{ background: color }} />

      {/* Header */}
      <div className="cg-staging-header" onClick={() => setExpanded((p) => !p)}>
        <div className="cg-staging-header-left">
          <div className="cg-staging-name">{seed?.name}</div>
          <div className="cg-staging-meta">
            <span>{identity.age || seed?.age}</span>
            <span>{identity.gender || seed?.gender}</span>
            <span style={{ color }}>{ROLE_ICONS[seed?.role_type]} {seed?.role_type}</span>
            <span>{WORLD_LABELS[seed?.world]}</span>
            <span className={`cg-momentum cg-momentum-${living.momentum}`}>
              {living.momentum}
            </span>
          </div>
          <div className="cg-staging-tension">"{seed?.tension}"</div>
        </div>
        <div className="cg-staging-expand">{expanded ? '▲' : '▼'}</div>
      </div>

      {/* Checks */}
      {checks && (
        <div className="cg-staging-checks">
          {checks.errors?.map((e, i) => (
            <div key={i} className="cg-check cg-check-error">✗ {e.message}</div>
          ))}
          {checks.warnings?.map((w, i) => (
            <div key={i} className="cg-check cg-check-warning">⚠ {w.message}</div>
          ))}
          {checks.collision_character && (
            <div className="cg-check cg-check-collision">
              ⊕ Dilemma collides with {checks.collision_character.name} — high story potential
            </div>
          )}
          {!checks.errors?.length && !checks.warnings?.length && (
            <div className="cg-check cg-check-ok">✓ No conflicts detected</div>
          )}
        </div>
      )}

      {/* Expanded profile */}
      {expanded && profile && (
        <div className="cg-staging-profile">

          {/* Living state */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Living State</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Knows</div>
                <div className="cg-profile-value">{living.knows}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Wants</div>
                <div className="cg-profile-value">{living.wants}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Unresolved</div>
                <div className="cg-profile-value">{living.unresolved}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Location</div>
                <div className="cg-profile-value">{living.current_location}</div>
              </div>
            </div>
          </div>

          {/* Psychology */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Psychology</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Core Wound</div>
                <div className="cg-profile-value">{psych.core_wound}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Desire Line</div>
                <div className="cg-profile-value">{psych.desire_line}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Fear Line</div>
                <div className="cg-profile-value">{psych.fear_line}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Coping Mechanism</div>
                <div className="cg-profile-value">{psych.coping_mechanism}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Self-Deception</div>
                <div className="cg-profile-value">{psych.self_deception}</div>
              </div>
            </div>
          </div>

          {/* Dilemmas */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Dilemmas</div>
            <div className="cg-dilemma-active">
              <div className="cg-profile-label">Active</div>
              <div className="cg-dilemma-text" style={{ color }}>{dilemma.active}</div>
            </div>
            <div className="cg-dilemma-latent">
              <div className="cg-profile-label">Latent</div>
              <div className="cg-dilemma-text cg-dim">{dilemma.latent_1}</div>
              <div className="cg-dilemma-text cg-dim">{dilemma.latent_2}</div>
            </div>
          </div>

          {/* Aesthetic DNA */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Aesthetic DNA</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Visual Signature</div>
                <div className="cg-profile-value">{aesthetic.visual_signature}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Style</div>
                <div className="cg-profile-value">{aesthetic.style}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Signature Object</div>
                <div className="cg-profile-value">{aesthetic.signature_object}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Room Presence</div>
                <div className="cg-profile-value">{aesthetic.room_presence}</div>
              </div>
            </div>
          </div>

          {/* Career */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Career</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Job</div>
                <div className="cg-profile-value">{career.job_title} · {career.industry}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Career Wound</div>
                <div className="cg-profile-value">{career.career_wound}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Job Antagonist</div>
                <div className="cg-profile-value">{career.job_antagonist}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Success To Them</div>
                <div className="cg-profile-value">{career.success_to_them}</div>
              </div>
            </div>
          </div>

          {/* Relationships */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Relationships</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">Status</div>
                <div className="cg-profile-value">{rels.romantic_status} — {rels.romantic_detail}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Wants From Love</div>
                <div className="cg-profile-value">{rels.what_they_want_from_love}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">How They Fight</div>
                <div className="cg-profile-value">{rels.how_they_fight}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Last Ending Taught</div>
                <div className="cg-profile-value">{rels.last_ending_taught_them}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Calls At 2am</div>
                <div className="cg-profile-value">{rels.who_they_call_at_2am}</div>
              </div>
            </div>
            {/* Proposed connections */}
            {rels.proposed_connections?.length > 0 && (
              <div className="cg-proposed-connections">
                <div className="cg-profile-label">Proposed Connections</div>
                {rels.proposed_connections.map((conn, i) => (
                  <div key={i} className="cg-connection">
                    <span className="cg-connection-target">{conn.to_character}</span>
                    <span className="cg-connection-dir">{conn.direction === 'two_way' ? '↔' : '→'}</span>
                    <span className="cg-connection-type">{conn.relationship_type}</span>
                    <span className="cg-connection-note">{conn.from_knows}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Voice</div>
            <div className="cg-profile-grid">
              <div className="cg-profile-field">
                <div className="cg-profile-label">How They Speak</div>
                <div className="cg-profile-value">{voice.how_they_speak}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Never Says Directly</div>
                <div className="cg-profile-value">{voice.what_they_never_say_directly}</div>
              </div>
              <div className="cg-profile-field">
                <div className="cg-profile-label">Their Tell</div>
                <div className="cg-profile-value">{voice.their_tell}</div>
              </div>
              <div className="cg-profile-field cg-field-full">
                <div className="cg-profile-label">Signature Sentence</div>
                <div className="cg-profile-value cg-italic">"{voice.signature_sentence_structure}"</div>
              </div>
            </div>
          </div>

          {/* Plot threads */}
          <div className="cg-profile-section">
            <div className="cg-profile-section-title">Plot Threads</div>
            {threads.map((thread, i) => (
              <div key={i} className="cg-thread">
                <div className="cg-thread-text">{thread.thread}</div>
                <div className="cg-thread-trigger">{thread.activation_condition}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commit actions — simplified to just Discard (batch Add All handles commit) */}
      {!result._committed && (
        <div className="cg-staging-commit">
          <button className="cg-btn cg-btn-discard" onClick={() => onDiscard(result)}>Discard</button>
        </div>
      )}

      {result._committed && (
        <div className="cg-staging-committed">✓ Added to Registry</div>
      )}
    </div>
  );
}

// ─── Main CharacterGenerator ──────────────────────────────────────────────────
export default function CharacterGenerator() {
  const navigate = useNavigate();

  // Ecosystem
  const [ecosystem, setEcosystem]         = useState(null);
  const [ecoLoading, setEcoLoading]       = useState(true);

  // Restore saved session (if any)
  const saved = useRef(loadSession());

  // Seed proposal
  const [worldTarget, setWorldTarget]     = useState(saved.current?.worldTarget || 'book1');
  const [seeds, setSeeds]                 = useState(saved.current?.seeds || []);
  const [seedsLoading, setSeedsLoading]   = useState(false);

  // Batch generation
  const [batch, setBatch]                 = useState(saved.current?.batch || []);
  const [batchLoading, setBatchLoading]   = useState(false);

  // Staging
  const [stagingChecks, setStagingChecks] = useState(saved.current?.stagingChecks || {});
  const [registries, setRegistries]       = useState([]);

  // Phase: 'seeds' | 'staging'
  const [phase, setPhase]                 = useState(saved.current?.phase || 'seeds');
  const [approvalFlash, setApprovalFlash] = useState(false);

  // ── Auto-save to localStorage on meaningful state changes ───────────────────
  useEffect(() => {
    // Only save when there's actual work to preserve
    if (seeds.length > 0 || batch.length > 0) {
      saveSession({ worldTarget, seeds, batch, stagingChecks, phase });
    }
  }, [worldTarget, seeds, batch, stagingChecks, phase]);

  // ── Warn before leaving with unsaved work ───────────────────────────────────
  const hasUnsavedWork = batch.some((r) => r.status === 'generated' && !r._committed);

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);

  // Guard back-button navigation (works with BrowserRouter)
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onPop = () => {
      if (!window.confirm('You have uncommitted characters. Your work is auto-saved — leave anyway?')) {
        window.history.pushState(null, '', window.location.pathname);
      }
    };
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [hasUnsavedWork]);

  // Clear saved session when everything is committed
  useEffect(() => {
    if (batch.length > 0 && batch.every((r) => r._committed)) {
      clearSession();
    }
  }, [batch]);

  // Load ecosystem and registries on mount
  useEffect(() => {
    loadEcosystem();
    loadRegistries();
  }, []);

  async function loadEcosystem() {
    setEcoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/character-generator/ecosystem`);
      if (res.ok) setEcosystem(await res.json());
    } catch { /* silent */ }
    finally { setEcoLoading(false); }
  }

  async function loadRegistries() {
    try {
      const res = await fetch(`${API_BASE}/character-registry/registries`);
      if (res.ok) {
        const data = await res.json();
        setRegistries(data.registries || data || []);
      }
    } catch { /* silent */ }
  }

  // ── Propose seeds ─────────────────────────────────────────────────────────
  async function handleProposeSeeds() {
    setSeedsLoading(true);
    setSeeds([]);
    setBatch([]);
    setPhase('seeds');
    clearSession();
    try {
      const existingNames = [
        ...(ecosystem?.book1?.characters || []),
        ...(ecosystem?.lalaverse?.characters || []),
      ].map((c) => c.name);

      const res = await fetch(`${API_BASE}/character-generator/propose-seeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          world: worldTarget,
          existing_names: existingNames,
          ecosystem_stats: ecosystem,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSeeds((data.seeds || []).map((s) => ({ ...s, _status: 'pending' })));
      }
    } catch (e) {
      console.error('propose seeds error:', e);
    } finally {
      setSeedsLoading(false);
    }
  }

  // ── Seed actions ──────────────────────────────────────────────────────────
  function handleApproveSeed(index) {
    setSeeds((prev) => prev.map((s, i) => i === index ? { ...s, _status: 'approved' } : s));
  }
  function handleRejectSeed(index) {
    setSeeds((prev) => prev.map((s, i) => i === index ? { ...s, _status: 'rejected' } : s));
  }
  function handleEditSeed(index, updated) {
    setSeeds((prev) => prev.map((s, i) => i === index ? { ...updated, _status: 'approved' } : s));
  }
  function handleApproveAll() {
    setSeeds((prev) => prev.map((s) => ({ ...s, _status: 'approved' })));
    // Flash animation on seed cards
    setApprovalFlash(true);
    setTimeout(() => setApprovalFlash(false), 800);
    // Auto-scroll to the generate banner
    setTimeout(() => {
      document.querySelector('.cg-approval-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  // One-click: Approve All → immediately Generate
  function handleApproveAllAndGenerate() {
    const allApproved = seeds.map((s) => ({ ...s, _status: 'approved' }));
    setSeeds(allApproved);
    // Pass approved seeds directly — don’t wait for React state
    handleGenerateBatch(allApproved.filter((s) => s._status === 'approved'));
  }

  // ── Generate batch ──────────────────────────────────────────────────────────────────
  async function handleGenerateBatch(overrideSeeds) {
    const approvedSeeds = overrideSeeds || seeds.filter((s) => s._status === 'approved');
    if (!approvedSeeds.length) return alert('Approve at least one seed first.');

    setBatchLoading(true);
    setBatch([]);
    setPhase('staging');

    try {
      const existingCharacters = [
        ...(ecosystem?.book1?.characters || []),
        ...(ecosystem?.lalaverse?.characters || []),
      ];

      const res = await fetch(`${API_BASE}/character-generator/generate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: approvedSeeds, existingCharacters }),
      });

      if (res.ok) {
        const data = await res.json();
        setBatch(data.batch || []);

        // Run staging checks for all generated characters
        const checks = {};
        await Promise.all((data.batch || []).map(async (result, i) => {
          if (result.status !== 'generated') return;
          try {
            const checkRes = await fetch(`${API_BASE}/character-generator/check-staging`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                character: { ...result.profile, seed: result.seed },
                existingCharacters,
                ecosystemStats: ecosystem,
              }),
            });
            if (checkRes.ok) checks[i] = await checkRes.json();
          } catch { /* silent */ }
        }));

        setStagingChecks(checks);
      }
    } catch (e) {
      console.error('generate batch error:', e);
    } finally {
      setBatchLoading(false);
    }
  }

  // ── Commit to registry ────────────────────────────────────────────────────
  async function handleCommit(result, registryId) {
    try {
      const res = await fetch(`${API_BASE}/character-generator/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: result.profile,
          seed: result.seed,
          registryId,
        }),
      });

      if (res.ok) {
        setBatch((prev) =>
          prev.map((r) => r === result ? { ...r, _committed: true } : r)
        );
        loadEcosystem(); // Refresh ecosystem after commit
      } else {
        const err = await res.json();
        alert('Commit failed: ' + err.error);
      }
    } catch (e) {
      alert('Commit failed: ' + e.message);
    }
  }

  function handleDiscard(result) {
    setBatch((prev) => prev.filter((r) => r !== result));
  }

  // ── Commit ALL staged characters to a registry at once ──────────────────────
  const [commitAllLoading, setCommitAllLoading] = useState(false);

  // Auto-match registry to the world the user already selected
  // Normalize: strip hyphens/spaces for fuzzy match (book1 ↔ book-1, lalaverse ↔ lala-verse)
  const norm = (s) => (s || '').toLowerCase().replace(/[-_\s]/g, '');
  const matchedRegistry = registries.find((r) => norm(r.book_tag) === norm(worldTarget))
    || registries.find((r) => norm(r.title).includes(norm(worldTarget)))
    || registries[0];

  async function handleCommitAll() {
    const regId = matchedRegistry?.id;
    if (!regId) return alert('No registry found for this world.');

    const pending = batch.filter((r) => r.status === 'generated' && !r._committed);
    if (!pending.length) return;

    setCommitAllLoading(true);
    let ok = 0;
    for (const result of pending) {
      try {
        const res = await fetch(`${API_BASE}/character-generator/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: result.profile,
            seed: result.seed,
            registryId: regId,
          }),
        });
        if (res.ok) {
          setBatch((prev) =>
            prev.map((r) => r === result ? { ...r, _committed: true } : r)
          );
          ok++;
        }
      } catch { /* continue */ }
    }
    loadEcosystem();
    setCommitAllLoading(false);
    if (ok === pending.length) {
      alert(`✓ All ${ok} characters added to registry!`);
    } else {
      alert(`${ok}/${pending.length} characters committed. Some failed.`);
    }
  }

  const approvedCount = seeds.filter((s) => s._status === 'approved').length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="cg-page">

      {/* Navigation guard handled via popstate + beforeunload; data auto-saved to localStorage */}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="cg-header">
        <button className="cg-btn-back" onClick={() => navigate('/character-registry')}>
          ← Registry
        </button>
        <div className="cg-header-title">Character Generator</div>
        <div className="cg-step-indicator">
          <span className={`cg-step${phase === 'seeds' && seeds.length === 0 ? ' cg-step-active' : (seeds.length > 0 || phase === 'staging') ? ' cg-step-done' : ''}`}>
            <span className="cg-step-num">1</span> Propose
          </span>
          <span className="cg-step-arrow">→</span>
          <span className={`cg-step${phase === 'seeds' && seeds.length > 0 ? ' cg-step-active' : phase === 'staging' ? ' cg-step-done' : ''}`}>
            <span className="cg-step-num">2</span> Approve & Generate
          </span>
          <span className="cg-step-arrow">→</span>
          <span className={`cg-step${phase === 'staging' && batch.some(r => !r._committed) ? ' cg-step-active' : batch.every(r => r._committed) && batch.length > 0 ? ' cg-step-done' : ''}`}>
            <span className="cg-step-num">3</span> Commit to Registry
          </span>
        </div>

        <div className="cg-header-controls">
          <select
            className="cg-world-select"
            value={worldTarget}
            onChange={(e) => setWorldTarget(e.target.value)}
          >
            <option value="book1">Book 1 World</option>
            <option value="lalaverse">LalaVerse</option>
            <option value="both">Both Worlds</option>
          </select>
          <button
            className="cg-btn cg-btn-propose"
            onClick={handleProposeSeeds}
            disabled={seedsLoading}
          >
            {seedsLoading ? '…' : 'Propose 10 Seeds'}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="cg-body">

        {/* Left: ecosystem */}
        <div className="cg-left">
          <div className="cg-panel-title">World Ecosystem</div>
          <EcosystemPanel ecosystem={ecosystem} loading={ecoLoading} />
        </div>

        {/* Right: seeds or staging */}
        <div className="cg-right">

          {/* Seeds phase */}
          {phase === 'seeds' && (
            <>
              <div className="cg-phase-header">
                <div className="cg-panel-title">
                  Proposed Seeds
                  {seeds.length > 0 && (
                    <span className="cg-seed-count">
                      {approvedCount} of {seeds.length} approved
                    </span>
                  )}
                </div>
                {seeds.length > 0 && (
                  <div className="cg-phase-actions">
                    <button className="cg-btn cg-btn-approve-all" onClick={handleApproveAllAndGenerate}
                      disabled={batchLoading}
                    >
                      {batchLoading ? 'Generating…' : 'Approve All & Generate'}
                    </button>
                    {approvedCount > 0 && approvedCount < seeds.length && (
                      <button
                        className="cg-btn cg-btn-generate"
                        onClick={handleGenerateBatch}
                        disabled={approvedCount === 0 || batchLoading}
                      >
                        {batchLoading ? 'Generating…' : `Generate ${approvedCount}`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {seedsLoading && (
                <div className="cg-loading-state">
                  <div className="cg-spinner-large" />
                  <div>Proposing seeds for {WORLD_LABELS[worldTarget] || worldTarget}…</div>
                </div>
              )}

              {!seedsLoading && seeds.length === 0 && (
                <div className="cg-empty-state">
                  <div className="cg-empty-icon">◎</div>
                  <div>Select a world and click "Propose 10 Seeds" to begin.</div>
                </div>
              )}

              {/* Next-step banner when seeds approved but not yet generated */}
              {approvedCount > 0 && !batchLoading && (
                <div className="cg-approval-banner">
                  <span>✓ {approvedCount} seed{approvedCount > 1 ? 's' : ''} approved — ready to generate full profiles</span>
                  <button
                    className="cg-btn cg-btn-generate"
                    onClick={handleGenerateBatch}
                  >
                    Generate {approvedCount} Character{approvedCount > 1 ? 's' : ''}
                  </button>
                </div>
              )}

              <div className={`cg-seeds-grid${approvalFlash ? ' cg-flash' : ''}`}>
                {seeds.map((seed, i) => (
                  <SeedCard
                    key={i}
                    seed={seed}
                    index={i}
                    onApprove={handleApproveSeed}
                    onReject={handleRejectSeed}
                    onEdit={handleEditSeed}
                  />
                ))}
              </div>
            </>
          )}

          {/* Staging phase */}
          {phase === 'staging' && (
            <>
              <div className="cg-phase-header">
                <div className="cg-panel-title">
                  Staging Area
                  <span className="cg-seed-count">
                    {batch.filter((r) => r._committed).length} committed · {batch.filter((r) => !r._committed).length} pending
                  </span>
                </div>
                <button
                  className="cg-btn cg-btn-propose"
                  onClick={() => setPhase('seeds')}
                >
                  ← Back to Seeds
                </button>
              </div>

              {batchLoading && (
                <div className="cg-loading-state">
                  <div className="cg-spinner-large" />
                  <div>Building {approvedCount} characters simultaneously…</div>
                  <div className="cg-loading-sub">Full profiles generating in parallel.</div>
                </div>
              )}

              {/* Guidance + Batch commit banner */}
              {!batchLoading && batch.filter((r) => r.status === 'generated' && !r._committed).length > 0 && (
                <div className="cg-staging-guidance">
                  <div className="cg-guidance-steps">
                    <div className="cg-guidance-step">
                      <span className="cg-guidance-icon">▼</span>
                      <span>Click any character to <strong>expand their full profile</strong> — psychology, voice, dilemmas, relationships</span>
                    </div>
                    <div className="cg-guidance-step">
                      <span className="cg-guidance-icon">✗</span>
                      <span>Click <strong>Discard</strong> to remove characters you don't want</span>
                    </div>
                    <div className="cg-guidance-step">
                      <span className="cg-guidance-icon">↓</span>
                      <span>When ready, click the button below to <strong>add them all at once</strong></span>
                    </div>
                  </div>

                  <div className="cg-commit-all-banner">
                    <div className="cg-commit-all-ready">
                      <strong>{batch.filter((r) => r.status === 'generated' && !r._committed).length}</strong> characters ready
                      {matchedRegistry && <span className="cg-commit-target"> → {matchedRegistry.title || matchedRegistry.name}</span>}
                    </div>
                    <button
                      className="cg-btn cg-btn-commit-all"
                      onClick={handleCommitAll}
                      disabled={commitAllLoading}
                    >
                      {commitAllLoading ? 'Committing…' : `Add All to Registry`}
                    </button>
                  </div>
                </div>
              )}

              {/* All committed */}
              {!batchLoading && batch.length > 0 && batch.every((r) => r._committed) && (
                <div className="cg-all-committed-banner">
                  <div className="cg-all-committed-icon">✓</div>
                  <div className="cg-all-committed-text">All characters added to registry!</div>
                  <div className="cg-all-committed-actions">
                    <button className="cg-btn cg-btn-propose" onClick={() => { setPhase('seeds'); setSeeds([]); setBatch([]); }}>
                      Generate More
                    </button>
                    <button className="cg-btn cg-btn-generate" onClick={() => navigate('/character-registry')}>
                      View Registry →
                    </button>
                  </div>
                </div>
              )}

              <div className="cg-staging-list">
                {batch.map((result, i) => (
                  <StagingCard
                    key={i}
                    result={result}
                    checks={stagingChecks[i]}
                    onCommit={handleCommit}
                    onDiscard={handleDiscard}
                    registries={registries}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
