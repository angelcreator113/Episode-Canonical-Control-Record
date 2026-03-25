import React from 'react';
import { Image, Sparkles } from 'lucide-react';

/**
 * TemplatesTab — Pre-built scene templates to start from instead of blank canvas.
 * Each template provides a starting prompt for background generation
 * and suggested objects.
 */

const TEMPLATES = [
  {
    id: 'bedroom-luxury',
    name: 'Luxury Bedroom',
    description: 'Elegant bedroom with gold accents, silk bedding, chandelier',
    prompt: 'Luxury bedroom interior, gold and blush pink palette, silk bedding, ornate chandelier, floor-length curtains, soft morning light',
    suggestedObjects: ['Chandelier', 'Vanity Mirror', 'Throw Pillows', 'Candles'],
    icon: '🛏️',
  },
  {
    id: 'closet-glam',
    name: 'Walk-In Closet',
    description: 'Glamorous walk-in closet with mirror walls and lighting',
    prompt: 'Glamorous walk-in closet, floor-to-ceiling shelves, soft LED lighting, velvet ottomans, crystal knobs, mirror walls',
    suggestedObjects: ['Hat Box', 'Jewelry Display', 'Shoe Rack', 'Full Mirror'],
    icon: '👗',
  },
  {
    id: 'bathroom-spa',
    name: 'Spa Bathroom',
    description: 'Serene spa-like bathroom with marble and gold fixtures',
    prompt: 'Spa bathroom interior, marble countertops, gold fixtures, freestanding bathtub, candles, eucalyptus plant, steam',
    suggestedObjects: ['Candles', 'Towel Stack', 'Bath Caddy', 'Plants'],
    icon: '🛁',
  },
  {
    id: 'living-room',
    name: 'Living Room',
    description: 'Cozy living room with plush furniture and warm lighting',
    prompt: 'Elegant living room, plush velvet sofa, marble coffee table, gold floor lamp, art on walls, warm afternoon light, fresh flowers',
    suggestedObjects: ['Coffee Table Books', 'Flower Vase', 'Throw Blanket', 'Art Frame'],
    icon: '🛋️',
  },
  {
    id: 'kitchen-modern',
    name: 'Modern Kitchen',
    description: 'Sleek kitchen with marble island and pendant lights',
    prompt: 'Modern luxury kitchen, marble island counter, pendant lights, brass hardware, wine glasses, fresh fruit bowl, morning light through window',
    suggestedObjects: ['Wine Glasses', 'Fruit Bowl', 'Cookbook', 'Cutting Board'],
    icon: '🍳',
  },
  {
    id: 'outdoor-patio',
    name: 'Patio / Balcony',
    description: 'Dreamy outdoor space with string lights and plants',
    prompt: 'Dreamy outdoor patio, string lights, lush potted plants, rattan furniture, sunset sky, cozy blankets, candles on table',
    suggestedObjects: ['String Lights', 'Potted Plant', 'Lantern', 'Cushions'],
    icon: '🌿',
  },
];

export default function TemplatesTab({ onSelectTemplate }) {
  return (
    <div className="scene-studio-templates-tab">
      <div className="scene-studio-section-label">
        <Sparkles size={12} /> Scene Templates
      </div>
      <p className="scene-studio-hint-text">
        Start with a pre-designed scene. The background will be generated and suggested objects will appear.
      </p>

      <div className="scene-studio-templates-grid">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            className="scene-studio-template-card"
            onClick={() => onSelectTemplate(tpl)}
          >
            <span className="scene-studio-template-icon">{tpl.icon}</span>
            <div className="scene-studio-template-info">
              <span className="scene-studio-template-name">{tpl.name}</span>
              <span className="scene-studio-template-desc">{tpl.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
