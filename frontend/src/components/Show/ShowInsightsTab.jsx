// frontend/src/components/Show/ShowInsightsTab.jsx
import React, { useState, useEffect } from 'react';
import './ShowInsightsTab.css';

/**
 * ShowInsightsTab - Analytics Dashboard for Show
 * 
 * Features:
 * - Total episodes, views, engagement metrics
 * - Platform breakdown (YouTube, TikTok, Instagram, Facebook)
 * - Top performing episodes table
 * - Growth trends chart
 * - Asset/wardrobe usage stats
 * - AI-powered insights
 * - Recent activity timeline
 */

function ShowInsightsTab({ show }) {
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, all
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadInsights();
  }, [show.id, timeRange]);
  
  const loadInsights = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await insightsService.getShowInsights(show.id, timeRange);
      
      // Mock data
      setMetrics({
        overview: {
          totalEpisodes: 24,
          publishedEpisodes: 18,
          draftEpisodes: 4,
          scheduledEpisodes: 2,
          totalViews: 156789,
          totalLikes: 12456,
          totalComments: 3421,
          totalShares: 1876,
          avgViewsPerEpisode: 8710,
          engagementRate: 11.2
        },
        platformBreakdown: [
          { platform: 'YouTube', views: 89234, percentage: 56.9, color: '#FF0000' },
          { platform: 'TikTok', views: 42156, percentage: 26.9, color: '#000000' },
          { platform: 'Instagram', views: 18765, percentage: 12.0, color: '#E4405F' },
          { platform: 'Facebook', views: 6634, percentage: 4.2, color: '#1877F2' }
        ],
        topEpisodes: [
          { 
            id: '1', 
            title: "LaLa's Princess Fair Adventure", 
            views: 23456, 
            likes: 2345, 
            engagement: 12.5,
            platform: 'YouTube',
            publishedDate: '2026-01-15'
          },
          { 
            id: '2', 
            title: 'Fall Fashion Haul 2026', 
            views: 18932, 
            likes: 2109, 
            engagement: 11.8,
            platform: 'TikTok',
            publishedDate: '2026-01-10'
          },
          { 
            id: '3', 
            title: 'Behind the Scenes: Studio Tour', 
            views: 15678, 
            likes: 1876, 
            engagement: 10.2,
            platform: 'YouTube',
            publishedDate: '2026-01-05'
          }
        ],
        assetUsage: {
          mostUsedAssets: [
            { name: 'Show Logo', type: 'logo', usageCount: 18 },
            { name: 'Intro Music', type: 'audio', usageCount: 16 },
            { name: 'Studio Background', type: 'background', usageCount: 12 }
          ],
          mostUsedWardrobe: [
            { name: 'Pink Blazer', category: 'top', wornCount: 8 },
            { name: 'Classic Pumps', category: 'shoes', wornCount: 7 },
            { name: 'Statement Necklace', category: 'jewelry', wornCount: 6 }
          ]
        },
        growthTrend: [
          { date: '2026-01-01', views: 1200, episodes: 1 },
          { date: '2026-01-08', views: 3400, episodes: 2 },
          { date: '2026-01-15', views: 5800, episodes: 3 },
          { date: '2026-01-22', views: 8200, episodes: 4 },
          { date: '2026-01-29', views: 11500, episodes: 5 }
        ],
        aiInsights: [
          {
            type: 'trend',
            icon: '📈',
            title: 'Growing Audience',
            message: 'Your viewership has increased 45% in the last 30 days. Keep up the great content!'
          },
          {
            type: 'recommendation',
            icon: '💡',
            title: 'Best Publishing Time',
            message: 'Episodes published on Tuesdays at 2 PM get 23% more views on average.'
          },
          {
            type: 'achievement',
            icon: '🏆',
            title: 'Consistency Win',
            message: "You've published 4 episodes this month. Consistency drives growth!"
          }
        ],
        recentActivity: [
          { type: 'publish', message: 'Episode "Princess Fair" published', time: '2 hours ago' },
          { type: 'milestone', message: 'Reached 150,000 total views!', time: '5 hours ago' },
          { type: 'upload', message: 'New asset "Winter Background" uploaded', time: '1 day ago' },
          { type: 'schedule', message: 'Episode "Valentine Special" scheduled', time: '2 days ago' }
        ]
      });
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };
  
  const formatPercentage = (num) => {
    return num.toFixed(1) + '%';
  };
  
  if (loading) {
    return (
      <div className="insights-loading">
        <div className="loading-spinner"></div>
        <p>Loading insights...</p>
      </div>
    );
  }
  
  if (!metrics) {
    return (
      <div className="insights-error">
        <p>Failed to load insights. Please try again.</p>
      </div>
    );
  }
  
  return (
    <div className="show-insights-tab">
      {/* Header */}
      <div className="insights-header">
        <div className="header-left">
          <h2>📊 Show Insights</h2>
          <p className="header-subtitle">Analytics for {show.name}</p>
        </div>
        <div className="header-actions">
          <select
            className="time-range-select"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button className="btn-export">
            📥 Export Report
          </button>
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">📺</div>
          <div className="metric-content">
            <div className="metric-value">{metrics.overview.totalEpisodes}</div>
            <div className="metric-label">Total Episodes</div>
            <div className="metric-breakdown">
              {metrics.overview.publishedEpisodes} published · {metrics.overview.draftEpisodes} draft
            </div>
          </div>
        </div>
        
        <div className="metric-card success">
          <div className="metric-icon">👁️</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(metrics.overview.totalViews)}</div>
            <div className="metric-label">Total Views</div>
            <div className="metric-breakdown">
              {formatNumber(metrics.overview.avgViewsPerEpisode)} avg per episode
            </div>
          </div>
        </div>
        
        <div className="metric-card warning">
          <div className="metric-icon">💬</div>
          <div className="metric-content">
            <div className="metric-value">{formatPercentage(metrics.overview.engagementRate)}</div>
            <div className="metric-label">Engagement Rate</div>
            <div className="metric-breakdown">
              {formatNumber(metrics.overview.totalLikes)} likes · {formatNumber(metrics.overview.totalComments)} comments
            </div>
          </div>
        </div>
        
        <div className="metric-card info">
          <div className="metric-icon">📤</div>
          <div className="metric-content">
            <div className="metric-value">{formatNumber(metrics.overview.totalShares)}</div>
            <div className="metric-label">Total Shares</div>
            <div className="metric-breakdown">
              Across all platforms
            </div>
          </div>
        </div>
      </div>
      
      {/* Platform Breakdown */}
      <div className="insights-section">
        <h3 className="section-title">Platform Breakdown</h3>
        <div className="platform-breakdown">
          <div className="platform-chart">
            {metrics.platformBreakdown.map(platform => (
              <div
                key={platform.platform}
                className="platform-bar"
                style={{
                  width: `${platform.percentage}%`,
                  backgroundColor: platform.color
                }}
                title={`${platform.platform}: ${formatNumber(platform.views)} views (${formatPercentage(platform.percentage)})`}
              >
                <span className="bar-label">{platform.platform}</span>
              </div>
            ))}
          </div>
          <div className="platform-stats">
            {metrics.platformBreakdown.map(platform => (
              <div key={platform.platform} className="platform-stat">
                <div className="stat-header">
                  <span
                    className="stat-color"
                    style={{ backgroundColor: platform.color }}
                  ></span>
                  <span className="stat-name">{platform.platform}</span>
                </div>
                <div className="stat-values">
                  <span className="stat-views">{formatNumber(platform.views)}</span>
                  <span className="stat-percentage">{formatPercentage(platform.percentage)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Top Episodes */}
      <div className="insights-section">
        <h3 className="section-title">Top Performing Episodes</h3>
        <div className="top-episodes-table">
          <table>
            <thead>
              <tr>
                <th>Episode</th>
                <th>Platform</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Engagement</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topEpisodes.map((episode, index) => (
                <tr key={episode.id}>
                  <td>
                    <div className="episode-cell">
                      <span className="episode-rank">#{index + 1}</span>
                      <span className="episode-title">{episode.title}</span>
                    </div>
                  </td>
                  <td>
                    <span className="platform-badge">{episode.platform}</span>
                  </td>
                  <td className="number-cell">{formatNumber(episode.views)}</td>
                  <td className="number-cell">{formatNumber(episode.likes)}</td>
                  <td className="number-cell">{formatPercentage(episode.engagement)}</td>
                  <td className="date-cell">{new Date(episode.publishedDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* AI Insights */}
      <div className="insights-section">
        <h3 className="section-title">AI-Powered Insights</h3>
        <div className="ai-insights-grid">
          {metrics.aiInsights.map((insight, index) => (
            <div key={index} className={`ai-insight-card ${insight.type}`}>
              <div className="insight-icon">{insight.icon}</div>
              <div className="insight-content">
                <h4 className="insight-title">{insight.title}</h4>
                <p className="insight-message">{insight.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Asset & Wardrobe Usage */}
      <div className="insights-section">
        <h3 className="section-title">Most Used Assets & Wardrobe</h3>
        <div className="usage-grid">
          <div className="usage-card">
            <h4>📁 Top Assets</h4>
            <div className="usage-list">
              {metrics.assetUsage.mostUsedAssets.map((asset, index) => (
                <div key={index} className="usage-item">
                  <span className="usage-name">{asset.name}</span>
                  <span className="usage-badge">{asset.usageCount} uses</span>
                </div>
              ))}
            </div>
          </div>
          <div className="usage-card">
            <h4>👗 Top Wardrobe</h4>
            <div className="usage-list">
              {metrics.assetUsage.mostUsedWardrobe.map((item, index) => (
                <div key={index} className="usage-item">
                  <span className="usage-name">{item.name}</span>
                  <span className="usage-badge">{item.wornCount} times</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="insights-section">
        <h3 className="section-title">Recent Activity</h3>
        <div className="activity-timeline">
          {metrics.recentActivity.map((activity, index) => (
            <div key={index} className="activity-item">
              <div className={`activity-dot ${activity.type}`}></div>
              <div className="activity-content">
                <p className="activity-message">{activity.message}</p>
                <span className="activity-time">{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ShowInsightsTab;
