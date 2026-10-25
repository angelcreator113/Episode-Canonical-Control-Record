/**
 * GuestFeedPicker — Add from The Pulse: search creators; an invited
 * guest is picked to feature them (Task #3138), a new one joins featured.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { X, Search, CheckCircle2 } from 'lucide-react';

export default function GuestFeedPicker({ guestList, guests }) {
  const { setGuestFeedPickerOpen, guestFeedSearch, setGuestFeedSearch, guestFeedResults, guestFeedSearching, guestSaving, addGuestFromFeed } = guests;
  return (
    <div className="epp-modal-backdrop" onClick={() => setGuestFeedPickerOpen(false)}>
      <div className="epp-modal" role="dialog" aria-modal="true" aria-label="Add from The Pulse" onClick={(e) => e.stopPropagation()}>
        <div className="epp-modal-header">
          <h3>Add from The Pulse</h3>
          <button className="epp-icon-btn" onClick={() => setGuestFeedPickerOpen(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="epp-modal-search">
          <Search size={14} />
          <input
            autoFocus
            aria-label="Search creators" placeholder="Search creators…"
            value={guestFeedSearch}
            onChange={(e) => setGuestFeedSearch(e.target.value)}
          />
        </div>
        <div className="epp-modal-results">
          {guestFeedSearching ? (
            <div className="epp-empty">Searching…</div>
          ) : guestFeedResults.length ? (
            guestFeedResults.map((p) => {
              // An invited guest can be picked to feature them (Task #3138);
              // only one already featured is done.
              const guest = guestList.find((g) => String(g.profile_id) === String(p.id));
              const isFeatured = !!guest?.featured;
              return (
                <button
                  key={p.id} className="epp-modal-result" data-testid={`guest-feed-result-${p.id}`}
                  disabled={guestSaving || isFeatured}
                  onClick={() => addGuestFromFeed(p)}
                >
                  <div>
                    <div className="epp-host-name">{p.display_name || p.handle}</div>
                    {p.handle && <div className="epp-host-handle">@{String(p.handle).replace(/^@/, '')}</div>}
                    {guest && <div className="epp-host-handle">{isFeatured ? 'Featured' : 'Invited · pick to feature'}</div>}
                  </div>
                  {isFeatured && <CheckCircle2 size={16} />}
                </button>
              );
            })
          ) : (
            <div className="epp-empty">No creators found</div>
          )}
        </div>
      </div>
    </div>
  );
}
