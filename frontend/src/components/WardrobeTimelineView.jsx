/**
 * WardrobeTimelineView Component
 * Timeline view for tracking outfit wear history
 */

import React from 'react';

const WardrobeTimelineView = ({ items, onEditItem }) => {
  const itemsWithHistory = items.filter(
    item => item.metadata?.timesWorn > 0 || item.metadata?.previousEpisodes?.length > 0
  );

  return (
    <div className="timeline-view">
      <div className="timeline-header">
        <h3>📊 Outfit History Timeline</h3>
        <p className="timeline-subtitle">Track when and how many times each item has been worn</p>
      </div>
      
      <div className="timeline-container">
        {itemsWithHistory.map(item => {
          const timesWorn = item.metadata?.timesWorn || 0;
          const lastWorn = item.metadata?.lastWorn;
          const previousEpisodes = item.metadata?.previousEpisodes || [];
          
          return (
            <div key={item.id} className="timeline-item">
              <div className="timeline-item-header">
                <div className="timeline-item-image">
                  {item.s3_url_raw ? (
                    <img src={item.s3_url_raw} alt={item.name} />
                  ) : (
                    <div className="placeholder">👗</div>
                  )}
                </div>
                
                <div className="timeline-item-title">
                  <h4>{item.name}</h4>
                  <p>{item.metadata?.brand}</p>
                  {item.metadata?.price && (
                    <span className="price">${item.metadata.price}</span>
                  )}
                </div>
              </div>
              
              <div className="timeline-wear-history">
                <div className="wear-stats">
                  <span className="stat">👔 {timesWorn}x worn</span>
                  {lastWorn && (
                    <span className="stat">
                      📅 Last: {new Date(lastWorn).toLocaleDateString()}
                    </span>
                  )}
                </div>
                
                {previousEpisodes.length > 0 && (
                  <div className="episode-history">
                    <strong>Previously worn in:</strong>
                    <div className="episode-timeline">
                      {previousEpisodes.map((epId, idx) => (
                        <span key={idx} className="timeline-episode-badge">
                          Episode {epId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                className="btn-edit-item"
                onClick={() => onEditItem(item)}
              >
                ✏️ Edit
              </button>
            </div>
          );
        })}
        
        {itemsWithHistory.length === 0 && (
          <div className="timeline-empty">
            <span className="empty-icon">📊</span>
            <p>No wear history yet. Items will appear here once they've been worn in episodes.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WardrobeTimelineView;
