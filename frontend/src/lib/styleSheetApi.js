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
};
