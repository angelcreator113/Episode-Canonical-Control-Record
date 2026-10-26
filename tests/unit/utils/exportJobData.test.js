const { readExportJob, parseResolution } = require('../../../src/utils/exportJobData');

describe('readExportJob', () => {
  test('the size comes from the resolution the route chose', () => {
    expect(readExportJob({ platform: 'youtube', resolution: '1280x720' }).platform)
      .toEqual({ platform: 'youtube', width: 1280, height: 720 });
  });

  test('the timeline comes from the route\'s timelineData', () => {
    const timelineData = { keyframes: [{ time: 0 }], audio_clips: [] };
    expect(readExportJob({ timelineData }).timeline).toBe(timelineData);
  });

  test('a job already shaped for the worker is read as it is', () => {
    const timeline = { keyframes: [] };
    expect(readExportJob({ platform: { platform: 'square', width: 1080, height: 1080 }, timeline }))
      .toEqual({ platform: { platform: 'square', width: 1080, height: 1080 }, timeline });
  });

  test('no usable size falls back to 1920x1080, and no timeline to null', () => {
    expect(readExportJob({ platform: 'youtube', resolution: 'big' }))
      .toEqual({ platform: { platform: 'youtube', width: 1920, height: 1080 }, timeline: null });
    expect(readExportJob().platform).toEqual({ platform: null, width: 1920, height: 1080 });
  });

  test('parseResolution reads WIDTHxHEIGHT only', () => {
    expect(parseResolution('3840x2160')).toEqual({ width: 3840, height: 2160 });
    expect(parseResolution('1920 x 1080')).toBeNull();
    expect(parseResolution(undefined)).toBeNull();
  });

  test('every size the Export page offers reaches the worker as it is', () => {
    for (const [w, h] of [[3840, 2160], [1920, 1080], [1280, 720], [854, 480]]) {
      expect(readExportJob({ platform: 'youtube', resolution: `${w}x${h}` }).platform).toEqual({ platform: 'youtube', width: w, height: h });
    }
  });

  test('an odd side is rounded down to even, as libx264 with yuv420p needs', () => {
    // The route's twitter size, reached when the quality is not a preset.
    expect(readExportJob({ platform: 'twitter', resolution: '1200x675' }).platform).toEqual({ platform: 'twitter', width: 1200, height: 674 });
    expect(readExportJob({ platform: { platform: 'x', width: 1081, height: 1921 } }).platform).toEqual({ platform: 'x', width: 1080, height: 1920 });
  });

  test('a side out of bounds is not a size: 1920x1080', () => {
    for (const resolution of ['99999x1080', '1920x99999', '10x10', '0x0']) {
      expect(readExportJob({ platform: 'youtube', resolution }).platform).toEqual({ platform: 'youtube', width: 1920, height: 1080 });
    }
    expect(readExportJob({ platform: { platform: 'x', width: 1.5, height: 'big' } }).platform).toEqual({ platform: 'x', width: 1920, height: 1080 });
  });
});
