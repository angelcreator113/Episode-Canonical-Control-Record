/**
 * Wardrobe Analytics Dashboard
 * Visual analytics for spending, most worn items, and wardrobe insights
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import wardrobeEnhancements from '../utils/wardrobeEnhancements';
import './WardrobeAnalytics.css';

const WardrobeAnalytics = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colorAnalytics, setColorAnalytics] = useState(null);
  const [brandAnalytics, setBrandAnalytics] = useState(null);
  const [budgetTimeline, setBudgetTimeline] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalSpent: 0,
    totalItems: 0,
    avgPrice: 0,
    mostExpensiveItem: null,
    leastExpensiveItem: null,
    spendingByCharacter: {},
    spendingByCategory: {},
    spendingBySeason: {},
    itemsByCharacter: {},
    itemsByCategory: {},
    mostWornItems: [],
    recentPurchases: [],
    favoriteItems: [],
    // ROI fields
    bestROI: [],
    worstROI: [],
    neverWorn: [],
    neverWornTotal: 0,
    avgCostPerWear: 0
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/wardrobe?limit=1000`);
      
      if (!response.ok) {
        console.error('Failed to load wardrobe:', response.status);
        return;
      }

      const data = await response.json();
      const wardrobeItems = data.data || [];
      setItems(wardrobeItems);
      
      calculateAnalytics(wardrobeItems);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (wardrobeItems) => {
    const spendingByCharacter = {};
    const spendingByCategory = {};
    const spendingBySeason = {};
    const itemsByCharacter = {};
    const itemsByCategory = {};
    
    let totalSpent = 0;
    let priceCount = 0;
    let mostExpensive = null;
    let leastExpensive = null;

    wardrobeItems.forEach(item => {
      const price = parseFloat(item.price) || 0;
      
      // Total spending
      if (price > 0) {
        totalSpent += price;
        priceCount++;
        
        if (!mostExpensive || price > parseFloat(mostExpensive.price)) {
          mostExpensive = item;
        }
        if (!leastExpensive || price < parseFloat(leastExpensive.price)) {
          leastExpensive = item;
        }
      }
      
      // By character
      if (item.character) {
        spendingByCharacter[item.character] = (spendingByCharacter[item.character] || 0) + price;
        itemsByCharacter[item.character] = (itemsByCharacter[item.character] || 0) + 1;
      }
      
      // By category
      if (item.clothing_category) {
        spendingByCategory[item.clothing_category] = (spendingByCategory[item.clothing_category] || 0) + price;
        itemsByCategory[item.clothing_category] = (itemsByCategory[item.clothing_category] || 0) + 1;
      }
      
      // By season
      if (item.season) {
        spendingBySeason[item.season] = (spendingBySeason[item.season] || 0) + price;
      }
    });

    const avgPrice = priceCount > 0 ? totalSpent / priceCount : 0;
    
    // Most worn items (sorted by times_worn)
    const mostWorn = [...wardrobeItems]
      .filter(item => item.times_worn > 0)
      .sort((a, b) => b.times_worn - a.times_worn)
      .slice(0, 5);
    
    // Recent purchases (sorted by created_at)
    const recent = [...wardrobeItems]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    
    // Favorite items
    const favorites = wardrobeItems.filter(item => item.is_favorite);
    
    // Cost-per-wear / ROI analysis
    const itemsWithCostPerWear = wardrobeItems
      .filter(item => parseFloat(item.price) > 0 && item.times_worn > 0)
      .map(item => ({
        ...item,
        costPerWear: parseFloat(item.price) / item.times_worn
      }));
    
    // Best ROI (lowest cost per wear)
    const bestROI = [...itemsWithCostPerWear]
      .sort((a, b) => a.costPerWear - b.costPerWear)
      .slice(0, 5);
    
    // Worst ROI (highest cost per wear among worn items)
    const worstROI = [...itemsWithCostPerWear]
      .sort((a, b) => b.costPerWear - a.costPerWear)
      .slice(0, 5);
    
    // Never worn items with price (wasted potential)
    const neverWorn = wardrobeItems
      .filter(item => parseFloat(item.price) > 0 && (!item.times_worn || item.times_worn === 0))
      .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
      .slice(0, 5);
    
    const neverWornTotal = wardrobeItems
      .filter(item => parseFloat(item.price) > 0 && (!item.times_worn || item.times_worn === 0))
      .reduce((sum, item) => sum + parseFloat(item.price), 0);
    
    const avgCostPerWear = itemsWithCostPerWear.length > 0
      ? itemsWithCostPerWear.reduce((sum, item) => sum + item.costPerWear, 0) / itemsWithCostPerWear.length
      : 0;

    // Color analytics
    const colors = wardrobeEnhancements.analyzeColors(wardrobeItems);
    setColorAnalytics(colors);

    // Brand analytics
    const brands = wardrobeEnhancements.analyzeBrands(wardrobeItems);
    setBrandAnalytics(brands);

    // Budget timeline - group items by episode
    const episodeSpending = {};
    wardrobeItems.forEach(item => {
      if (item.episode_id) {
        const key = item.episode_title || `Episode ${item.episode_id}`;
        if (!episodeSpending[key]) {
          episodeSpending[key] = { episode: key, spending: 0, count: 0 };
        }
        episodeSpending[key].spending += parseFloat(item.price) || 0;
        episodeSpending[key].count += 1;
      }
    });
    const timeline = Object.values(episodeSpending)
      .sort((a, b) => a.episode.localeCompare(b.episode))
      .slice(0, 20);
    setBudgetTimeline(timeline);

    setAnalytics({
      totalSpent,
      totalItems: wardrobeItems.length,
      avgPrice,
      mostExpensiveItem: mostExpensive,
      leastExpensiveItem: leastExpensive,
      spendingByCharacter,
      spendingByCategory,
      spendingBySeason,
      itemsByCharacter,
      itemsByCategory,
      mostWornItems: mostWorn,
      recentPurchases: recent,
      favoriteItems: favorites,
      // ROI metrics
      bestROI,
      worstROI,
      neverWorn,
      neverWornTotal,
      avgCostPerWear
    });
  };

  const renderBarChart = (data, title, colorClass) => {
    const maxValue = Math.max(...Object.values(data));
    
    return (
      <div className="chart-container">
        <h3>{title}</h3>
        <div className="bar-chart">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="bar-item">
              <div className="bar-label">{key}</div>
              <div className="bar-wrapper">
                <div 
                  className={`bar ${colorClass}`}
                  style={{ width: `${(value / maxValue) * 100}%` }}
                >
                  <span className="bar-value">${value.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPieChart = (data, title) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a'];
    
    let currentAngle = 0;
    const segments = Object.entries(data).map(([key, value], index) => {
      const percentage = (value / total) * 100;
      const angle = (percentage / 100) * 360;
      const rotation = currentAngle;
      currentAngle += angle;
      
      return { key, value, percentage, rotation, angle, color: colors[index % colors.length] };
    });

    return (
      <div className="chart-container">
        <h3>{title}</h3>
        <div className="pie-chart-wrapper">
          <div className="pie-chart">
            {segments.map((segment, index) => (
              <div
                key={segment.key}
                className="pie-segment"
                style={{
                  '--rotation': `${segment.rotation}deg`,
                  '--angle': `${segment.angle}deg`,
                  '--color': segment.color
                }}
              />
            ))}
          </div>
          <div className="pie-legend">
            {segments.map(segment => (
              <div key={segment.key} className="legend-item">
                <span className="legend-color" style={{ background: segment.color }}></span>
                <span className="legend-label">{segment.key}</span>
                <span className="legend-value">{segment.value} ({segment.percentage.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  return (
    <div className="wardrobe-analytics-page">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-content">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>📊 Wardrobe Analytics</h1>
          <p>Insights and spending analysis</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-value">${analytics.totalSpent.toFixed(2)}</div>
          <div className="metric-label">Total Spent</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">👗</div>
          <div className="metric-value">{analytics.totalItems}</div>
          <div className="metric-label">Total Items</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-value">${analytics.avgPrice.toFixed(2)}</div>
          <div className="metric-label">Avg Price/Item</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">⭐</div>
          <div className="metric-value">{analytics.favoriteItems.length}</div>
          <div className="metric-label">Favorites</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {Object.keys(analytics.spendingByCharacter).length > 0 && 
          renderBarChart(analytics.spendingByCharacter, '💵 Spending by Character', 'bar-character')}
        
        {Object.keys(analytics.spendingByCategory).length > 0 && 
          renderBarChart(analytics.spendingByCategory, '🏷️ Spending by Category', 'bar-category')}
      </div>

      {/* Pie Charts */}
      {Object.keys(analytics.itemsByCategory).length > 0 && (
        <div className="charts-row">
          {renderPieChart(analytics.itemsByCategory, '📦 Items by Category')}
          {Object.keys(analytics.itemsByCharacter).length > 0 && 
            renderPieChart(analytics.itemsByCharacter, '👤 Items by Character')}
        </div>
      )}

      {/* Most Worn Items */}
      {analytics.mostWornItems.length > 0 && (
        <div className="section-card">
          <h2>🔥 Most Worn Items</h2>
          <div className="items-list">
            {analytics.mostWornItems.map(item => (
              <div key={item.id} className="item-row">
                <div className="item-image-small">
                  {item.s3_url ? (
                    <img src={item.s3_url} alt={item.name} />
                  ) : (
                    <div className="placeholder">👗</div>
                  )}
                </div>
                <div className="item-info-row">
                  <div className="item-name-row">{item.name}</div>
                  <div className="item-meta-row">
                    <span className="character-tag">{item.character}</span>
                    <span className="category-tag">{item.clothing_category}</span>
                  </div>
                </div>
                <div className="item-stat">
                  <div className="stat-value">{item.times_worn}x</div>
                  <div className="stat-label">Worn</div>
                </div>
                {item.price && (
                  <div className="item-stat">
                    <div className="stat-value">${(parseFloat(item.price) / item.times_worn).toFixed(2)}</div>
                    <div className="stat-label">Cost/Wear</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROI Analysis Section */}
      <div className="section-card roi-section">
        <h2>💎 ROI Analysis (Cost-Per-Wear)</h2>
        <div className="roi-metrics">
          <div className="roi-metric-card">
            <div className="roi-metric-icon">📉</div>
            <div className="roi-metric-value">${analytics.avgCostPerWear.toFixed(2)}</div>
            <div className="roi-metric-label">Avg Cost Per Wear</div>
          </div>
          <div className="roi-metric-card warning">
            <div className="roi-metric-icon">⚠️</div>
            <div className="roi-metric-value">${analytics.neverWornTotal.toFixed(0)}</div>
            <div className="roi-metric-label">Spent on Never Worn</div>
          </div>
          <div className="roi-metric-card">
            <div className="roi-metric-icon">📊</div>
            <div className="roi-metric-value">{analytics.neverWorn.length > 0 ? analytics.neverWorn.length : 0}</div>
            <div className="roi-metric-label">Items Never Worn</div>
          </div>
        </div>
        
        <div className="roi-lists">
          {/* Best ROI */}
          {analytics.bestROI.length > 0 && (
            <div className="roi-list best-roi">
              <h3>🏆 Best Value (Lowest $/Wear)</h3>
              <div className="roi-items">
                {analytics.bestROI.map((item, index) => (
                  <div key={item.id} className="roi-item">
                    <div className="roi-rank">{index + 1}</div>
                    <div className="roi-image">
                      {item.s3_url ? (
                        <img src={item.s3_url} alt={item.name} />
                      ) : (
                        <div className="placeholder">👗</div>
                      )}
                    </div>
                    <div className="roi-info">
                      <div className="roi-name">{item.name}</div>
                      <div className="roi-meta">{item.character} • {item.times_worn}x worn</div>
                    </div>
                    <div className="roi-cost-per-wear best">${item.costPerWear.toFixed(2)}/wear</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Worst ROI */}
          {analytics.worstROI.length > 0 && (
            <div className="roi-list worst-roi">
              <h3>📈 Needs More Wear (Highest $/Wear)</h3>
              <div className="roi-items">
                {analytics.worstROI.map((item, index) => (
                  <div key={item.id} className="roi-item">
                    <div className="roi-rank">{index + 1}</div>
                    <div className="roi-image">
                      {item.s3_url ? (
                        <img src={item.s3_url} alt={item.name} />
                      ) : (
                        <div className="placeholder">👗</div>
                      )}
                    </div>
                    <div className="roi-info">
                      <div className="roi-name">{item.name}</div>
                      <div className="roi-meta">{item.character} • {item.times_worn}x worn</div>
                    </div>
                    <div className="roi-cost-per-wear worst">${item.costPerWear.toFixed(2)}/wear</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Never Worn */}
          {analytics.neverWorn.length > 0 && (
            <div className="roi-list never-worn">
              <h3>🚨 Never Worn (Highest Cost)</h3>
              <div className="roi-items">
                {analytics.neverWorn.map((item, index) => (
                  <div key={item.id} className="roi-item">
                    <div className="roi-rank">{index + 1}</div>
                    <div className="roi-image">
                      {item.s3_url ? (
                        <img src={item.s3_url} alt={item.name} />
                      ) : (
                        <div className="placeholder">👗</div>
                      )}
                    </div>
                    <div className="roi-info">
                      <div className="roi-name">{item.name}</div>
                      <div className="roi-meta">{item.character} • ${item.price}</div>
                    </div>
                    <div className="roi-cost-per-wear never">Not Used</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Price Extremes */}
      <div className="extremes-row">
        {analytics.mostExpensiveItem && (
          <div className="extreme-card">
            <h3>💎 Most Expensive</h3>
            <div className="extreme-content">
              <div className="item-image-medium">
                {analytics.mostExpensiveItem.s3_url ? (
                  <img src={analytics.mostExpensiveItem.s3_url} alt={analytics.mostExpensiveItem.name} />
                ) : (
                  <div className="placeholder">👗</div>
                )}
              </div>
              <div className="extreme-info">
                <h4>{analytics.mostExpensiveItem.name}</h4>
                <p className="price">${analytics.mostExpensiveItem.price}</p>
                <p className="meta">{analytics.mostExpensiveItem.character} • {analytics.mostExpensiveItem.clothing_category}</p>
              </div>
            </div>
          </div>
        )}

        {analytics.leastExpensiveItem && (
          <div className="extreme-card">
            <h3>💸 Best Value</h3>
            <div className="extreme-content">
              <div className="item-image-medium">
                {analytics.leastExpensiveItem.s3_url ? (
                  <img src={analytics.leastExpensiveItem.s3_url} alt={analytics.leastExpensiveItem.name} />
                ) : (
                  <div className="placeholder">👗</div>
                )}
              </div>
              <div className="extreme-info">
                <h4>{analytics.leastExpensiveItem.name}</h4>
                <p className="price">${analytics.leastExpensiveItem.price}</p>
                <p className="meta">{analytics.leastExpensiveItem.character} • {analytics.leastExpensiveItem.clothing_category}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Color Analytics */}
      {colorAnalytics && colorAnalytics.topColors.length > 0 && (
        <div className="section-card">
          <h2>🎨 Color Distribution</h2>
          <div className="color-chart">
            {colorAnalytics.topColors.map((colorStat, index) => (
              <div key={colorStat.color} className="color-bar-item">
                <div className="color-info">
                  <span className="color-name">{colorStat.color}</span>
                  <span className="color-count">{colorStat.count} items ({colorStat.percentage}%)</span>
                </div>
                <div className="color-bar-wrapper">
                  <div 
                    className="color-bar-fill"
                    style={{ 
                      width: `${colorStat.percentage}%`,
                      background: `linear-gradient(90deg, hsl(${index * 60}, 70%, 60%), hsl(${index * 60 + 30}, 70%, 50%))`
                    }}
                  >
                    <span className="bar-percentage">{colorStat.percentage}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="color-summary">
            <p>📊 <strong>{colorAnalytics.totalUnique}</strong> unique colors in your wardrobe</p>
          </div>
        </div>
      )}

      {/* Brand Analytics */}
      {brandAnalytics && brandAnalytics.topBrands.length > 0 && (
        <div className="section-card">
          <h2>🏷️ Brand Analytics</h2>
          <div className="brand-analytics-grid">
            <div className="brand-spending">
              <h3>Top Brands by Spending</h3>
              <div className="brand-list">
                {brandAnalytics.topBrands.slice(0, 5).map((brand, index) => (
                  <div key={brand.name} className="brand-item">
                    <div className="brand-rank">{index + 1}</div>
                    <div className="brand-info">
                      <span className="brand-name">{brand.name}</span>
                      <span className="brand-stats">{brand.count} items</span>
                    </div>
                    <div className="brand-spending-amount">${brand.totalSpent.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="brand-summary">
              <div className="brand-stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <div className="stat-number">{brandAnalytics.totalBrands}</div>
                  <div className="stat-text">Total Brands</div>
                </div>
              </div>
              {brandAnalytics.mostExpensive && (
                <div className="brand-stat-card highlight">
                  <div className="stat-icon">👑</div>
                  <div className="stat-content">
                    <div className="stat-number">{brandAnalytics.mostExpensive.brand}</div>
                    <div className="stat-text">Most Expensive Brand</div>
                    <div className="stat-detail">${brandAnalytics.mostExpensive.price} avg</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Budget Timeline */}
      {budgetTimeline && budgetTimeline.length > 0 && (
        <div className="section-card">
          <h2>📈 Budget Timeline</h2>
          <p className="chart-subtitle">Costume spending across episodes</p>
          <div className="timeline-chart">
            <div className="timeline-bars">
              {budgetTimeline.map((point, index) => {
                const maxSpending = Math.max(...budgetTimeline.map(p => p.spending));
                const height = (point.spending / maxSpending) * 100;
                return (
                  <div key={point.episode} className="timeline-bar-wrapper">
                    <div 
                      className="timeline-bar"
                      style={{ 
                        height: `${height}%`,
                        background: `linear-gradient(180deg, #667eea ${0}%, #764ba2 ${100}%)`
                      }}
                      title={`${point.episode}: $${point.spending.toFixed(2)}`}
                    >
                      <span className="bar-value">${point.spending.toFixed(0)}</span>
                    </div>
                    <div className="timeline-label">{point.episode}</div>
                  </div>
                );
              })}
            </div>
            <div className="timeline-stats">
              <div className="timeline-stat">
                <span className="stat-label">Total Episodes:</span>
                <span className="stat-value">{budgetTimeline.length}</span>
              </div>
              <div className="timeline-stat">
                <span className="stat-label">Avg per Episode:</span>
                <span className="stat-value">
                  ${(budgetTimeline.reduce((sum, p) => sum + p.spending, 0) / budgetTimeline.length).toFixed(2)}
                </span>
              </div>
              <div className="timeline-stat">
                <span className="stat-label">Peak Episode:</span>
                <span className="stat-value">
                  {budgetTimeline.reduce((max, p) => p.spending > max.spending ? p : max).episode}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Purchases */}
      {analytics.recentPurchases.length > 0 && (
        <div className="section-card">
          <h2>🆕 Recent Additions</h2>
          <div className="items-grid">
            {analytics.recentPurchases.map(item => (
              <div key={item.id} className="item-card-small">
                <div className="item-image-small">
                  {item.s3_url ? (
                    <img src={item.s3_url} alt={item.name} />
                  ) : (
                    <div className="placeholder">👗</div>
                  )}
                </div>
                <div className="item-details-small">
                  <h4>{item.name}</h4>
                  {item.price && <p className="price">${item.price}</p>}
                  <p className="meta">{item.character}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WardrobeAnalytics;
