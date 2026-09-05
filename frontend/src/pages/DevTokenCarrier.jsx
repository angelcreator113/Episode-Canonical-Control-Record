import { useEffect, useState } from 'react';

/**
 * Dev-only token carrier (Shape A). Reads an externally-minted token from
 * the URL fragment and writes it into the localStorage keys the app's own
 * AuthContext/authService already read (authToken, refreshToken, user —
 * see docs/LOCAL_DEV_LOGIN.md). Mints nothing, calls no backend endpoint.
 * Governed by docs/audit/F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md.
 */
export default function DevTokenCarrier() {
  const [status, setStatus] = useState('Reading token from URL fragment...');

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const authToken = params.get('authToken');
    const refreshToken = params.get('refreshToken');
    const user = params.get('user');

    if (!authToken) {
      setStatus('No authToken found in URL fragment. Nothing written.');
      return;
    }

    localStorage.setItem('authToken', authToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (user) localStorage.setItem('user', user);

    setStatus('Token carried into localStorage. Reloading...');
    window.location.replace('/');
  }, []);

  return <div>{status}</div>;
}
