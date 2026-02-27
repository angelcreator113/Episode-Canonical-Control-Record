/**
 * Wardrobe Assignment Modal
 * Assign wardrobe item to an episode OR a book scene
 *
 * Tab 1: Show Episode — original flow (assignToEpisode)
 * Tab 2: Book Scene  — new flow (assign-content → chapter/line)
 */

import React, { useState, useEffect } from 'react';
import wardrobeLibraryService from '../services/wardrobeLibraryService';
import { API_URL } from '../config/api';
import LoadingSpinner from './LoadingSpinner';
import './WardrobeAssignmentModal.css';

const NARRATIVE_FUNCTIONS = [
  { value: 'establishes_status',  label: 'Establishes status' },
  { value: 'marks_transition',    label: 'Marks a transition' },
  { value: 'reveals_interior',    label: 'Reveals interior state' },
  { value: 'continuity_anchor',   label: 'Continuity anchor (referenced across scenes)' },
  { value: 'brand_moment',        label: 'Brand moment (the piece is the point)' },
];

const WardrobeAssignmentModal = ({ item, onClose, onSuccess, defaultTab = 'episode' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ── Episode Tab state ── */
  const [episodes, setEpisodes] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [episodeForm, setEpisodeForm] = useState({
    episode_id: '',
    scene_id: '',
    character: item.character || '',
    occasion: item.occasion || '',
    season: item.season || '',
    notes: '',
  });

  /* ── Book Scene Tab state ── */
  const [books, setBooks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [chapterLines, setChapterLines] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [bookForm, setBookForm] = useState({
    scope: 'chapter',       // 'chapter' | 'line'
    book_id: '',
    chapter_id: '',
    line_id: '',
    character_id: '',
    character_name: '',
    scene_context: '',
    narrative_function: '',
    auto_trigger_press: false,
  });

  /* ── Load episodes on mount ── */
  useEffect(() => { loadEpisodes(); loadCharacters(); }, []);

  useEffect(() => {
    if (episodeForm.episode_id) loadScenes(episodeForm.episode_id);
    else setScenes([]);
  }, [episodeForm.episode_id]);

  /* ── Load books (for Book Scene tab) ── */
  useEffect(() => {
    if (activeTab === 'book' && books.length === 0) loadBooks();
  }, [activeTab]);

  /* ── Load chapters when book selected ── */
  useEffect(() => {
    if (bookForm.book_id) loadChapters(bookForm.book_id);
    else { setChapters([]); setChapterLines([]); }
  }, [bookForm.book_id]);

  /* ── Load lines when chapter selected ── */
  useEffect(() => {
    if (bookForm.chapter_id) loadLines(bookForm.chapter_id);
    else setChapterLines([]);
  }, [bookForm.chapter_id]);

  /* ── Fetchers ── */
  const loadEpisodes = async () => {
    try {
      const r = await fetch(`${API_URL}/episodes`);
      if (r.ok) { const d = await r.json(); setEpisodes(d.data || []); }
    } catch (err) { console.error('Error loading episodes:', err); }
  };

  const loadScenes = async (episodeId) => {
    try {
      const r = await fetch(`${API_URL}/episodes/${episodeId}/scenes`);
      if (r.ok) { const d = await r.json(); setScenes(d.data || []); }
    } catch (err) { console.error('Error loading scenes:', err); setScenes([]); }
  };

  const loadBooks = async () => {
    try {
      const r = await fetch(`${API_URL}/storyteller/books`);
      if (r.ok) { const d = await r.json(); setBooks(d.books || d.data || []); }
    } catch (err) { console.error('Error loading books:', err); }
  };

  const loadChapters = async (bookId) => {
    try {
      const r = await fetch(`${API_URL}/storyteller/books/${bookId}/chapters`);
      if (r.ok) { const d = await r.json(); setChapters(d.chapters || d.data || []); }
    } catch (err) { console.error('Error loading chapters:', err); setChapters([]); }
  };

  const loadLines = async (chapterId) => {
    try {
      const r = await fetch(`${API_URL}/storyteller/chapters/${chapterId}/lines`);
      if (r.ok) { const d = await r.json(); setChapterLines(d.lines || d.data || []); }
    } catch (err) { console.error('Error loading lines:', err); setChapterLines([]); }
  };

  const loadCharacters = async () => {
    try {
      const r = await fetch(`${API_URL}/character-registry/characters`);
      if (r.ok) { const d = await r.json(); setCharacters(d.characters || d.data || []); }
    } catch (err) { console.error('Error loading characters:', err); }
  };

  /* ── Handlers ── */
  const handleEpisodeChange = (e) => {
    const { name, value } = e.target;
    setEpisodeForm(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleBookChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBookForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError(null);
  };

  const handleCharacterSelect = (e) => {
    const charId = e.target.value;
    const char = characters.find(c => c.id === charId);
    setBookForm(prev => ({
      ...prev,
      character_id: charId,
      character_name: char ? char.name : '',
    }));
    setError(null);
  };

  /* ── Submit: Episode Tab ── */
  const handleEpisodeSubmit = async (e) => {
    e.preventDefault();
    if (!episodeForm.episode_id) { setError('Please select an episode'); return; }
    try {
      setLoading(true); setError(null);
      const assignmentData = {
        episode_id: episodeForm.episode_id,
        ...(episodeForm.scene_id && { scene_id: episodeForm.scene_id }),
        ...(episodeForm.character && { character: episodeForm.character }),
        ...(episodeForm.occasion && { occasion: episodeForm.occasion }),
        ...(episodeForm.season && { season: episodeForm.season }),
        ...(episodeForm.notes && { notes: episodeForm.notes }),
      };
      await wardrobeLibraryService.assignToEpisode(item.id, assignmentData);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error assigning item:', err);
      setError(err.message || 'Failed to assign item');
      setLoading(false);
    }
  };

  /* ── Submit: Book Scene Tab ── */
  const handleBookSubmit = async (e) => {
    e.preventDefault();
    if (!bookForm.chapter_id) { setError('Please select a chapter'); return; }
    if (bookForm.scope === 'line' && !bookForm.line_id) { setError('Please select a line'); return; }

    try {
      setLoading(true); setError(null);
      const content_type = bookForm.scope === 'line' ? 'scene_line' : 'chapter';
      const content_id   = bookForm.scope === 'line' ? bookForm.line_id : bookForm.chapter_id;

      const body = {
        content_type,
        content_id,
        scene_context:      bookForm.scene_context      || null,
        character_id:       bookForm.character_id       || null,
        character_name:     bookForm.character_name     || null,
        narrative_function: bookForm.narrative_function || null,
        auto_trigger_press: bookForm.auto_trigger_press,
      };

      const r = await fetch(`${API_URL}/wardrobe-library/${item.id}/assign-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Assignment failed');
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error assigning item to book:', err);
      setError(err.message || 'Failed to assign item');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="assignment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Assign Wardrobe</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        {/* ── Tabs ── */}
        <div className="assignment-tabs">
          <button
            className={`assignment-tab${activeTab === 'episode' ? ' active' : ''}`}
            onClick={() => { setActiveTab('episode'); setError(null); }}
          >
            Show Episode
          </button>
          <button
            className={`assignment-tab${activeTab === 'book' ? ' active' : ''}`}
            onClick={() => { setActiveTab('book'); setError(null); }}
          >
            Book Scene
          </button>
        </div>

        {/* ── Error ── */}
        {error && <div className="error-message" style={{ margin: '0 20px' }}>{error}</div>}

        {/* ── Item Preview ── */}
        <div className="modal-body" style={{ paddingBottom: 0 }}>
          <div className="item-preview">
            <img src={item.image_url || '/placeholder-wardrobe.png'} alt={item.name} />
            <div className="preview-info">
              <h3>{item.name}</h3>
              {item.item_type && <span className="item-type">{item.item_type}</span>}
              {item.brand && <span className="item-type" style={{ marginLeft: 6 }}>{item.brand}</span>}
            </div>
          </div>
        </div>

        {/* ════════════ TAB 1: Show Episode ════════════ */}
        {activeTab === 'episode' && (
          <form onSubmit={handleEpisodeSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label>Episode *</label>
                <select name="episode_id" value={episodeForm.episode_id} onChange={handleEpisodeChange} required>
                  <option value="">Select episode...</option>
                  {episodes.map(ep => (
                    <option key={ep.id} value={ep.id}>{ep.title || `Episode ${ep.episode_number}`}</option>
                  ))}
                </select>
              </div>

              {scenes.length > 0 && (
                <div className="form-group">
                  <label>Scene (Optional)</label>
                  <select name="scene_id" value={episodeForm.scene_id} onChange={handleEpisodeChange}>
                    <option value="">No specific scene</option>
                    {scenes.map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.name || `Scene ${sc.scene_number}`}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-section">
                <h3>Override Metadata</h3>
                <p className="help-text">Override item metadata for this specific episode assignment</p>
                <div className="form-group">
                  <label>Character</label>
                  <input type="text" name="character" value={episodeForm.character} onChange={handleEpisodeChange} placeholder="Character name" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Occasion</label>
                    <select name="occasion" value={episodeForm.occasion} onChange={handleEpisodeChange}>
                      <option value="">Select...</option>
                      <option value="casual">Casual</option>
                      <option value="formal">Formal</option>
                      <option value="business">Business</option>
                      <option value="party">Party</option>
                      <option value="athletic">Athletic</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Season</label>
                    <select name="season" value={episodeForm.season} onChange={handleEpisodeChange}>
                      <option value="">Select...</option>
                      <option value="spring">Spring</option>
                      <option value="summer">Summer</option>
                      <option value="fall">Fall</option>
                      <option value="winter">Winter</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea name="notes" value={episodeForm.notes} onChange={handleEpisodeChange} placeholder="Any additional notes for this assignment..." rows="3" />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><LoadingSpinner size="small" /> Assigning...</> : 'Assign to Episode'}
              </button>
            </div>
          </form>
        )}

        {/* ════════════ TAB 2: Book Scene ════════════ */}
        {activeTab === 'book' && (
          <form onSubmit={handleBookSubmit}>
            <div className="modal-body">
              {/* Scope — whole chapter or specific line */}
              <div className="form-group">
                <label>Where does this piece appear?</label>
                <select name="scope" value={bookForm.scope} onChange={handleBookChange}>
                  <option value="chapter">Whole chapter</option>
                  <option value="line">Specific line</option>
                </select>
              </div>

              {/* Book */}
              <div className="form-group">
                <label>Book *</label>
                <select name="book_id" value={bookForm.book_id} onChange={handleBookChange} required>
                  <option value="">Select book...</option>
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>

              {/* Chapter */}
              {bookForm.book_id && (
                <div className="form-group">
                  <label>Chapter *</label>
                  <select name="chapter_id" value={bookForm.chapter_id} onChange={handleBookChange} required>
                    <option value="">Select chapter...</option>
                    {chapters.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.title || `Chapter ${ch.order || ch.chapter_number || ''}`}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Line (only when scope = line) */}
              {bookForm.scope === 'line' && bookForm.chapter_id && (
                <div className="form-group">
                  <label>Line *</label>
                  <select name="line_id" value={bookForm.line_id} onChange={handleBookChange} required>
                    <option value="">Select line...</option>
                    {chapterLines.map((ln, i) => (
                      <option key={ln.id} value={ln.id}>
                        {`Line ${i + 1}: ${(ln.content || '').slice(0, 60)}${(ln.content || '').length > 60 ? '…' : ''}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Character */}
              <div className="form-group">
                <label>Character wearing it</label>
                <select value={bookForm.character_id} onChange={handleCharacterSelect}>
                  <option value="">Select character...</option>
                  {characters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Scene context */}
              <div className="form-group">
                <label>What is this piece doing in the scene?</label>
                <textarea
                  name="scene_context"
                  value={bookForm.scene_context}
                  onChange={handleBookChange}
                  placeholder="Describe what the piece is doing in this moment..."
                  rows="3"
                />
              </div>

              {/* Narrative function */}
              <div className="form-group">
                <label>Narrative function</label>
                <select name="narrative_function" value={bookForm.narrative_function} onChange={handleBookChange}>
                  <option value="">Select...</option>
                  {NARRATIVE_FUNCTIONS.map(nf => (
                    <option key={nf.value} value={nf.value}>{nf.label}</option>
                  ))}
                </select>
              </div>

              {/* Press notification checkbox */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="auto_trigger_press"
                  name="auto_trigger_press"
                  checked={bookForm.auto_trigger_press}
                  onChange={handleBookChange}
                />
                <label htmlFor="auto_trigger_press" style={{ margin: 0, fontWeight: 400 }}>
                  Notify Press if this piece has a brand attached
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><LoadingSpinner size="small" /> Assigning...</> : 'Assign to Book Scene'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default WardrobeAssignmentModal;
