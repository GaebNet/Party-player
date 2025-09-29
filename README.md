# 🎬 Watch Party - Ephemeral YouTube Synchronization PWA

A complete, production-ready Progressive Web Application for creating ephemeral watch parties with synchronized YouTube video playback and real-time chat.

## ✨ Features

- **Room Management**: Generate random 6-character room codes with automatic cleanup
- **Video Synchronization**: Host-controlled YouTube playback with real-time sync for all participants
- **Real-time Chat**: Socket.IO-powered messaging system with message history
- **PWA Support**: Full offline capabilities, installable app, mobile-responsive design
- **AI Recommendations**: Stub endpoint ready for Gemini API integration
- **Ephemeral Design**: No database required - all data stored in memory

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation & Setup

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd watch-party
npm run install:all
```

2. **Start development servers:**
```bash
npm run dev
```

This starts both the backend server (port 3001) and Next.js frontend (port 3000) concurrently.

3. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Production Deployment

1. **Build the frontend:**
```bash
npm run build
```

2. **Start production servers:**
```bash
npm start
```

## 📁 Project Structure

```
watch-party/
├── package.json                 # Root package with scripts
├── server/
│   ├── package.json            # Backend dependencies
│   └── index.js                # Socket.IO server & API
├── frontend/
│   ├── package.json            # Frontend dependencies
│   ├── next.config.js          # Next.js configuration
│   ├── pages/
│   │   ├── _app.js             # App wrapper with PWA setup
│   │   ├── index.js            # Landing page
│   │   └── r/[code].js         # Room page
│   ├── styles/
│   │   └── globals.css         # Global styles
│   └── public/
│       ├── manifest.json       # PWA manifest
│       ├── sw.js               # Service worker
│       └── favicon.ico         # App icon
└── README.md
```

## 🔧 Configuration

### Environment Variables

#### Frontend (frontend/.env.local)
```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:3001  # Backend server URL
```

#### Backend (server/.env)
```bash
PORT=3001                      # Server port
NODE_ENV=development           # Environment mode
```

### CORS Configuration

The backend is configured for development CORS. For production:

1. Update `server/index.js` CORS settings:
```javascript
const io = new Server(server, {
  cors: {
    origin: "https://your-frontend-domain.com",
    methods: ["GET", "POST"]
  }
});
```

2. Update `frontend/next.config.js`:
```javascript
env: {
  NEXT_PUBLIC_SERVER_URL: 'https://your-backend-domain.com'
}
```

## 🎮 Usage Guide

### Creating a Room
1. Enter a username on the homepage
2. Click "Create New Room" 
3. Share the generated room code or copy the room link

### Joining a Room
1. Enter a username and the 6-character room code
2. Click "Join Room"
3. You'll be synchronized with the current video state

### Host Controls
- **Load Videos**: Paste any YouTube URL to load videos for the room
- **Playback Control**: Play, pause, and seek controls sync to all participants  
- **AI Recommendations**: Get suggested videos (currently returns placeholders)

### Chat Features
- Real-time messaging with all room participants
- Message history preserved during the session
- Mobile-optimized interface

## 🤖 AI Integration Guide

The application includes a stub endpoint for AI-powered video recommendations at `/api/recommend`.

### Integrating Google Gemini API

1. **Install the Gemini SDK:**
```bash
cd server && npm install @google/generative-ai
```

2. **Add environment variable:**
```bash
GEMINI_API_KEY=your_api_key_here
```

3. **Update the recommendation endpoint in `server/index.js`:**

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/api/recommend', async (req, res) => {
  const { videoId } = req.query;
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `Based on YouTube video ID ${videoId}, recommend 5 similar videos that would be good for a group watch party. Return only video IDs and titles in JSON format.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse and format the AI response
    const recommendations = JSON.parse(text);
    
    res.json({ recommendations });
  } catch (error) {
    console.error('AI recommendation error:', error);
    // Fallback to placeholder recommendations
    res.json({ recommendations: placeholderRecommendations });
  }
});
```

### Alternative AI Providers

The endpoint can easily be adapted for other AI services:
- **OpenAI GPT**: Replace Gemini calls with OpenAI API
- **Anthropic Claude**: Use Claude API for recommendations
- **Custom ML Models**: Integrate your own recommendation engine

## 🌐 PWA Features

### Installation
- **Desktop**: Install button appears in browser address bar
- **Mobile**: Add to Home Screen option in browser menu
- **Automatic**: PWA install prompt shows after user engagement

### Offline Support
- **App Shell**: Core application files cached for offline access
- **Smart Caching**: Static assets cached, dynamic content handled gracefully
- **Video Exclusion**: YouTube videos are never cached to prevent storage bloat

### Mobile Optimizations
- **Responsive Design**: Optimized layouts for mobile, tablet, and desktop
- **Touch-Friendly**: Proper touch targets and gestures
- **Status Bar**: Integrated with mobile status bar styling

## 🔒 Security Considerations

### YouTube Embed Policies
- Videos are embedded using YouTube's IFrame API
- Cross-origin restrictions apply - some videos may not be embeddable
- Corporate/restricted videos may fail to load

### CORS & Domain Policies
- Configure CORS properly for production domains
- Update `next.config.js` with production server URLs
- Consider implementing domain whitelisting

### Data Privacy
- All data is ephemeral and stored only in server memory
- No user data persistence or tracking
- Chat messages are cleared when rooms are cleaned up

## 📱 Browser Compatibility

### Fully Supported
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Limited Support
- Internet Explorer: Not supported (lacks Socket.IO and PWA features)
- Older mobile browsers: Basic functionality only

### Required Features
- WebSockets/Socket.IO support
- Service Worker API
- YouTube IFrame API compatibility
- ES6+ JavaScript features

## ⚠️ Known Limitations

### Technical Limitations
1. **Memory Storage**: Server restarts clear all room data
2. **Scalability**: Single-server architecture limits concurrent users
3. **Video Compatibility**: Some YouTube videos have embedding restrictions
4. **Network Dependency**: Real-time features require stable internet connection

### Feature Limitations
1. **No Persistence**: Chat history and room state lost on refresh
2. **Single Host**: Only room creator has video control
3. **No User Authentication**: Simple username-based identification
4. **Room Capacity**: No built-in user limits per room

### Recommended Enhancements
- Add Redis for distributed session storage
- Implement user authentication and persistent profiles  
- Add room capacity limits and moderation tools
- Integrate video queue management
- Add mobile app versions with native features

## 🛠️ Development

### Adding New Features

1. **Backend API Routes**: Add to `server/index.js`
2. **Socket Events**: Define in both server and client code
3. **Frontend Pages**: Add to `frontend/pages/`
4. **Styling**: Update `frontend/styles/globals.css`

### Debugging

1. **Server Logs**: Check console output from server process
2. **Client Logs**: Use browser developer tools
3. **Socket Events**: Monitor Socket.IO debug messages
4. **PWA Issues**: Check Application tab in Chrome DevTools

### Testing

```bash
# Test server endpoints
curl http://localhost:3001/api/room/TEST123

# Test room creation
curl -X POST http://localhost:3001/api/create-room

# Test recommendations
curl http://localhost:3001/api/recommend?videoId=dQw4w9WgXcQ
```

## 📄 License

MIT License - feel free to use this project as a foundation for your own watch party applications.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built with ❤️ for synchronized entertainment experiences**