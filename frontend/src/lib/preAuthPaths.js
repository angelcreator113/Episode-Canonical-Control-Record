/**
 * The pages a signed-out visitor may open (Evoni, 2026-11-15). Everything
 * else in the app is the studio's: the shell sends a signed-out visitor who
 * lands there to the landing page.
 *
 * Exact pages, and the two public sections with one item under them: a
 * published recap by its id, a published look by its key. Nothing deeper,
 * and nothing that only starts with the same letters ("/shop-the-looks").
 * This is navigation only: what each page may read is decided by the API,
 * and the public reads are the ones under /api/v1/public.
 */
export const REMOTE_PATH = '/teleprompter/remote';

const EXACT = ['/', '/login', REMOTE_PATH];
const PUBLIC_SECTIONS = ['/pulse-recap', '/shop-the-look'];
const ONE_ITEM = /^[A-Za-z0-9_-]{1,64}$/;

export function isPreAuthPath(pathname) {
  if (typeof pathname !== 'string') return false;
  // A trailing slash is the same page.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (EXACT.includes(path)) return true;
  for (const section of PUBLIC_SECTIONS) {
    if (path === section) return true;
    if (path.startsWith(`${section}/`) && ONE_ITEM.test(path.slice(section.length + 1))) return true;
  }
  return false;
}
