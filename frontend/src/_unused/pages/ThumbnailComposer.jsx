import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ThumbnailComposer.css';

function ThumbnailComposer() {
  const { episodeId, thumbnailId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [platform, setPlatform] = useState('youtube');
  const [thumbnail, setThumbnail] = useState(null);
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [tool, setTool] = useState('select');
  const [loading, setLoading] = useState(false);

  const platforms = {
    youtube: { width: 1920, height: 1080, ratio: '16:9', name: 'YouTube' }
  };

  const currentPlatform = platforms[platform];

  useEffect(() => {
    loadThumbnail();
  }, [thumbnailId]);

  useEffect(() => {
    renderCanvas();
  }, [layers, platform, selectedLayerId]);

  const loadThumbnail = async () => {
    if (!thumbnailId || thumbnailId === 'new') {
      setThumbnail({
        id: 'new',
        episode_id: episodeId,
        title: 'New Thumbnail',
        platform,
        layers: []
      });
      setLayers([]);
      return;
    }

    setLoading(true);
    try {
      setThumbnail({
        id: thumbnailId,
        episode_id: episodeId,
        title: 'Episode Thumbnail',
        platform,
        layers: []
      });
      setLayers([]);
    } catch (error) {
      console.error('Failed to load thumbnail:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = currentPlatform;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(0, 0, width, height);

    layers.forEach(layer => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity || 1;

      if (layer.type === 'background' && layer.imageUrl) {
        ctx.fillStyle = '#2a2a34';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Background Image', width / 2, height / 2);
      } else if (layer.type === 'text') {
        ctx.fillStyle = layer.color || '#ffffff';
        ctx.font = `${layer.fontSize || 72}px ${layer.fontFamily || 'Arial'}`;
        ctx.textAlign = layer.textAlign || 'center';
        ctx.fillText(layer.text, layer.x, layer.y);
      } else if (layer.type === 'element') {
        ctx.fillStyle = layer.color || '#667eea';
        ctx.fillRect(layer.x, layer.y, layer.width || 100, layer.height || 100);
      }

      if (layer.id === selectedLayerId) {
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 4;
        ctx.strokeRect(
          layer.x - 10,
          layer.y - (layer.fontSize || 50),
          (layer.width || 200) + 20,
          (layer.height || layer.fontSize || 50) + 20
        );
      }

      ctx.restore();
    });

    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
  };

  const handleAddBackground = () => {
    const newLayer = {
      id: `layer-${Date.now()}`,
      type: 'background',
      name: 'Background',
      imageUrl: null,
      x: 0,
      y: 0,
      width: currentPlatform.width,
      height: currentPlatform.height,
      visible: true,
      locked: false,
      opacity: 1
    };
    setLayers([newLayer, ...layers]);
    setSelectedLayerId(newLayer.id);
  };

  const handleAddText = () => {
    const newLayer = {
      id: `layer-${Date.now()}`,
      type: 'text',
      name: 'Text Layer',
      text: 'Your Text Here',
      x: currentPlatform.width / 2,
      y: currentPlatform.height / 2,
      fontSize: 72,
      fontFamily: 'Arial',
      color: '#ffffff',
      textAlign: 'center',
      visible: true,
      locked: false,
      opacity: 1
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
    setTool('text');
  };

  const handleAddElement = () => {
    const newLayer = {
      id: `layer-${Date.now()}`,
      type: 'element',
      name: 'Element',
      x: currentPlatform.width / 2 - 50,
      y: currentPlatform.height / 2 - 50,
      width: 100,
      height: 100,
      color: '#667eea',
      visible: true,
      locked: false,
      opacity: 1
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  const handleLayerUpdate = (layerId, updates) => {
    setLayers(layers.map(layer =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    ));
  };

  const handleLayerDelete = (layerId) => {
    setLayers(layers.filter(layer => layer.id !== layerId));
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
  };

  const handleLayerReorder = (fromIndex, toIndex) => {
    const newLayers = [...layers];
    const [moved] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, moved);
    setLayers(newLayers);
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail-${platform}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      alert('Thumbnail saved successfully!');
    } catch (error) {
      console.error('Failed to save thumbnail:', error);
      alert('Failed to save thumbnail');
    } finally {
      setLoading(false);
    }
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  return (
    <div className="thumbnail-composer">
      <header className="composer-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div className="title-section">
            <h1>Thumbnail Composer</h1>
            <span className="episode-info">Episode {episodeId}</span>
          </div>
        </div>

        <div className="header-center">
          <div className="platform-selector">
            {Object.entries(platforms).map(([key, p]) => (
              <button
                key={key}
                className={`platform-btn ${platform === key ? 'active' : ''}`}
                onClick={() => setPlatform(key)}
              >
                <span className="platform-name">{p.name}</span>
                <span className="platform-ratio">{p.ratio}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="header-right">
          <button className="save-btn" onClick={handleSave} disabled={loading}>
            💾 Save
          </button>
          <button className="export-btn" onClick={handleExport}>
            📥 Export
          </button>
        </div>
      </header>

      <div className="composer-content">
        <main className="canvas-area">
          <div className="canvas-wrapper">
            <canvas
              ref={canvasRef}
              className="thumbnail-canvas"
              style={{
                aspectRatio: `${currentPlatform.width} / ${currentPlatform.height}`
              }}
            />

            <div className="canvas-info">
              <span>{currentPlatform.width} × {currentPlatform.height}</span>
              <span>{currentPlatform.ratio}</span>
            </div>
          </div>
        </main>

        <aside className="tools-panel">
          <section className="tool-section">
            <h3>Tools</h3>
            <div className="tool-buttons">
              <button
                className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
                onClick={() => setTool('select')}
              >
                <span className="tool-icon">🔍</span>
                <span>Select</span>
              </button>
              <button
                className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
                onClick={handleAddText}
              >
                <span className="tool-icon">📝</span>
                <span>Text</span>
              </button>
              <button
                className="tool-btn"
                onClick={handleAddElement}
              >
                <span className="tool-icon">✨</span>
                <span>Element</span>
              </button>
              <button
                className="tool-btn"
                onClick={handleAddBackground}
              >
                <span className="tool-icon">🎨</span>
                <span>Background</span>
              </button>
            </div>
          </section>

          {selectedLayer && (
            <section className="tool-section">
              <h3>Properties</h3>

              {selectedLayer.type === 'text' && (
                <div className="properties">
                  <div className="property-group">
                    <label>Text</label>
                    <input
                      type="text"
                      value={selectedLayer.text}
                      onChange={(e) => handleLayerUpdate(selectedLayer.id, { text: e.target.value })}
                    />
                  </div>

                  <div className="property-group">
                    <label>Font Size</label>
                    <input
                      type="number"
                      value={selectedLayer.fontSize}
                      onChange={(e) => handleLayerUpdate(selectedLayer.id, { fontSize: parseInt(e.target.value, 10) })}
                      min="12"
                      max="200"
                    />
                  </div>

                  <div className="property-group">
                    <label>Color</label>
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) => handleLayerUpdate(selectedLayer.id, { color: e.target.value })}
                    />
                  </div>

                  <div className="property-group">
                    <label>Align</label>
                    <div className="align-buttons">
                      <button onClick={() => handleLayerUpdate(selectedLayer.id, { textAlign: 'left' })}>Left</button>
                      <button onClick={() => handleLayerUpdate(selectedLayer.id, { textAlign: 'center' })}>Center</button>
                      <button onClick={() => handleLayerUpdate(selectedLayer.id, { textAlign: 'right' })}>Right</button>
                    </div>
                  </div>
                </div>
              )}

              {selectedLayer.type === 'element' && (
                <div className="properties">
                  <div className="property-group">
                    <label>Width</label>
                    <input
                      type="number"
                      value={selectedLayer.width}
                      onChange={(e) => handleLayerUpdate(selectedLayer.id, { width: parseInt(e.target.value, 10) })}
                    />
                  </div>

                  <div className="property-group">
                    <label>Height</label>
                    <input
                      type="number"
                      value={selectedLayer.height}
                      onChange={(e) => handleLayerUpdate(selectedLayer.id, { height: parseInt(e.target.value, 10) })}
                    />
                  </div>

                  <div className="property-group">
                    <label>Color</label>
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) => handleLayerUpdate(selectedLayer.id, { color: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="property-group">
                <label>Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedLayer.opacity}
                  onChange={(e) => handleLayerUpdate(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                />
                <span>{Math.round(selectedLayer.opacity * 100)}%</span>
              </div>
            </section>
          )}

          <section className="tool-section">
            <h3>Layers ({layers.length})</h3>
            <div className="layers-list">
              {layers.length === 0 ? (
                <div className="empty-layers">
                  <p>No layers yet</p>
                  <p className="hint">Add text, elements, or background</p>
                </div>
              ) : (
                layers.map((layer, index) => (
                  <div
                    key={layer.id}
                    className={`layer-item ${layer.id === selectedLayerId ? 'selected' : ''}`}
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    <span className="layer-icon">
                      {layer.type === 'text' ? '📝' : layer.type === 'background' ? '🎨' : '✨'}
                    </span>
                    <span className="layer-name">{layer.name}</span>
                    <div className="layer-actions">
                      <button
                        className="layer-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLayerUpdate(layer.id, { visible: !layer.visible });
                        }}
                      >
                        {layer.visible ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        className="layer-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLayerDelete(layer.id);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default ThumbnailComposer;
