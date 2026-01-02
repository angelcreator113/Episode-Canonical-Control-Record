# Episode Canonical Control - Frontend

Phase 2 frontend integration for the Episode Management System.

## Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env if your API is running on a different port
```

### 3. Start Development Server
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. Build for Production
```bash
npm run build
```

## Features

### Episodes List View
- Display all episodes with pagination
- Filter by status (pending, processing, complete)
- View episode details (season, episode, air date)
- Responsive grid layout

### Components
- **EpisodesList** - Main episodes display component
- **useEpisodes** - React hook for API integration

### API Integration
- Axios-based API client
- Automatic token injection for auth
- Error handling and loading states

## Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   └── Episodes/
│   │       ├── EpisodesList.jsx      # Main episodes component
│   │       └── EpisodesList.css      # Styling
│   ├── services/
│   │   └── api.js                     # API client
│   ├── hooks/
│   │   └── useEpisodes.js             # Episodes hook
│   ├── App.jsx                        # Root component
│   ├── App.css                        # App styling
│   ├── main.jsx                       # Entry point
│   └── index.css                      # Global styles
├── public/                            # Static assets
├── index.html                         # HTML template
├── vite.config.js                     # Vite configuration
└── package.json
```

## Development

### Available Scripts

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with UI
npm run test:ui
```

## Technologies

- **React 18.2** - UI framework
- **Vite** - Build tool
- **Axios** - HTTP client
- **React Router** - Routing (ready to use)

## API Reference

The frontend expects the following API endpoints:

- `GET /api/v1/episodes?page=1&limit=10&status=pending`
- `GET /api/v1/episodes/:id`
- `GET /api/v1/thumbnails`
- `GET /api/v1/thumbnails/:id`
- `GET /api/v1/metadata`

See [PHASE_2_QUICK_START.md](../PHASE_2_QUICK_START.md) for complete API documentation.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Next Steps

1. ✅ Episodes List View - Complete
2. ⏳ Episode Detail Pages
3. ⏳ Thumbnails Gallery
4. ⏳ Search & Filtering
5. ⏳ Authentication UI

## Troubleshooting

### API Connection Issues
- Ensure backend is running: `npm run dev` in root directory
- Check that API is on port 3001
- Verify CORS headers are correct

### Port Already in Use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5173   # Windows (find PID, then kill it)
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## Support

For issues, check:
- [PHASE_2_INTEGRATION_READY.md](../PHASE_2_INTEGRATION_READY.md)
- [PHASE_2_QUICK_START.md](../PHASE_2_QUICK_START.md)
- Backend server logs
