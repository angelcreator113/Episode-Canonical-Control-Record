/**
 * Lets the phone's pull-to-refresh work on this page (Evoni, 2026-10-29:
 * "allow pull-to-refresh on landing and sign-in"). Everywhere else it stays
 * off (index.css, App.css and the touchmove guard in main.jsx), so a drag on
 * a working page never reloads it by accident. While the page is mounted,
 * <html data-pull-refresh="on">: the CSS lets the page overscroll again and
 * main.jsx's guard stands aside. Removed on leaving.
 */
import { useEffect } from 'react';

export const PULL_REFRESH_ATTR = 'pullRefresh';

export default function useAllowPullToRefresh() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset[PULL_REFRESH_ATTR] = 'on';
    return () => { delete root.dataset[PULL_REFRESH_ATTR]; };
  }, []);
}
