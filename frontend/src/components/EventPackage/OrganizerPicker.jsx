/**
 * OrganizerPicker — Change Organizer (Task #1761): a creator or a brand,
 * as tabs; a choice that clears the other kind is confirmed first. The
 * state is useOrganizerPicker's.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { X, User, Building2, Search, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { brandIsListed, BRAND_NAME_MAX } from '../../utils/eventOrganizer';
import { fmtLabel } from '../../lib/eventPackageFields';

export default function OrganizerPicker({ event, organizer, picker }) {
  const {
    organizerTab, setOrganizerTab, hostSearch, setHostSearch, hostResults, hostSearching,
    brands, setBrands, brandsLoading, brandsError, brandSearch, setBrandSearch, brandFreeText, setBrandFreeText,
    pendingOrganizer, setPendingOrganizer, organizerSaving, brandsListed, brandFallback,
    closeOrganizerPicker, saveOrganizer, chooseCreatorOrganizer, chooseBrandOrganizer,
  } = picker;
  return (
    <div className="epp-modal-backdrop" onClick={() => { if (!organizerSaving) closeOrganizerPicker(); }}>
      <div className="epp-modal" role="dialog" aria-modal="true" aria-label="Change Organizer" onClick={(e) => e.stopPropagation()}>
        <div className="epp-modal-header">
          <h3>Change Organizer</h3>
          <button className="epp-icon-btn" onClick={closeOrganizerPicker} aria-label="Close" disabled={organizerSaving}>
            <X size={16} />
          </button>
        </div>

        {pendingOrganizer ? (
          <>
            <div className="epp-basics-dialog epp-organizer-confirm" data-testid="organizer-confirm">
              <p className="epp-organizer-confirm-lead">
                Make <strong>{pendingOrganizer.label}</strong> the organizer ({pendingOrganizer.kind})?
              </p>
              <ul className="epp-organizer-clears">
                {pendingOrganizer.update.clears.map((c, i) => (
                  <li key={`${c.kind}-${i}`}>
                    {c.kind === 'brand'
                      ? <>Removes the brand <strong>{c.value}</strong> from this event.</>
                      : <>Unlinks the creator <strong>{c.value}</strong> from this event.</>}
                  </li>
                ))}
              </ul>
              <p className="epp-basics-note">
                An event has one organizer: a creator or a brand.
                {pendingOrganizer.kind === 'creator' && ' The brand name is also used for outfit brand matching and invitation style lookups.'}
              </p>
            </div>
            <div className="epp-modal-footer epp-basics-actions">
              <button type="button" className="epp-btn epp-btn-small" onClick={() => setPendingOrganizer(null)} disabled={organizerSaving}>
                Back
              </button>
              <div className="epp-basics-spacer" />
              <button
                type="button" className="epp-btn epp-btn-small epp-btn-primary"
                onClick={() => saveOrganizer(pendingOrganizer)} disabled={organizerSaving}
              >
                {organizerSaving ? 'Saving…' : 'Set organizer'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Tabs as tabs (audit, 2026-10-23): one in the Tab order,
                arrows move between them, each controls the panel below. */}
            <div className="epp-organizer-tabs" role="tablist" aria-label="Organizer kind"
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const next = organizerTab === 'creator' ? 'brand' : 'creator';
                setOrganizerTab(next);
                document.getElementById(`epp-organizer-tab-${next}`)?.focus();
              }}>
              <button
                type="button" role="tab" aria-selected={organizerTab === 'creator'} id="epp-organizer-tab-creator"
                aria-controls="epp-organizer-panel" tabIndex={organizerTab === 'creator' ? 0 : -1}
                className={`epp-organizer-tab ${organizerTab === 'creator' ? 'is-active' : ''}`}
                onClick={() => setOrganizerTab('creator')}
              >
                <User size={14} /> Creator
              </button>
              <button
                type="button" role="tab" aria-selected={organizerTab === 'brand'} id="epp-organizer-tab-brand"
                aria-controls="epp-organizer-panel" tabIndex={organizerTab === 'brand' ? 0 : -1}
                className={`epp-organizer-tab ${organizerTab === 'brand' ? 'is-active' : ''}`}
                onClick={() => setOrganizerTab('brand')}
              >
                <Building2 size={14} /> Brand
              </button>
            </div>

            <div role="tabpanel" id="epp-organizer-panel" aria-labelledby={`epp-organizer-tab-${organizerTab}`}>
            {organizerTab === 'creator' ? (
              <>
                <div className="epp-modal-search">
                  <Search size={14} />
                  <input
                    autoFocus
                    placeholder="Search creators…"
                    aria-label="Search creators"
                    value={hostSearch}
                    onChange={(e) => setHostSearch(e.target.value)}
                  />
                </div>
                <div className="epp-modal-results">
                  {hostSearching ? (
                    <div className="epp-empty">Searching…</div>
                  ) : hostResults.length ? (
                    hostResults.map((p) => (
                      <button key={p.id} className="epp-modal-result" disabled={organizerSaving} onClick={() => chooseCreatorOrganizer(p)}>
                        <div>
                          <div className="epp-host-name">{p.display_name || p.handle}</div>
                          {p.handle && <div className="epp-host-handle">@{String(p.handle).replace(/^@/, '')}</div>}
                        </div>
                        {organizer.kind === 'creator' && event.source_profile_id === p.id && <CheckCircle2 size={16} />}
                      </button>
                    ))
                  ) : (
                    <div className="epp-empty">No creators found</div>
                  )}
                </div>
              </>
            ) : brandFallback ? (
              <div className="epp-basics-dialog" data-testid="brand-free-text">
                <p className="epp-basics-note">
                  <AlertCircle size={13} aria-hidden="true" />
                  {brandsError ? `The brand list could not be loaded (${brandsError}). Type the brand name instead.` : 'No LalaVerse brands exist yet. Type the brand name instead.'}
                </p>
                <input
                  autoFocus type="text" value={brandFreeText} maxLength={BRAND_NAME_MAX}
                  placeholder="Brand name" aria-label="Brand name"
                  onChange={(e) => setBrandFreeText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && brandFreeText.trim()) chooseBrandOrganizer(brandFreeText); }}
                />
                <div className="epp-basics-actions">
                  {brandsError && (
                    <button type="button" className="epp-btn epp-btn-small" onClick={() => setBrands(null)} disabled={organizerSaving}>
                      <RefreshCw size={13} /> Retry list
                    </button>
                  )}
                  <div className="epp-basics-spacer" />
                  <button
                    type="button" className="epp-btn epp-btn-small epp-btn-primary"
                    onClick={() => chooseBrandOrganizer(brandFreeText)} disabled={organizerSaving || !brandFreeText.trim()}
                  >
                    Use this brand
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="epp-modal-search">
                  <Search size={14} />
                  <input
                    autoFocus
                    placeholder="Search brands…"
                    aria-label="Search brands"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                  />
                </div>
                {organizer.brandName && brands && !brandIsListed(brands, organizer.brandName) && (
                  <p className="epp-organizer-unlisted">
                    Current brand <strong>{organizer.brandName}</strong> was typed in and is not in the LalaVerse brand list.
                  </p>
                )}
                <div className="epp-modal-results">
                  {brandsLoading || brands === null ? (
                    <div className="epp-empty">Loading brands…</div>
                  ) : brandsListed.length ? (
                    brandsListed.map((b) => (
                      <button key={b.id} className="epp-modal-result" disabled={organizerSaving} onClick={() => chooseBrandOrganizer(b.name)}>
                        <div>
                          <div className="epp-host-name">{b.name}</div>
                          {(b.category || b.type) && <div className="epp-host-handle">{fmtLabel(b.category || b.type)}</div>}
                        </div>
                        {organizer.kind === 'brand' && organizer.brandName === b.name && <CheckCircle2 size={16} />}
                      </button>
                    ))
                  ) : (
                    <div className="epp-empty">No brands match</div>
                  )}
                </div>
              </>
            )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
