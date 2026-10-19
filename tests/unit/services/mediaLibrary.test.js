/**
 * Visual Memory, phase 1 (services/mediaLibrary): who sees which picture,
 * what a tag may be, and that the library never writes outside its own two
 * tables ("visual asset ≠ story fact").
 */
const fs = require('fs');
const path = require('path');
const media = require('../../../src/services/mediaLibrary');

describe('mediaLibrary', () => {
  test('a public reader (feeds, The Pulse) sees only approved, public pictures', () => {
    const w = media.visibilityWhere('public');
    expect(w).toContain("ma.status = 'approved'");
    expect(w).toContain("ma.visibility = 'public'");
    expect(w).toContain('ma.deleted_at IS NULL');
    expect(media.visibilityWhere(undefined)).toBe(w);
  });

  test('a signed-in reader who is not ADMIN sees approved pictures that are not private; an ADMIN sees every live one', () => {
    expect(media.visibilityWhere('member', 'x')).toBe("x.deleted_at IS NULL AND x.status = 'approved' AND x.visibility IN ('internal', 'public')");
    expect(media.visibilityWhere('admin', 'x')).toBe('x.deleted_at IS NULL');
    expect(media.audienceOf({ groups: ['Admin'] })).toBe('admin');
    expect(media.audienceOf({ groups: ['USER'] })).toBe('member');
    expect(media.audienceOf(null)).toBe('member');
  });

  test('a tag is a known kind, a real-looking id and a known role', () => {
    const id = '0b5f8d2e-3c1a-4d6e-9f00-112233445566';
    expect(media.normalizeLink({ entity_type: 'character', entity_id: id })).toEqual({ entity_type: 'character', entity_id: id, role: 'pictured' });
    expect(media.normalizeLink({ entity_type: 'scene_set', entity_id: id, role: 'location' }).role).toBe('location');
    expect(() => media.normalizeLink({ entity_type: 'planet', entity_id: id })).toThrow(/entity_type/);
    expect(() => media.normalizeLink({ entity_type: 'character', entity_id: 'drop table' })).toThrow(/not a character id/);
    expect(() => media.normalizeLink({ entity_type: 'event', entity_id: id, role: 'star' })).toThrow(/role/);
  });

  test('details keep only the known keys, as short text or lists', () => {
    expect(media.normalizeDetails({ objects: ['bread bowl', ''], season: ' autumn ', junk: 'x' })).toEqual({ objects: ['bread bowl'], season: 'autumn' });
    expect(media.normalizeDetails(null)).toEqual({});
    expect(() => media.normalizeDetails(['x'])).toThrow(/object/);
  });

  test('a picture is an http(s) address, a site path or an image data URL', () => {
    expect(media.checkUrl(' https://cdn/x.jpg ')).toBe('https://cdn/x.jpg');
    expect(media.checkUrl('/uploads/x.jpg')).toBe('/uploads/x.jpg');
    expect(() => media.checkUrl('javascript:alert(1)')).toThrow(/url/);
    expect(() => media.checkUrl('data:image/svg+xml;base64,AAAA')).toThrow(/url/);
    expect(() => media.checkUrl('')).toThrow(/needs a url/);
  });

  test('a picture is not a story fact: the library writes only its own two tables', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../src/services/mediaLibrary.js'), 'utf8');
    const written = [...src.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_]+)/gi)].map((m) => m[1]);
    expect(written.length).toBeGreaterThan(0);
    expect([...new Set(written)].sort()).toEqual(['media_asset_links', 'media_assets']);
  });
});
