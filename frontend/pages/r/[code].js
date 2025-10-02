import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { io } from 'socket.io-client';
import ServerStatus from '../../components/ServerStatus';
import VoiceChat from '../../components/ModernVoiceChat';

/**
 * Room page component - main watch party interface
 * Handles video synchronization, chat, and room management
 */
export default function Room() {
  const router = useRouter();
  const { code, username, avatar } = router.query;
  
  // Socket and room state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [users, setUsers] = useState([]);

  // Video state
  const [videoUrl, setVideoUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerRef = useRef(null);
  const [recommendations, setRecommendations] = useState([]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // UI state
  const [error, setError] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  /**
   * Load YouTube IFrame API
   */
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.YT) {
      console.log('Loading YouTube IFrame API...');

      // Add API script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        console.warn('Failed to load YouTube API script');
        // Try loading again after a delay
        setTimeout(() => {
          if (!window.YT && !isPlayerReady) {
            console.log('Retrying YouTube API load...');
            const retryTag = document.createElement('script');
            retryTag.src = 'https://www.youtube.com/iframe_api';
            retryTag.async = true;
            document.head.appendChild(retryTag);
          }
        }, 3000);
      };

      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // Set up callback
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API loaded successfully');
        setIsPlayerReady(true);
        setError(''); // Clear any previous errors
      };

      // Fallback: check if API is already loaded (longer timeout)
      setTimeout(() => {
        if (window.YT && window.YT.Player && !isPlayerReady) {
          console.log('YouTube API was already loaded');
          setIsPlayerReady(true);
          setError('');
        } else if (!isPlayerReady) {
          console.warn('YouTube API is taking longer to load, but videos should still work');
          setError('YouTube API is loading slowly. Videos may take a moment to start.');
          // Keep checking every 5 seconds
          const checkInterval = setInterval(() => {
            if (window.YT && window.YT.Player && !isPlayerReady) {
              console.log('YouTube API loaded after delay');
              setIsPlayerReady(true);
              setError('');
              clearInterval(checkInterval);
            }
          }, 5000);
        }
      }, 10000); // Increased timeout to 10 seconds
    } else if (window.YT && window.YT.Player) {
      console.log('YouTube API already available');
      setIsPlayerReady(true);
      setError('');
    }

    // Check if mobile
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Load video in YouTube player
   */
  const loadVideoInPlayer = useCallback((videoId) => {
    console.log('loadVideoInPlayer called with videoId:', videoId);

    if (!window.YT || !window.YT.Player) {
      console.error('YouTube API not ready, cannot load video');
      setError('YouTube API not loaded. Please refresh the page and try again.');
      setIsVideoLoading(false);
      return;
    }

    // Check if youtube-player element exists
    const playerElement = document.getElementById('youtube-player');
    console.log('Player element exists:', !!playerElement);

    if (!playerElement) {
      console.error('YouTube player element not found');
      return;
    }

    // Destroy existing player
    if (playerRef.current) {
      console.log('Destroying existing player');
      playerRef.current.destroy();
    }

    console.log('Creating new YouTube player...');

    // Create new player
    playerRef.current = new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: isHost ? 1 : 0, // Only host gets controls
        disablekb: !isHost ? 1 : 0,
        fs: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1
      },
      events: {
        onReady: (event) => {
          console.log('YouTube player ready for video:', videoId);
        },
        onStateChange: (event) => {
          console.log('Player state changed:', event.data);
          if (!isHost) return; // Only host can trigger sync events

          const currentTime = event.target.getCurrentTime();

          if (event.data === window.YT.PlayerState.PLAYING) {
            socket?.emit('video-play', { roomCode: code.toUpperCase(), currentTime });
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            socket?.emit('video-pause', { roomCode: code.toUpperCase(), currentTime });
          }
        },
        onError: (event) => {
          console.error('YouTube player error:', event.data);
          setError(`YouTube player error: ${event.data}`);
        }
      }
    });
  }, [isHost, socket, code, setError, setIsVideoLoading]);

  /**
   * Initialize socket connection and join room
   */
  useEffect(() => {
    if (!code || !username) return;

    console.log('Creating Socket.IO connection...');

    // Create socket with stable configuration
    const socketInstance = io(process.env.NEXT_PUBLIC_SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server, joining room:', code);
      socketInstance.emit('join-room', {
        roomCode: code.toUpperCase(), // Ensure uppercase
        username: decodeURIComponent(username),
        avatar: avatar ? decodeURIComponent(avatar) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((username || 'Guest').charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`
      });
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Disconnected from server:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('Connection failed. Retrying...');
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setError('');
      // Rejoin room after reconnection
      socketInstance.emit('join-room', {
        roomCode: code.toUpperCase(),
        username: decodeURIComponent(username),
        avatar: avatar ? decodeURIComponent(avatar) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((username || 'Guest').charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`
      });
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Reconnection failed:', error);
    });

    socketInstance.on('joined-room', (data) => {
      console.log('Joined room data:', data);
      console.log('Users with avatars:', data.users?.map(u => ({ username: u.username, hasAvatar: !!u.avatar })));
      setRoomData(data);
      setIsHost(data.isHost);
      setCurrentVideo(data.currentVideo);
      setMessages(data.messages || []);
      setUsers(data.users || []);
      setError(''); // Clear any connection errors
    });

    socketInstance.on('error', (data) => {
      console.error('Socket error:', data.message);
      setError(data.message);
      // If room not found, redirect to home after 3 seconds
      if (data.message === 'Room not found') {
        setTimeout(() => {
          router.push('/');
        }, 3000);
      }
    });

    // Video events
    socketInstance.on('video-loaded', (data) => {
      setCurrentVideo({ videoId: data.videoId, title: data.title });
      setIsVideoLoading(false);
      loadVideoInPlayer(data.videoId);
    });

    socketInstance.on('video-play', (data) => {
      if (playerRef.current && playerRef.current.seekTo && playerRef.current.playVideo) {
        playerRef.current.seekTo(data.time, true);
        playerRef.current.playVideo();
      }
    });

    socketInstance.on('video-pause', (data) => {
      if (playerRef.current && playerRef.current.seekTo && playerRef.current.pauseVideo) {
        playerRef.current.seekTo(data.time, true);
        playerRef.current.pauseVideo();
      }
    });

    socketInstance.on('video-seek', (data) => {
      if (playerRef.current && playerRef.current.seekTo) {
        playerRef.current.seekTo(data.time, true);
      }
    });

    // Chat events
    socketInstance.on('new-message', (message) => {
      console.log('New message received:', message);
      setMessages(prev => [...prev, message]);
    });

    // User events
    socketInstance.on('user-joined', (data) => {
      console.log('User joined:', data.user);
      setUsers(prev => [...prev, data.user]);
    });

    socketInstance.on('user-left', (data) => {
      console.log('User left:', data.user);
      setUsers(prev => prev.filter(u => u.id !== data.user.id));
      if (data.newHost) {
        setIsHost(data.newHost.id === socketInstance.id);
      }
    });

    socketInstance.on('new-host', (data) => {
      setIsHost(data.newHost.id === socketInstance.id);
    });

    return () => {
      console.log('Cleaning up socket connection');
      socketInstance.disconnect();
    };
  }, [code, username]); // Only depend on code and username to prevent unnecessary reconnections

  /**
   * Auto-scroll chat to bottom
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Create YouTube player when ready and video is loaded
   */
  useEffect(() => {
    if (isPlayerReady && currentVideo && currentVideo.videoId && !playerRef.current) {
      loadVideoInPlayer(currentVideo.videoId);
    }
  }, [isPlayerReady, currentVideo, loadVideoInPlayer]);

  /**
   * Load a new video (host only)
   */
  const loadVideo = () => {
    if (!isHost) {
      setError('Only the host can load videos');
      return;
    }

    if (!videoUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setIsVideoLoading(true);
    setError('');
    
    socket.emit('load-video', { 
      roomCode: code.toUpperCase(), 
      videoUrl: videoUrl.trim() 
    });
    
    setVideoUrl('');
  };

  /**
   * Send chat message
   */
  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', {
      roomCode: code.toUpperCase(),
      message: newMessage.trim()
    });

    setNewMessage('');
  };

  /**
   * Get AI recommendations
   */
  const getRecommendations = async () => {
    if (!currentVideo || !currentVideo.videoId) {
      setError('Load a video first to get recommendations');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/recommend?videoId=${currentVideo.videoId}`
      );
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error('Error getting recommendations:', err);
      setError('Failed to get recommendations');
    }
  };

  /**
   * Load recommended video
   */
  const loadRecommendedVideo = (videoId) => {
    if (!isHost) {
      setError('Only the host can load videos');
      return;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    setIsVideoLoading(true);
    
    socket.emit('load-video', { 
      roomCode: code.toUpperCase(), 
      videoUrl 
    });
  };

  /**
   * Copy room link to clipboard
   */
  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(roomLink).then(() => {
      // Could show a toast notification here
      console.log('Room link copied to clipboard');
    });
  };

  /**
   * Handle key press events
   */
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  if (!code || !username) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Invalid Room</h1>
          <button 
            onClick={() => router.push('/')}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Watch Party - Room {code}</title>
        <meta name="description" content={`Join the watch party in room ${code}`} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white">
        <ServerStatus />
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold">Room {code}</h1>
              {isHost && <span className="bg-purple-600 text-xs px-2 py-1 rounded">HOST</span>}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {users.length} user{users.length !== 1 ? 's' : ''} online
              </div>
              <button
                onClick={copyRoomLink}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm transition-colors"
              >
                📋 Copy Link
              </button>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-600 text-white p-3 text-center">
            {error}
            <button 
              onClick={() => setError('')}
              className="ml-2 text-red-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-4">
          <div className="space-y-6">
            
            {/* Video Section */}
            <div className="space-y-4">
              
              {/* Video Controls - Host Only */}
              {isHost && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Load Video (Host Controls)</h3>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, loadVideo)}
                      placeholder="Paste YouTube URL here..."
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      onClick={loadVideo}
                      disabled={isVideoLoading}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
                    >
                      {isVideoLoading ? 'Loading...' : 'Load'}
                    </button>
                  </div>
                </div>
              )}

              {/* Video Player */}
              <div className="bg-black rounded-lg overflow-hidden aspect-video">
                {currentVideo ? (
                  <div id="youtube-player" className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🎬</div>
                      <div className="text-xl mb-2">No video loaded</div>
                      <div className="text-sm">
                        {isHost ? 'Load a YouTube video to get started' : 'Waiting for the host to load a video...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Video Info */}
              {currentVideo && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-1">Now Playing:</h3>
                  <p className="text-gray-300">{currentVideo.title}</p>
                  {!isHost && (
                    <p className="text-sm text-gray-500 mt-2">
                      Video controls are managed by the host
                    </p>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {isHost && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">AI Recommendations</h3>
                    <button
                      onClick={getRecommendations}
                      disabled={!currentVideo}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-1 text-sm rounded transition-colors"
                    >
                      Get Recommendations
                    </button>
                  </div>
                  
                  {recommendations.length > 0 ? (
                    <div className="space-y-2">
                      {recommendations.map((rec) => (
                        <div key={rec.videoId} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                          <div className="flex-1 text-sm">{rec.title}</div>
                          <button
                            onClick={() => loadRecommendedVideo(rec.videoId)}
                            className="bg-purple-600 hover:bg-purple-700 px-2 py-1 text-xs rounded ml-2 transition-colors"
                          >
                            Load
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Load a video and click &quot;Get Recommendations&quot; to see AI-suggested videos
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Users Section - Now below video */}
            <div className="w-full">
              <div className="bg-gradient-to-r from-gray-800 via-gray-800 to-gray-700 rounded-xl p-4 border border-gray-600 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    👥 Users in Room ({users.length})
                  </h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <span className="text-sm text-gray-300">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {users.map((user) => (
                    <div 
                      key={user.id} 
                      className="group bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-3 border border-gray-600 hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 transform hover:scale-105"
                    >
                      <div className="flex flex-col items-center space-y-2">
                        {/* Avatar */}
                        <div className="relative">
                          <img
                            src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username.charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`}
                            alt={user.username}
                            className="w-10 h-10 rounded-full border-2 border-purple-400 shadow-lg object-cover"
                            onError={(e) => {
                              e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username.charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`;
                            }}
                          />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800 animate-pulse"></div>
                        </div>
                        
                        {/* Username */}
                        <div className="text-center">
                          <div className={`text-sm font-medium truncate max-w-full ${
                            user.id === socket?.id 
                              ? 'text-purple-300 font-bold' 
                              : 'text-white'
                          }`}>
                            {user.username}
                            {user.id === socket?.id && (
                              <span className="block text-xs text-purple-400">(You)</span>
                            )}
                          </div>
                          
                          {/* Host badge */}
                          {roomData?.host === user.id && (
                            <div className="mt-1">
                              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">
                                👑 HOST
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Section: Voice Chat and Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Voice Chat */}
              <div>
                <VoiceChat 
                  socket={socket}
                  roomCode={code}
                  username={username}
                  users={users}
                  isHost={isHost}
                />
              </div>

              {/* Modern Chat */}
              <div className="bg-gradient-to-br from-indigo-900/90 via-purple-900/90 to-pink-900/90 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 backdrop-blur-sm p-4 border-b border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                        Chat
                      </h3>
                      <p className="text-purple-200 text-sm">
                        {messages.length} message{messages.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Container */}
                <div className="flex flex-col h-80">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-transparent">
                    {messages.length > 0 ? (
                      messages.map((msg, index) => (
                        <div key={msg.id} className="group">
                          <div className={`flex items-start space-x-3 ${msg.username === username ? 'justify-end' : 'justify-start'}`}>
                            {/* Avatar for other users (left side) */}
                            {msg.username !== username && (
                              <div className="flex-shrink-0">
                                <img
                                  src={msg.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.username.charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`}
                                  alt={msg.username}
                                  className="w-8 h-8 rounded-full border-2 border-purple-400 shadow-sm object-cover"
                                  onError={(e) => {
                                    e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.username.charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`;
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* Message bubble */}
                            <div className={`max-w-xs lg:max-w-sm px-4 py-3 rounded-2xl shadow-lg backdrop-blur-sm border transition-all duration-300 group-hover:shadow-xl ${
                              msg.username === username
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-500/20 shadow-purple-500/20'
                                : 'bg-white/10 text-white border-white/20 shadow-white/10'
                            }`}>
                              {msg.username !== username && (
                                <div className="text-xs font-medium text-purple-300 mb-1">
                                  {msg.username}
                                </div>
                              )}
                              <div className="text-sm leading-relaxed break-words">
                                {msg.message}
                              </div>
                              <div className={`text-xs mt-1 opacity-70 ${
                                msg.username === username ? 'text-purple-100' : 'text-gray-300'
                              }`}>
                                {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>

                            {/* Avatar for current user (right side) */}
                            {msg.username === username && (
                              <div className="flex-shrink-0">
                                <img
                                  src={msg.avatar || (avatar ? decodeURIComponent(avatar) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username.charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`)}
                                  alt={username}
                                  className="w-8 h-8 rounded-full border-2 border-purple-400 shadow-sm object-cover"
                                  onError={(e) => {
                                    e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username.charAt(0).toUpperCase())}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`;
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-6xl mb-4 opacity-50">💬</div>
                        <div className="text-purple-200 text-sm">
                          No messages yet
                        </div>
                        <div className="text-purple-300 text-xs mt-1">
                          Start the conversation!
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-white/10 bg-black/20">
                    <div className="flex space-x-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => handleKeyPress(e, sendMessage)}
                          placeholder="Type your message..."
                          maxLength={200}
                          className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-purple-200 text-sm transition-all duration-300 hover:bg-white/15"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-purple-300">
                          {newMessage.length}/200
                        </div>
                      </div>
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="group relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-700 px-4 py-3 rounded-xl font-medium text-white transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-purple-500/25"
                      >
                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <div className="relative">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}