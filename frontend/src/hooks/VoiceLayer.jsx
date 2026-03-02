/**
 * VoiceLayer.jsx — Stub (voice interview feature removed)
 * Exports empty components to prevent import errors in SceneInterview etc.
 */
export function useVoice() {
  return { listening: false, transcript: '', start: () => {}, stop: () => {}, speak: () => {} };
}
export function MicButton() { return null; }
export function SpeakButton() { return null; }
export default { useVoice, MicButton, SpeakButton };
