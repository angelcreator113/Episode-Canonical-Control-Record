/**
 * Your voice (Evoni, 2026-10-25, character voices that learn): her own
 * learned voice. JustAWoman (Me, Prime, JAWIHP in a script) is the show's
 * narrator and the memoir's author, not a registry character, so her voice
 * has this page: reached from the Character Registry's "Your voice" card and
 * from the show's cast (Producer Mode). One voice for the book and the show.
 */
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import LearnedVoice from '../components/LearnedVoice/LearnedVoice';
import { HER_KEY } from '../lib/characterVoice';
import './YourVoicePage.css';

export default function YourVoicePage() {
  return (
    <div className="yv-page" data-testid="your-voice-page">
      <Link className="yv-back" to="/character-registry"><ChevronLeft size={16} aria-hidden="true" /> The Cast</Link>
      <header className="yv-head">
        <p className="yv-kicker">JustAWoman</p>
        <h1 className="yv-title">Your voice</h1>
        <p className="yv-note">Your narration in the book, your gameplay and cutscene lines in the show: how you really sound, and what the writing has learned from your edits.</p>
      </header>
      <LearnedVoice characterKey={HER_KEY} name="JustAWoman" you />
    </div>
  );
}
