// frontend/src/components/Teleprompter/TeleprompterRemotePanel.jsx
// The phone remote's panel in the reader (Teleprompter batch 3; Evoni,
// 2026-10-20): a QR code for the phone to scan, the code typed out, when it
// ends, and End. The token is in the link's fragment, so it never reaches a
// server log. The session itself is useTeleprompterRemote's.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, X, RefreshCw } from 'lucide-react';
import { remoteUrl, groupedCode, expiryText } from '../../lib/teleprompterRemoteApi';

/** remote: useTeleprompterRemote's return. onClose: hide the panel (the session stays). */
export default function TeleprompterRemotePanel({ remote, onClose }) {
  const token = remote.session?.token || null;
  const link = token ? remoteUrl(window.location.origin, token) : null;
  const [qr, setQr] = useState(null);
  const [qrError, setQrError] = useState(null);

  useEffect(() => {
    if (!link) { setQr(null); return undefined; }
    let live = true;
    QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => { if (live) { setQr(url); setQrError(null); } })
      .catch((err) => {
        console.error('[TeleprompterRemotePanel] QR code not made:', err);
        if (live) setQrError('The QR code could not be drawn. Type the code on the phone instead.');
      });
    return () => { live = false; };
  }, [link]);

  const { status, message } = remote;
  return (
    <div className="stp-remote" role="region" aria-label="Phone remote" data-testid="stp-remote-panel">
      <div className="stp-remote-head">
        <p className="stp-takes-title"><Smartphone size={14} aria-hidden="true" /> Phone remote</p>
        <button type="button" className="stp-btn is-icon" aria-label="Hide the phone remote panel" data-testid="stp-remote-hide" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
      {status === 'opening' && <p className="stp-remote-text">Opening a remote…</p>}
      {status === 'live' && token && (
        <>
          <p className="stp-remote-text">Scan with your phone&apos;s camera. Its buttons play, pause, change speed and beat, and start or stop a take.</p>
          {qr ? <img className="stp-remote-qr" src={qr} alt="QR code for the phone remote" width={240} height={240} data-testid="stp-remote-qr" />
            : !qrError && <p className="stp-remote-text">Drawing the code…</p>}
          {qrError && <p className="stp-error" role="alert">{qrError}</p>}
          <p className="stp-remote-text">Or open <span className="stp-remote-path">/teleprompter/remote</span> on the phone and type this code:</p>
          <p className="stp-remote-code" data-testid="stp-remote-code">{groupedCode(token)}</p>
          <p className="stp-remote-meta" data-testid="stp-remote-expiry">{expiryText(remote.session.expires_at) || 'Ends in about two hours'} · anyone with this code can drive the prompter until then.</p>
          <button type="button" className="stp-btn" data-testid="stp-remote-end" onClick={remote.end}><X size={18} aria-hidden="true" /> End the remote</button>
        </>
      )}
      {status === 'ended' && (
        <>
          <p className="stp-remote-text" data-testid="stp-remote-ended">{message || 'The remote has ended. The phone can no longer drive the prompter.'}</p>
          <button type="button" className="stp-btn" data-testid="stp-remote-reopen" onClick={remote.reopen}><RefreshCw size={18} aria-hidden="true" /> Open a new remote</button>
        </>
      )}
      {(status === 'unavailable' || status === 'error') && (
        <>
          <p className="stp-remote-text" role="status" data-testid="stp-remote-unavailable">{message}</p>
          {status === 'error' && <button type="button" className="stp-btn" onClick={remote.reopen}><RefreshCw size={18} aria-hidden="true" /> Try again</button>}
        </>
      )}
    </div>
  );
}
