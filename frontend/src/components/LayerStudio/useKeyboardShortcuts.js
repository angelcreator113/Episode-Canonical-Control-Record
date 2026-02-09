import { useEffect } from 'react';

export const useKeyboardShortcuts = ({
  layers,
  selectedLayer,
  selectedAsset,
  setSelectedLayer,
  setSelectedAsset,
  onLayerUpdate,
  onAssetUpdate,
  onAssetRemove,
  canvasZoom,
  setCanvasZoom
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      // Layer Selection (1-5)
      if (['1', '2', '3', '4', '5'].includes(key) && !ctrl) {
        e.preventDefault();
        const layerNumber = parseInt(key);
        const layer = layers.find(l => l.layer_number === layerNumber);
        if (layer) {
          setSelectedLayer(layer);
          console.log(`🎹 Selected Layer ${layerNumber}`);
        }
      }

      // Toggle Visibility (V)
      if (key === 'v' && selectedLayer) {
        e.preventDefault();
        onLayerUpdate(selectedLayer.id, { is_visible: !selectedLayer.is_visible });
        console.log(`🎹 Toggled layer visibility`);
      }

      // Toggle Lock (L)
      if (key === 'l' && selectedLayer) {
        e.preventDefault();
        onLayerUpdate(selectedLayer.id, { is_locked: !selectedLayer.is_locked });
        console.log(`🎹 Toggled layer lock`);
      }

      // Delete Asset (Delete/Backspace)
      if ((key === 'delete' || key === 'backspace') && selectedAsset) {
        e.preventDefault();
        if (window.confirm('Delete this asset from the layer?')) {
          onAssetRemove(selectedAsset.id);
          console.log(`🎹 Deleted asset`);
        }
      }

      // Duplicate Asset (Ctrl+D)
      if (ctrl && key === 'd' && selectedAsset) {
        e.preventDefault();
        console.log(`🎹 Duplicate asset (not yet implemented)`);
        // TODO: Implement duplication
      }

      // Zoom In (+/=)
      if ((key === '+' || key === '=') && !ctrl) {
        e.preventDefault();
        setCanvasZoom(prev => Math.min(3, prev + 0.25));
        console.log(`🎹 Zoom in`);
      }

      // Zoom Out (-)
      if (key === '-' && !ctrl) {
        e.preventDefault();
        setCanvasZoom(prev => Math.max(0.25, prev - 0.25));
        console.log(`🎹 Zoom out`);
      }

      // Reset Zoom (0)
      if (key === '0' && !ctrl) {
        e.preventDefault();
        setCanvasZoom(1.0);
        console.log(`🎹 Reset zoom to 100%`);
      }

      // Move Asset with Arrow Keys
      if (selectedAsset && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const currentX = selectedAsset.position_x || 0;
        const currentY = selectedAsset.position_y || 0;

        switch (key) {
          case 'arrowup':
            onAssetUpdate(selectedAsset.id, { position_y: currentY - step });
            break;
          case 'arrowdown':
            onAssetUpdate(selectedAsset.id, { position_y: currentY + step });
            break;
          case 'arrowleft':
            onAssetUpdate(selectedAsset.id, { position_x: currentX - step });
            break;
          case 'arrowright':
            onAssetUpdate(selectedAsset.id, { position_x: currentX + step });
            break;
        }
        console.log(`🎹 Moved asset ${key}`);
      }

      // Deselect (Escape)
      if (key === 'escape') {
        e.preventDefault();
        setSelectedAsset(null);
        setSelectedLayer(null);
        console.log(`🎹 Deselected`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layers, selectedLayer, selectedAsset, canvasZoom]);
};

export default useKeyboardShortcuts;
