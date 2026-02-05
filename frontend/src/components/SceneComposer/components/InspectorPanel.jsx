import React from 'react';

/**
 * InspectorPanel - Right panel showing properties of selected element
 */
export default function InspectorPanel({
  composition,
  selectedLayerId,
  onUpdateLayer,
  onDeleteLayer,
  children
}) {
  // For now, this is just a container
  // The actual inspector content is still in VideoCompositionWorkspace
  
  return (
    <div className="sc-inspector-panel">
      {children || (
        <div className="sc-inspector-placeholder">
          {selectedLayerId ? (
            <p>Inspector properties will render here</p>
          ) : (
            <p>Select an element to edit properties</p>
          )}
        </div>
      )}
    </div>
  );
}

