import React, { useState } from 'react';
import { Image, Upload, Sparkles, Pentagon, Type, Flower2 } from 'lucide-react';
import LibraryTab from './tabs/LibraryTab';
import UploadTab from './tabs/UploadTab';
import GenerateTab from './tabs/GenerateTab';
import ShapesTab from './tabs/ShapesTab';
import TextTab from './tabs/TextTab';
import DecorTab from './tabs/DecorTab';

/**
 * CreationPanel — Canva-style icon sidebar + content area.
 * Replaces the old AssetDrawer with a multi-tab creation rail.
 */

const CREATION_TABS = [
  { key: 'library', label: 'Library', icon: Image },
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'generate', label: 'Generate', icon: Sparkles },
  { key: 'shapes', label: 'Shapes', icon: Pentagon },
  { key: 'text', label: 'Text', icon: Type },
  { key: 'decor', label: 'Decor', icon: Flower2 },
];

export default function CreationPanel({
  showId,
  episodeId,
  sceneId,
  canvasWidth,
  canvasHeight,
  onAddAsset,
  onAddObject,
}) {
  const [activeTab, setActiveTab] = useState('library');

  const renderContent = () => {
    switch (activeTab) {
      case 'library':
        return (
          <LibraryTab
            showId={showId}
            episodeId={episodeId}
            onAddAsset={onAddAsset}
          />
        );
      case 'upload':
        return (
          <UploadTab
            showId={showId}
            episodeId={episodeId}
            onAddAsset={onAddAsset}
          />
        );
      case 'generate':
        return (
          <GenerateTab
            sceneId={sceneId}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onAddAsset={onAddAsset}
          />
        );
      case 'shapes':
        return (
          <ShapesTab
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onAddObject={onAddObject}
          />
        );
      case 'text':
        return (
          <TextTab
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            onAddObject={onAddObject}
          />
        );
      case 'decor':
        return (
          <DecorTab
            showId={showId}
            episodeId={episodeId}
            onAddAsset={onAddAsset}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="scene-studio-creation-panel">
      {/* Vertical icon nav */}
      <div className="scene-studio-creation-nav">
        {CREATION_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`scene-studio-creation-nav-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              title={tab.label}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="scene-studio-creation-content">
        {renderContent()}
      </div>
    </div>
  );
}
