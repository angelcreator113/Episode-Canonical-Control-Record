/**
 * The episode's stats panel (Task #3164): the show's panel with Lala's
 * numbers for this episode, each "before → after" (going in, and with the
 * episode's own changes), and the PNG to download for the video: 1920 × 220
 * for YouTube 1080p, 3840 × 440 for 4K. The audience sees it; Lala's Phone
 * never does. Without a panel it says where to set one up.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import api from '../../services/api';
import StatsPanelPreview from './StatsPanelPreview';
import { PANEL_SIZES, statsPanelApi, iconUrlsOf } from '../../lib/statsPanel';
import './StatsPanel.css';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

export default function EpisodeStatsPanel({ showId, episode }) {
  const episodeId = episode?.id;
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(null);
  const [iconUrls, setIconUrls] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!showId || !episodeId) return undefined;
    let cancelled = false;
    setData(null); setMissing(false); setError(null);
    statsPanelApi.episode(showId, episodeId)
      .then((d) => {
        if (cancelled) return;
        // A reply with no boxes is treated as no panel, never drawn half.
        if (d && Array.isArray(d.spots)) setData(d);
        else setMissing(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.data?.code === 'NO_PANEL') { setMissing(true); return; }
        console.error('[EpisodeStatsPanel] load failed:', err);
        setError(errorText(err));
      });
    api.get(`/api/v1/ui-overlays/${showId}`)
      .then((r) => { if (!cancelled) setIconUrls(iconUrlsOf(r.data?.data || [])); })
      .catch((err) => console.error('[EpisodeStatsPanel] icons load failed:', err));
    return () => { cancelled = true; };
  }, [showId, episodeId]);

  const download = async (size) => {
    setBusy(size);
    setError(null);
    try {
      await statsPanelApi.download(showId, episodeId, size, episode?.episode_number);
    } catch (err) {
      console.error('[EpisodeStatsPanel] download failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const libraryPath = `/shows/${showId}/world?tab=production-overlays`;

  return (
    <section className="eot-section spx-episode" id="eot-stats-panel" aria-labelledby="eot-stats-title" data-testid="eot-stats-panel">
      <h3 id="eot-stats-title" className="eot-look-title">Stats panel</h3>
      {missing && (
        <p className="eot-note" data-testid="eot-stats-none">
          No stats panel yet. In <Link to={libraryPath}>Overlays</Link>, upload the panel art (1920 × 220, transparent) and choose &ldquo;Use as stats panel&rdquo;.
        </p>
      )}
      {!data && !missing && !error && <p className="eot-note">Loading the stats panel…</p>}
      {data && (
        <>
          <StatsPanelPreview url={data.panel?.url} spots={data.spots} iconUrls={iconUrls} label={`Stats panel for Episode ${episode?.episode_number ?? ''}: ${data.spots.map((s) => s.text).join(', ')}`} />
          <p className="eot-note">Lala&apos;s numbers going into this episode, then with its changes. The audience sees this panel; Lala doesn&apos;t.</p>
          <div className="spx-downloads">
            {PANEL_SIZES.map((s) => (
              <button key={s.key} type="button" className="spx-btn" onClick={() => download(s.key)} disabled={!!busy} data-testid={`eot-stats-download-${s.key}`}>
                {busy === s.key ? <Loader2 size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />} {s.label} PNG ({s.dims})
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="spx-error" role="alert">{error}</p>}
    </section>
  );
}
