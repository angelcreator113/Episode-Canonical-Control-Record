// Stubbed API for the Connect browser check (Tasks #2018, #2021): a show whose
// Homepage has one Call icon placed on the home grid. Task #2044 adds two
// screens that have never had zones: wallet (screen_links null) and closet
// (no screen_links at all), as the API returns such screens. Nothing leaves the
// browser; saves resolve successfully and are recorded on window.__puts.
const svg = (fill, text) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" font-size="40" text-anchor="middle" fill="#fff">${text}</text></svg>`);
const ico = (fill, t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect rx="20" width="96" height="96" fill="${fill}"/><text x="48" y="60" font-size="36" text-anchor="middle" fill="#fff">${t}</text></svg>`);
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: ico('#6bba9a', 'C'), asset_id: 'a-call', opens_screen: 'calls' };
const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: svg('#a889c8', 'Home'), asset_id: 'a-home', show_id: 's-1',
  screen_links: [{ id: 'z-call', x: 29, y: 28, w: 12, h: 9, target: 'calls', label: 'Call', icon_url: CALL.url, icon_urls: [CALL.url], icon_overlay_id: 'call_icon' }],
};
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: svg('#d4789a', 'Calls'), asset_id: 'a-calls', show_id: 's-1', screen_links: [] };
const WALLET = { id: 'wallet', name: 'wallet', category: 'phone', generated: true, url: svg('#7ab3d4', 'Wallet'), asset_id: 'a-wallet', show_id: 's-1', screen_links: null };
const CLOSET = { id: 'closet', name: 'closet', category: 'phone', generated: true, url: svg('#c9a66b', 'Closet'), asset_id: 'a-closet', show_id: 's-1' };
const ok = { data: { success: true, data: [], missions: [] } };
export default {
  get: async (url) => (url === '/api/v1/ui-overlays/s-1' ? { data: { success: true, data: [HOME, CALLS, WALLET, CLOSET, CALL] } } : ok),
  post: async () => ok,
  put: async (url, body) => { (window.__puts = window.__puts || []).push({ url, body }); return { data: { success: true } }; },
  delete: async () => ok,
  patch: async () => ok,
};
