/**
 * The export job's settings as the video worker reads them (production
 * system audit, 2026-10-26, §A9).
 *
 * The export route queues `platform` as a key ('youtube'), the chosen size
 * as `resolution` ('1280x720') and the timeline row as `timelineData`. The
 * worker drew from `platform.width/height` and `timeline`, so every export
 * came out 1920x1080 and the timeline never reached it. This is the one
 * place the two shapes meet; the route's payload, and the status and list
 * responses that echo it, are unchanged.
 *
 * It only carries the data across. It does not make keyframes render: the
 * editor's keyframes carry no sceneId/elementId, which the renderer filters
 * on.
 *
 * Now that the size reaches FFmpeg, it is made one the encoder takes:
 * libx264 with yuv420p refuses an odd width or height (the route's twitter
 * size is 1200x675), so each side is rounded down to even; a side outside
 * 16..7680 is not a size, and the job falls back to 1920x1080.
 */

const DEFAULT_SIZE = { width: 1920, height: 1080 };
const MIN_SIDE = 16;
const MAX_SIDE = 7680;

// Even, and within bounds, or null.
function encoderSize(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (![w, h].every((n) => Number.isInteger(n) && n >= MIN_SIDE && n <= MAX_SIDE)) return null;
  return { width: w - (w % 2), height: h - (h % 2) };
}

function parseResolution(resolution) {
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(String(resolution || '').trim());
  if (!match) return null;
  return encoderSize(parseInt(match[1], 10), parseInt(match[2], 10));
}

function readExportJob(data = {}) {
  const given = data.platform;
  const key = typeof given === 'string' ? given : given?.platform || null;
  const size = (given && typeof given === 'object' && encoderSize(given.width, given.height))
    || parseResolution(data.resolution) || DEFAULT_SIZE;

  return {
    platform: { platform: key, ...size },
    timeline: data.timeline || data.timelineData || null,
  };
}

module.exports = { readExportJob, parseResolution };
