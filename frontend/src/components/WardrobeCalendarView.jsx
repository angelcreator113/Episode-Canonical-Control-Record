/**
 * WardrobeCalendarView Component
 * Calendar view for outfit planning across episodes
 */

import React from 'react';

const WardrobeCalendarView = ({ items, onEditItem }) => {
  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <h3>📅 Outfit Planning Calendar</h3>
        <p className="calendar-subtitle">Plan and organize outfits across episodes</p>
      </div>
      
      <div className="calendar-grid">
        {items.map(item => {
          const plannedEpisodes = item.metadata?.plannedForEpisodes || [];
          const linkedEpisodes = item.metadata?.linkedEpisodes || [];
          const character = item.metadata?.character || 'unassigned';
          
          return (
            <div key={item.id} className="calendar-item" data-character={character}>
              <div className="calendar-item-image">
                {item.s3_url_raw ? (
                  <img src={item.s3_url_raw} alt={item.name} />
                ) : (
                  <div className="placeholder">👗</div>
                )}
              </div>
              
              <div className="calendar-item-info">
                <h4>{item.name}</h4>
                <p className="brand">{item.metadata?.brand}</p>
                
                {item.metadata?.price && (
                  <p className="price">${item.metadata.price}</p>
                )}
                
                <div className="episode-badges">
                  {linkedEpisodes.map((epId, idx) => (
                    <span key={idx} className="episode-badge">Ep {epId}</span>
                  ))}
                </div>
                
                {plannedEpisodes.length > 0 && (
                  <div className="planned-for">
                    📌 Planned: {plannedEpisodes.join(', ')}
                  </div>
                )}
                
                <button 
                  className="btn-edit-item"
                  onClick={() => onEditItem(item)}
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
          );
        })}
        
        {items.length === 0 && (
          <div className="calendar-empty">
            <span className="empty-icon">📅</span>
            <p>No items match your filters</p>
          </div>
        )}
      </div>
      
      <div className="calendar-legend">
        <span className="legend-item" data-character="lala">💜 Lala</span>
        <span className="legend-item" data-character="justawoman">👩 Just a Woman</span>
        <span className="legend-item" data-character="guest">🎭 Guest</span>
      </div>
    </div>
  );
};

export default WardrobeCalendarView;
