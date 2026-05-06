/**
 * Outfit Calendar
 * Calendar view showing when wardrobe items were worn and planning future outfits
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { API_URL } from '../config/api';
import './OutfitCalendar.css';

// File-local helpers — wardrobe + outfit-sets read.
export const listWardrobeApi = (limit = 1000) =>
  apiClient.get(`${API_URL}/wardrobe?limit=${limit}`).then((r) => r.data);
export const listOutfitSetsApi = () =>
  apiClient.get(`${API_URL}/outfit-sets`).then((r) => r.data);

const OutfitCalendar = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [outfitSets, setOutfitSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load wardrobe items
      try {
        const data = await listWardrobeApi(1000);
        setItems(data.data || []);
      } catch { /* leave items empty */ }

      // Load outfit sets
      try {
        const data = await listOutfitSetsApi();
        setOutfitSets(data.data || []);
      } catch { /* leave outfitSets empty */ }
    } catch (err) {
      console.error('Error loading calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group items by their last_worn_date
  const itemsByDate = useMemo(() => {
    const grouped = {};
    items.forEach(item => {
      if (item.last_worn_date) {
        const dateKey = new Date(item.last_worn_date).toISOString().split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(item);
      }
    });
    return grouped;
  }, [items]);

  // Calendar helpers
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isToday = (year, month, day) => {
    const today = new Date();
    return today.getFullYear() === year && 
           today.getMonth() === month && 
           today.getDate() === day;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleDateClick = (dateKey) => {
    setSelectedDate(dateKey === selectedDate ? null : dateKey);
  };

  // Render calendar grid
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day);
      const dayItems = itemsByDate[dateKey] || [];
      const hasItems = dayItems.length > 0;
      const isSelected = selectedDate === dateKey;
      const isTodayDate = isToday(year, month, day);

      days.push(
        <div
          key={dateKey}
          className={`calendar-day ${hasItems ? 'has-items' : ''} ${isSelected ? 'selected' : ''} ${isTodayDate ? 'today' : ''}`}
          onClick={() => handleDateClick(dateKey)}
        >
          <div className="day-number">{day}</div>
          {hasItems && (
            <div className="day-indicators">
              <span className="item-count">{dayItems.length}</span>
              <div className="item-previews">
                {dayItems.slice(0, 3).map(item => (
                  <div key={item.id} className="item-dot" title={item.name}>
                    {item.s3_url ? (
                      <img src={item.thumbnail_url || item.s3_url} alt="" />
                    ) : (
                      <span>👗</span>
                    )}
                  </div>
                ))}
                {dayItems.length > 3 && <span className="more-items">+{dayItems.length - 3}</span>}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="calendar-grid">
        <div className="calendar-header-row">
          {dayNames.map(name => (
            <div key={name} className="calendar-day-header">{name}</div>
          ))}
        </div>
        <div className="calendar-days">{days}</div>
      </div>
    );
  };

  // Render selected date details
  const renderSelectedDateDetails = () => {
    if (!selectedDate) return null;
    
    const dayItems = itemsByDate[selectedDate] || [];
    const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return (
      <div className="selected-date-panel">
        <div className="panel-header">
          <h3>{formattedDate}</h3>
          <button className="close-btn" onClick={() => setSelectedDate(null)}>×</button>
        </div>
        
        {dayItems.length === 0 ? (
          <div className="empty-day">
            <span className="empty-icon">📭</span>
            <p>No items worn on this date</p>
          </div>
        ) : (
          <div className="day-items-list">
            <h4>Items Worn ({dayItems.length})</h4>
            {dayItems.map(item => (
              <div key={item.id} className="day-item-card">
                <div className="item-image">
                  {item.s3_url ? (
                    <img src={item.thumbnail_url || item.s3_url} alt={item.name} />
                  ) : (
                    <div className="placeholder">👗</div>
                  )}
                </div>
                <div className="item-info">
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">
                    {item.character && <span className="tag character">{item.character}</span>}
                    {item.clothing_category && <span className="tag category">{item.clothing_category}</span>}
                    {item.brand && <span className="tag brand">{item.brand}</span>}
                  </div>
                  <div className="item-stats">
                    <span>Worn {item.times_worn || 1}x</span>
                    {item.price && <span>${item.price}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalWornDates = Object.keys(itemsByDate).length;
    const mostWornItem = [...items].sort((a, b) => (b.times_worn || 0) - (a.times_worn || 0))[0];
    const recentlyWorn = [...items]
      .filter(i => i.last_worn_date)
      .sort((a, b) => new Date(b.last_worn_date) - new Date(a.last_worn_date))
      .slice(0, 5);
    
    // Items worn this month
    const thisMonth = new Date();
    const thisMonthKey = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthItems = Object.entries(itemsByDate)
      .filter(([key]) => key.startsWith(thisMonthKey))
      .reduce((sum, [, arr]) => sum + arr.length, 0);

    return {
      totalWornDates,
      mostWornItem,
      recentlyWorn,
      thisMonthItems
    };
  }, [items, itemsByDate]);

  if (loading) {
    return <div className="calendar-loading">Loading calendar...</div>;
  }

  return (
    <div className="outfit-calendar-page">
      {/* Header */}
      <div className="calendar-page-header">
        <div className="header-content">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>📅 Outfit Calendar</h1>
          <p>Track when items were worn</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="calendar-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{stats.totalWornDates}</div>
          <div className="stat-label">Days w/ Activity</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{stats.thisMonthItems}</div>
          <div className="stat-label">This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{stats.mostWornItem?.times_worn || 0}x</div>
          <div className="stat-label">Most Worn</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👗</div>
          <div className="stat-value">{items.filter(i => i.last_worn_date).length}</div>
          <div className="stat-label">Items Tracked</div>
        </div>
      </div>

      {/* Calendar Container */}
      <div className="calendar-container">
        {/* Calendar Controls */}
        <div className="calendar-controls">
          <button className="nav-btn" onClick={prevMonth}>
            ←
          </button>
          <h2>{getMonthName(currentDate)}</h2>
          <button className="nav-btn" onClick={nextMonth}>
            →
          </button>
          <button className="today-btn" onClick={goToToday}>
            Today
          </button>
        </div>

        {/* Calendar + Details Panel */}
        <div className="calendar-main">
          <div className={`calendar-wrapper ${selectedDate ? 'with-panel' : ''}`}>
            {renderCalendar()}
          </div>
          {renderSelectedDateDetails()}
        </div>
      </div>

      {/* Recently Worn Section */}
      {stats.recentlyWorn.length > 0 && (
        <div className="recently-worn-section">
          <h3>🕐 Recently Worn</h3>
          <div className="recently-worn-grid">
            {stats.recentlyWorn.map(item => (
              <div key={item.id} className="recent-item">
                <div className="recent-image">
                  {item.s3_url ? (
                    <img src={item.thumbnail_url || item.s3_url} alt={item.name} />
                  ) : (
                    <div className="placeholder">👗</div>
                  )}
                </div>
                <div className="recent-info">
                  <div className="recent-name">{item.name}</div>
                  <div className="recent-date">
                    {new Date(item.last_worn_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color has-items"></div>
          <span>Has worn items</span>
        </div>
        <div className="legend-item">
          <div className="legend-color today"></div>
          <span>Today</span>
        </div>
        <div className="legend-item">
          <div className="legend-color selected"></div>
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
};

export default OutfitCalendar;
