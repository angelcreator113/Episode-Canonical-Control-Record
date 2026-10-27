/**
 * A teleprompter take to this device (Teleprompter audit 1 and 6, Evoni,
 * 2026-10-24): "Download the take" saves the file; where the browser can
 * share files (an iPhone: Save to Files or Save Video to Photos), "Save to
 * Photos or Files" opens the share sheet. Neither forgets the take: it stays
 * in the review until she is done with it. Pure DOM, no React.
 */
import { takeStamp } from './teleprompterLines';

/**
 * "Beat 8 - Transformation Loop - take 2 - 2026-10-27 14-58.mp4": a take's
 * name as a file name, with when it was recorded (`at`) so two downloads
 * never share a name (Evoni, 2026-10-27).
 */
export function takeFileName(label, ext, at = null) {
  const base = String(label || 'Teleprompter take').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s*·\s*/g, ' - ').trim() || 'Teleprompter take';
  const stamp = at != null ? takeStamp(at) : null;
  return `${base}${stamp ? ` - ${stamp}` : ''}.${ext || 'mp4'}`;
}

/** The take as a File named `name`, or null when it can't be made. */
export function takeAsFile(blob, name, type) {
  try {
    return new File([blob], name, { type: type || blob?.type || 'video/mp4' });
  } catch (err) {
    console.error('[takeFile] file not made:', err);
    return null;
  }
}

/** Whether this browser can share the take as a file (iPhone, Android). */
export function canShareTake(file, nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    return !!(file && nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] }));
  } catch (err) {
    console.error('[takeFile] canShare failed:', err);
    return false;
  }
}

/**
 * Starts a download of the blob as `name`; the URL made for it goes a moment
 * later (the take's own review URL is never touched). True when started.
 */
export function downloadBlob(blob, name) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (err) { console.error('[takeFile] download URL not revoked:', err); }
    }, 60000);
    return true;
  } catch (err) {
    console.error('[takeFile] download failed:', err);
    return false;
  }
}

/**
 * The share sheet with the take: 'shared', 'cancelled' (she closed it), or
 * 'failed' (logged; the caller offers the download instead).
 */
export async function shareTake(file, title, nav = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    await nav.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('[takeFile] share closed without saving');
      return 'cancelled';
    }
    console.error('[takeFile] share failed:', err);
    return 'failed';
  }
}
