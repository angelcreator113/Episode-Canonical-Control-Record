// Stubbed API for the layout-tools browser check (Task #2030): a Homepage
// with three zones of different sizes, as a dock would have them: a 12×6
// camera, a 16×8 phone and a 22×11 map pin, scattered off any line. Nothing
// leaves the browser; saves resolve and are recorded on window.__puts.
const svg = (fill, text) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" font-size="40" text-anchor="middle" fill="#fff">${text}</text></svg>`);
const ico = (fill, t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect rx="20" width="96" height="96" fill="${fill}"/><text x="48" y="60" font-size="36" text-anchor="middle" fill="#fff">${t}</text></svg>`);
const CAMERA = { id: 'camera_icon', name: 'Camera', category: 'phone_icon', generated: true, url: ico('#7ab3d4', 'C'), asset_id: 'a-camera' };
const PHONE = { id: 'phone_icon', name: 'Phone', category: 'phone_icon', generated: true, url: ico('#6bba9a', 'P'), asset_id: 'a-phone' };
const PIN = { id: 'pin_icon', name: 'Map', category: 'phone_icon', generated: true, url: ico('#e8a0b4', 'M'), asset_id: 'a-pin' };
const zone = (id, icon, x, y, w, h) => ({ id, x, y, w, h, target: 'calls', label: icon.name, icon_url: icon.url, icon_urls: [icon.url], icon_overlay_id: icon.id });
const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: svg('#a889c8', 'Home'), asset_id: 'a-home', show_id: 's-1',
  screen_links: [
    zone('z-camera', CAMERA, 10, 70, 12, 6),
    zone('z-phone', PHONE, 33, 74, 16, 8),
    zone('z-pin', PIN, 57, 65, 22, 11),
  ],
};
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: svg('#d4789a', 'Calls'), asset_id: 'a-calls', show_id: 's-1', screen_links: [] };
const ok = { data: { success: true, data: [], missions: [] } };
export default {
  get: async (url) => (url === '/api/v1/ui-overlays/s-1' ? { data: { success: true, data: [HOME, CALLS, CAMERA, PHONE, PIN] } } : ok),
  post: async () => ok,
  put: async (url, body) => { (window.__puts = window.__puts || []).push({ url, body }); return { data: { success: true } }; },
  delete: async () => ok,
  patch: async () => ok,
};
