const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

/**
 * In-memory storage for rooms
 * Structure: {
 *   roomCode: {
 *     id: string,
 *     host: socketId,
 *     users: [{ id: socketId, username: string }],
 *     currentVideo: { videoId: string, title: string, position: number, isPlaying: boolean },
 *     messages: [{ id: string, username: string, message: string, timestamp: number }],
 *     createdAt: timestamp
 *   }
 * }
 */
const rooms = {};

/**
 * Generate a random 6-character room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

/**
 * Clean up empty rooms
 */
function cleanupEmptyRooms() {
  Object.keys(rooms).forEach(roomCode => {
    if (rooms[roomCode].users.length === 0) {
      console.log(`Cleaning up empty room: ${roomCode}`);
      delete rooms[roomCode];
    }
  });
}

// API Routes
/**
 * Create a new room
 */
app.post('/api/create-room', (req, res) => {
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms[roomCode]);

  rooms[roomCode] = {
    id: roomCode,
    host: null,
    users: [],
    currentVideo: null,
    messages: [],
    createdAt: Date.now()
  };

  console.log(`Room created: ${roomCode}`);
  res.json({ roomCode });
});

/**
 * Get room info
 */
app.get('/api/room/:code', (req, res) => {
  const { code } = req.params;
  const room = rooms[code.toUpperCase()];
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    roomCode: room.id,
    userCount: room.users.length,
    currentVideo: room.currentVideo,
    exists: true
  });
});

/**
 * AI Recommendations stub - returns placeholder YouTube URLs
 * Future integration point for Gemini API
 */
app.get('/api/recommend', (req, res) => {
  const { videoId } = req.query;
  
  // Placeholder recommendations - in production, integrate with Gemini API here
  const placeholderRecommendations = [
    {
      videoId: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg'
    },
    {
      videoId: 'ZZ5LpwO-An4',
      title: 'HEYYEYAAEYAAAEYAEYAA',
      thumbnail: 'https://img.youtube.com/vi/ZZ5LpwO-An4/default.jpg'
    },
    {
      videoId: 'oHg5SJYRHA0',
      title: 'RickRoll\'d',
      thumbnail: 'https://img.youtube.com/vi/oHg5SJYRHA0/default.jpg'
    }
  ];

  console.log(`Recommendations requested for video: ${videoId}`);
  
  res.json({
    recommendations: placeholderRecommendations,
    note: "These are placeholder recommendations. Integrate Gemini API here for real recommendations."
  });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  /**
   * Join a room
   */
  socket.on('join-room', ({ roomCode, username }) => {
    const room = rooms[roomCode.toUpperCase()];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Leave any previously joined rooms
    socket.rooms.forEach(roomName => {
      if (roomName !== socket.id) {
        socket.leave(roomName);
      }
    });

    // Join the new room
    socket.join(roomCode.toUpperCase());
    
    // Set host if room is empty
    if (room.users.length === 0) {
      room.host = socket.id;
    }

    // Add user to room
    const user = { id: socket.id, username: username || `User${Math.floor(Math.random() * 1000)}` };
    room.users.push(user);
    
    socket.emit('joined-room', {
      roomCode: roomCode.toUpperCase(),
      isHost: room.host === socket.id,
      currentVideo: room.currentVideo,
      messages: room.messages,
      users: room.users
    });

    // Notify other users
    socket.to(roomCode.toUpperCase()).emit('user-joined', { user, userCount: room.users.length });
    
    console.log(`User ${username} joined room ${roomCode.toUpperCase()}`);
  });

  /**
   * Load a video (host only)
   */
  socket.on('load-video', ({ roomCode, videoUrl }) => {
    const room = rooms[roomCode];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.host !== socket.id) {
      socket.emit('error', { message: 'Only the host can load videos' });
      return;
    }

    const videoId = extractYouTubeVideoId(videoUrl);
    
    if (!videoId) {
      socket.emit('error', { message: 'Invalid YouTube URL' });
      return;
    }

    // Update room video state
    room.currentVideo = {
      videoId,
      title: `Video ${videoId}`, // In production, fetch actual title from YouTube API
      position: 0,
      isPlaying: false
    };

    // Broadcast to all users in room
    io.to(roomCode).emit('video-loaded', { 
      videoId,
      title: room.currentVideo.title 
    });

    console.log(`Video loaded in room ${roomCode}: ${videoId}`);
  });

  /**
   * Video control events (host only)
   */
  socket.on('video-play', ({ roomCode, currentTime }) => {
    const room = rooms[roomCode];
    
    if (!room || room.host !== socket.id) return;

    room.currentVideo.isPlaying = true;
    room.currentVideo.position = currentTime || 0;

    socket.to(roomCode).emit('video-play', { time: currentTime });
  });

  socket.on('video-pause', ({ roomCode, currentTime }) => {
    const room = rooms[roomCode];
    
    if (!room || room.host !== socket.id) return;

    room.currentVideo.isPlaying = false;
    room.currentVideo.position = currentTime || 0;

    socket.to(roomCode).emit('video-pause', { time: currentTime });
  });

  socket.on('video-seek', ({ roomCode, seekTime }) => {
    const room = rooms[roomCode];
    
    if (!room || room.host !== socket.id) return;

    room.currentVideo.position = seekTime;

    socket.to(roomCode).emit('video-seek', { time: seekTime });
  });

  /**
   * Chat messages
   */
  socket.on('send-message', ({ roomCode, message }) => {
    const room = rooms[roomCode];
    
    if (!room) return;

    const user = room.users.find(u => u.id === socket.id);
    if (!user) return;

    const chatMessage = {
      id: Date.now().toString(),
      username: user.username,
      message: message.trim(),
      timestamp: Date.now()
    };

    room.messages.push(chatMessage);

    // Keep only last 50 messages to prevent memory bloat
    if (room.messages.length > 50) {
      room.messages = room.messages.slice(-50);
    }

    io.to(roomCode).emit('new-message', chatMessage);
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove user from all rooms and cleanup
    Object.keys(rooms).forEach(roomCode => {
      const room = rooms[roomCode];
      const userIndex = room.users.findIndex(u => u.id === socket.id);
      
      if (userIndex !== -1) {
        const user = room.users[userIndex];
        room.users.splice(userIndex, 1);
        
        // If host disconnected, assign new host
        if (room.host === socket.id && room.users.length > 0) {
          room.host = room.users[0].id;
          io.to(roomCode).emit('new-host', { newHost: room.users[0] });
        }
        
        // Notify remaining users
        socket.to(roomCode).emit('user-left', { 
          user, 
          userCount: room.users.length,
          newHost: room.host === room.users[0]?.id ? room.users[0] : null
        });
        
        console.log(`User ${user.username} left room ${roomCode}`);
      }
    });
    
    // Cleanup empty rooms
    cleanupEmptyRooms();
  });
});

// Periodic cleanup of old empty rooms
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(roomCode => {
    const room = rooms[roomCode];
    // Clean up rooms older than 24 hours with no users
    if (room.users.length === 0 && (now - room.createdAt) > 24 * 60 * 60 * 1000) {
      delete rooms[roomCode];
      console.log(`Cleaned up old empty room: ${roomCode}`);
    }
  });
}, 60 * 60 * 1000); // Run every hour

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Watch Party Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});