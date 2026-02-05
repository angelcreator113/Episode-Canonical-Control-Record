import React, { useState, useEffect } from 'react';

/**
 * AssetDrawer - Left drawer with scenes, assets, wardrobes
 * 
 * User can drag items onto the canvas to add them as elements
 */
export default function AssetDrawer({ episodeId, elements, onAddElement }) {
  const [activeTab, setActiveTab] = useState('scenes');
  const [scenes, setScenes] = useState([]);
  const [assets, setAssets] = useState([]);
  const [wardrobes, setWardrobes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAssets();
  }, [episodeId, activeTab]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/episodes/${episodeId}`);
      const data = await response.json();

      if (data.success) {
        setScenes(data.data.scenes || []);
        setAssets(data.data.assets || []);
        setWardrobes(data.data.wardrobes || []);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddElement = (item, type) => {
    // Check if already added
    const existingId = `${type}-${item.id}`;
    if (elements.find(el => el.id === existingId)) {
      alert('This item is already in the scene');
      return;
    }

    const newElement = {
      id: existingId,
      type: 'image',
      role: type === 'scene' ? 'hero' : 'overlay',
      assetId: item.id,
      sourceType: type,
      transform: {
        x: 100,
        y: 100,
        width: type === 'scene' ? 600 : 300,
        height: type === 'scene' ? 400 : 200,
        rotation: 0,
        scale: 1
      },
      zIndex: elements.length + 1,
      locked: false,
      hidden: false,
      metadata: {
        name: item.title || item.name || 'Untitled',
        thumbnail: item.thumbnail_url || item.image_url || item.s3_url_processed
      }
    };

    onAddElement(newElement);
  };

  const renderList = (items, type) => {
    if (loading) {
      return <div className="drawer-loading">Loading...</div>;
    }

    if (items.length === 0) {
      return <div className="drawer-empty">No {type}s available</div>;
    }

    return (
      <div className="drawer-list">
        {items.map(item => (
          <div
            key={item.id}
            className="drawer-item"
            onClick={() => handleAddElement(item, type)}
          >
            <div className="drawer-item-thumbnail">
              {(item.thumbnail_url || item.image_url || item.s3_url_processed) ? (
                <img
                  src={item.thumbnail_url || item.image_url || item.s3_url_processed}
                  alt={item.title || item.name}
                />
              ) : (
                <div className="drawer-item-placeholder">
                  {type === 'scene' ? '🎬' : type === 'asset' ? '🖼️' : '👗'}
                </div>
              )}
            </div>
            <div className="drawer-item-name">
              {item.title || item.name || 'Untitled'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="asset-drawer">
      <div className="drawer-tabs">
        <button
          className={`drawer-tab ${activeTab === 'scenes' ? 'active' : ''}`}
          onClick={() => setActiveTab('scenes')}
        >
          🎬 Scenes
        </button>
        <button
          className={`drawer-tab ${activeTab === 'assets' ? 'active' : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          🖼️ Assets
        </button>
        <button
          className={`drawer-tab ${activeTab === 'wardrobes' ? 'active' : ''}`}
          onClick={() => setActiveTab('wardrobes')}
        >
          👗 Wardrobe
        </button>
      </div>

      <div className="drawer-content">
        {activeTab === 'scenes' && renderList(scenes, 'scene')}
        {activeTab === 'assets' && renderList(assets, 'asset')}
        {activeTab === 'wardrobes' && renderList(wardrobes, 'wardrobe')}
      </div>
    </div>
  );
}
