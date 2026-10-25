/**
 * ScenePicker — the event's scene set (S7): the venue's sets first, a
 * search by name, venue and type with each set's angles (L2), and a new
 * set for the venue.
 * Moved out of EventPackagePage.jsx when the page was split (Task #54);
 * the markup and class names are as they were.
 */
import { X, Search, CheckCircle2, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { sceneSetThumb } from '../../utils/sceneSets';
import { fmtLabel } from '../../lib/eventPackageFields';

export default function ScenePicker({ event, place }) {
  const {
    closeScenePicker, pickerSearch, setPickerSearch, pickerSets, sceneVenue, pickerGroups, pickerHighlight, setPickerHighlight,
    sceneSaving, chooseSceneSet, venueNames, sceneCreateOpen, setSceneCreateOpen, sceneCreateName, setSceneCreateName,
    sceneCreateSaving, createSceneSet,
  } = place;
  return (
    <div className="epp-modal-backdrop" onClick={closeScenePicker}>
      <div className="epp-modal" role="dialog" aria-modal="true" aria-label="Choose the scene set" data-testid="scene-set-picker" onClick={(e) => e.stopPropagation()}>
        <div className="epp-modal-header">
          <h3>Scene Set — {event.name}</h3>
          <button className="epp-icon-btn" onClick={closeScenePicker} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="epp-modal-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="text" placeholder="Search by name, venue or type" value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)} aria-label="Search scene sets" data-testid="scene-set-search"
          />
        </div>
        <div className="epp-modal-results">
          {pickerSets === null ? (
            <div className="epp-empty"><Loader2 size={14} className="epp-spin-icon" /> Loading scene sets…</div>
          ) : (
            [
              { key: 'venue', title: sceneVenue ? `At ${sceneVenue.name}` : null, sets: pickerGroups.atVenue },
              { key: 'others', title: pickerGroups.atVenue.length ? 'Other scene sets' : null, sets: pickerGroups.others },
            ].map((group) => (
              group.sets.length > 0 && (
                <div key={group.key} data-testid={`scene-set-group-${group.key}`}>
                  {group.title && <div className="epp-modal-group-title">{group.title}</div>}
                  {group.sets.map((s) => {
                    const thumb = sceneSetThumb(s);
                    const open = pickerHighlight === s.id;
                    const angles = (s.angles || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                    return (
                      <div key={s.id} className={`epp-set-row${open ? ' is-open' : ''}`}>
                        <div className="epp-set-row-main">
                          <button
                            className="epp-modal-result" disabled={sceneSaving}
                            onClick={() => chooseSceneSet(s)} data-testid={`scene-set-option-${s.id}`}
                          >
                            {thumb
                              ? <img className="epp-set-thumb" src={thumb} alt="" />
                              : <span className="epp-set-thumb epp-set-thumb-empty" aria-hidden="true">No image</span>}
                            <div className="epp-set-text">
                              <div className="epp-host-name">{s.name}</div>
                              <div className="epp-host-handle">
                                {fmtLabel(s.scene_type)}
                                {venueNames[s.world_location_id] ? ` · ${venueNames[s.world_location_id]}` : ''}
                                {s.base_still_url ? '' : ' · no image yet'}
                              </div>
                            </div>
                            {event.scene_set_id === s.id && <CheckCircle2 size={16} />}
                          </button>
                          <button
                            type="button" className="epp-icon-btn epp-set-preview-btn"
                            onClick={() => setPickerHighlight(open ? null : s.id)}
                            aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} the angles of ${s.name}`}
                            data-testid={`scene-set-preview-${s.id}`}
                          >
                            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                        {open && (
                          <div className="epp-set-angles" data-testid={`scene-set-angles-${s.id}`}>
                            {angles.length === 0 ? (
                              <span className="epp-host-handle">No angles yet</span>
                            ) : angles.map((a) => (
                              <figure key={a.id} className="epp-set-angle" data-testid={`scene-set-angle-${a.id}`}>
                                {a.still_image_url
                                  ? <img src={a.still_image_url} alt="" />
                                  : <span className="epp-set-thumb-empty" aria-hidden="true">No image</span>}
                                <figcaption>{a.angle_name || a.angle_label}</figcaption>
                              </figure>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ))
          )}
          {pickerSets !== null && pickerSets.length === 0 && (
            <div className="epp-empty">No scene sets for this show yet</div>
          )}
          {pickerSets !== null && pickerSets.length > 0 && pickerSearch.trim()
            && pickerGroups.atVenue.length + pickerGroups.others.length === 0 && (
            <div className="epp-empty" data-testid="scene-set-no-match">No scene set matches “{pickerSearch.trim()}”</div>
          )}
        </div>
        <div className="epp-modal-footer">
          {!sceneVenue ? (
            <div className="epp-empty" data-testid="scene-set-needs-venue">Choose a venue to create a scene set for it.</div>
          ) : !sceneCreateOpen ? (
            <button type="button" className="epp-btn epp-btn-small" onClick={() => setSceneCreateOpen(true)} data-testid="scene-set-create-open">
              <Plus size={14} /> Create a scene set for {sceneVenue.name}
            </button>
          ) : (
            <div className="epp-inline-create">
              <input
                type="text" placeholder="Scene set name" value={sceneCreateName} aria-label="Scene set name"
                onChange={(e) => setSceneCreateName(e.target.value)} maxLength={80}
              />
              <div className="epp-inline-create-actions">
                <button
                  type="button" className="epp-btn epp-btn-small epp-btn-primary"
                  disabled={sceneCreateSaving || !sceneCreateName.trim()}
                  onClick={createSceneSet}
                >
                  {sceneCreateSaving ? 'Creating…' : 'Create scene set'}
                </button>
                <button type="button" className="epp-icon-btn" onClick={() => setSceneCreateOpen(false)} disabled={sceneCreateSaving} aria-label="Cancel">
                  <X size={14} />
                </button>
              </div>
              <p className="epp-inline-create-note">Its Scene Brief opens for this event, with the cost, before anything is generated.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
