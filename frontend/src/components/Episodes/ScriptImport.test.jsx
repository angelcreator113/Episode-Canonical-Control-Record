/**
 * Import a script (ScriptImport; Evoni, 2026-10-25) and the "Ready to
 * film?" tips (ScriptHealthPanel, lib/scriptPacing).
 */
import { vi, describe, test, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScriptImport from './ScriptImport';
import ScriptHealthPanel from './ScriptHealthPanel';

afterEach(() => { vi.restoreAllMocks(); });

const look = [{ id: 'w-102', name: 'Pink Satin Gown' }];

describe('ScriptImport', () => {
  test('previews the converted script and what it could not convert', () => {
    render(<ScriptImport scriptText="" look={look} onImport={() => {}} />);
    fireEvent.click(screen.getByTestId('script-import'));
    fireEvent.change(screen.getByTestId('script-import-paste'), { target: { value: 'BEAT 8 — Closet\nPRIME: Let us dress.\n[GAME: EQUIP Pink Satin Gown]\n[GAME: EQUIP Fur Coat]' } });
    expect(screen.getByTestId('script-import-preview').textContent).toBe('## BEAT: 8 · Closet\nPrime: Let us dress.\n[WEAR: w-102]\n[GAME: EQUIP Fur Coat]');
    expect(screen.getByText(/I couldn't convert these/)).toBeTruthy();
    expect(screen.getAllByTestId('script-import-note')).toHaveLength(1);
    expect(screen.getByTestId('script-import-summary').textContent).toMatch(/1 beat · 1 spoken line · 1 outfit piece matched/);
  });

  test('uses the script when there is none, and closes', () => {
    const onImport = vi.fn();
    render(<ScriptImport scriptText="" onImport={onImport} />);
    fireEvent.click(screen.getByTestId('script-import'));
    fireEvent.change(screen.getByTestId('script-import-paste'), { target: { value: 'Beat 1: Hi\nLALA: hey' } });
    expect(screen.queryByTestId('script-import-append')).toBeNull();
    fireEvent.click(screen.getByTestId('script-import-replace'));
    expect(onImport).toHaveBeenCalledWith('## BEAT: 1 · Hi\nLala: hey', 'replace');
    expect(screen.queryByTestId('script-import-panel')).toBeNull();
  });

  test('adds to the end, or replaces after asking', () => {
    const onImport = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ScriptImport scriptText={'## BEAT: 1\nMe: old'} approvedCount={1} onImport={onImport} />);
    fireEvent.click(screen.getByTestId('script-import'));
    fireEvent.change(screen.getByTestId('script-import-paste'), { target: { value: 'BEAT 2\nME: new' } });
    expect(screen.getByTestId('script-import-approved').textContent).toMatch(/1 approved beat stays/);
    fireEvent.click(screen.getByTestId('script-import-replace'));
    expect(confirm).toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('script-import-append'));
    expect(onImport).toHaveBeenCalledWith('## BEAT: 1\nMe: old\n\n## BEAT: 2\nMe: new', 'append');
  });

  test('Escape closes it', () => {
    render(<ScriptImport scriptText="" onImport={() => {}} />);
    fireEvent.click(screen.getByTestId('script-import'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('script-import-panel')).toBeNull();
  });
});

describe('ScriptHealthPanel tips', () => {
  test('counts tips apart from things to check and lists the time per beat', () => {
    const rows = [
      { key: 'beats', ok: true, beatId: null, text: 'All beats.' },
      { key: 'writer-note-beat-1-2', ok: false, beatId: 'beat-1', text: 'Beat 1, line 2: a note.' },
      { key: 'pacing', ok: false, advice: true, beatId: null, text: 'Rough running time: ~1m.', timings: [{ beatId: 'beat-1', number: 1, name: 'Opening Ritual', seconds: 40, label: '~40s' }, { beatId: 'beat-2', number: 2, name: 'Login', seconds: 20, label: '~20s' }] },
      { key: 'pacing-hook', ok: false, advice: true, beatId: 'beat-1', text: 'Beat 1 (the hook) talks for about 40 seconds.' },
    ];
    render(<ScriptHealthPanel rows={rows} beatNumbers={{ 'beat-1': 1 }} onOpenBeat={() => {}} />);
    expect(screen.getByTestId('script-health-sum').textContent).toBe('1 to check · 2 tips');
    fireEvent.click(screen.getByTestId('script-health-toggle'));
    expect(screen.getByTestId('script-health-pacing-hook').className).toBe('is-tip');
    expect(screen.getAllByTestId('script-pacing-row').map((r) => r.textContent)).toEqual(['Beat 1 · Opening Ritual~40s', 'Beat 2 · Login~20s']);
    expect(screen.getByTestId('script-health-open-writer-note-beat-1-2').textContent).toBe('Open beat 1');
  });
});
