/**
 * The approved style sheet's exports and its place in Distribution (Tasks
 * #2877, #2878). The Style Page's Share & export panel and the Distribution
 * tab's Style sheet card both use these, so a download and a send behave the
 * same in both places.
 */
import api from '../services/api';

const sheetBase = (episodeId) => `/api/v1/episodes/${episodeId}/style-sheet`;

/** The server's message for a failed request, including a blob (export) body. */
export async function styleSheetError(err, fallback) {
  const data = err?.response?.data;
  if (data && typeof data.text === 'function') {
    try { return JSON.parse(await data.text()).error || fallback; } catch (parseErr) {
      console.error('[styleSheetApi] error body unreadable:', parseErr);
      return fallback;
    }
  }
  return data?.error || err?.message || fallback;
}

/** Save a downloaded file under the server's name (Content-Disposition), else `fallback`. */
function saveBlob(res, fallback) {
  const disposition = res.headers?.['content-disposition'] || '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || fallback;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One of the five designs in one size, drawn on the server (Evoni, 2026-10-22). */
export async function downloadStyleDesign(episodeId, design, size) {
  saveBlob(await api.get(`${sheetBase(episodeId)}/design/${design}/${size}`, { responseType: 'blob' }), `style-${design}-${size}.png`);
}

/** All five designs in one size, or in every size ("all"), as a zip. */
export async function downloadStyleDesignsZip(episodeId, size) {
  saveBlob(await api.get(`${sheetBase(episodeId)}/designs-zip/${size}`, { responseType: 'blob' }), `style-designs-${size}.zip`);
}

/** Download one export size of the approved sheet, drawn on the server. */
export async function downloadStyleSheetExport(episodeId, size, episodeNumber) {
  const res = await api.get(`${sheetBase(episodeId)}/export/${size}`, { responseType: 'blob' });
  const disposition = res.headers?.['content-disposition'] || '';
  const n = episodeNumber != null ? String(episodeNumber).padStart(2, '0') : 'episode';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || `style-sheet-episode-${n}-${size}.${size === 'pdf' ? 'pdf' : 'png'}`;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// GET/POST/PATCH/DELETE /episodes/:id/style-sheet/distribution; each returns
// the entry as Distribution shows it ({ sent: false } when there is none).
const distUrl = (episodeId) => `${sheetBase(episodeId)}/distribution`;
export const styleSheetDistributionApi = {
  get: (episodeId) => api.get(distUrl(episodeId)).then((r) => r.data?.data),
  send: (episodeId, includeShopLinks) => api.post(distUrl(episodeId), { include_shop_links: Boolean(includeShopLinks) }).then((r) => r.data?.data),
  update: (episodeId, changes) => api.patch(distUrl(episodeId), changes).then((r) => r.data?.data),
  remove: (episodeId) => api.delete(distUrl(episodeId)).then((r) => r.data?.data),
  // Shop the Look on the website (Task #3021): ADMIN only on the server.
  publish: (episodeId) => api.post(`${distUrl(episodeId)}/site`).then((r) => r.data?.data),
  takeDown: (episodeId) => api.delete(`${distUrl(episodeId)}/site`).then((r) => r.data?.data),
};
