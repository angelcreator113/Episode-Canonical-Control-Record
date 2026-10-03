import { describe, test, expect } from 'vitest';
import { sceneSetPath, sceneSetsPath, isAppPath } from './sceneSets';

describe('Scene Sets hand-off paths', () => {
  test('a set, and a show\'s sets with no set chosen, with the same way back', () => {
    expect(sceneSetPath('s1', 'set-1')).toBe('/shows/s1/world?tab=scene-sets&set=set-1');
    expect(sceneSetPath('s1', 'set-1', { zone: 'entrance', from: '/episodes/e1?tab=assets', fromLabel: 'Gala', need: 'Entrance angle' }))
      .toBe('/shows/s1/world?tab=scene-sets&set=set-1&zone=entrance&from=%2Fepisodes%2Fe1%3Ftab%3Dassets&fromLabel=Gala&need=Entrance%20angle');
    expect(sceneSetsPath('s1')).toBe('/shows/s1/world?tab=scene-sets');
    expect(sceneSetsPath('s1', { from: '/episodes/e1?tab=checklist', fromLabel: 'Gala' }))
      .toBe('/shows/s1/world?tab=scene-sets&from=%2Fepisodes%2Fe1%3Ftab%3Dchecklist&fromLabel=Gala');
    // need is capped at 140 characters.
    expect(sceneSetsPath('s1', { need: 'x'.repeat(200) })).toBe(`/shows/s1/world?tab=scene-sets&need=${'x'.repeat(140)}`);
  });

  test('a way back stays in this app', () => {
    expect(isAppPath('/episodes/e1')).toBe(true);
    expect(isAppPath('//evil.example')).toBe(false);
    expect(isAppPath('https://evil.example')).toBe(false);
  });
});
