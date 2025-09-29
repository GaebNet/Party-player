import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { io } from 'socket.io-client';

/**
 * Room page component - main watch party interface
 * Handles video synchronization, chat, and room management
 */
export default function Room() {
  const router = useRouter();
  const { code } = router.query;
  const { username } = router.query;
  
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
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setIsPlayerReady(true);
      };
    } else if (window.YT && window.YT.Player) {
      setIsPlayerReady(true);
    }

    // Check if mobile
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Initialize socket connection and join room
   */
  useEffect(() => {
    if (!code || !username) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_SERVER_URL);
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      socketInstance.emit('join-room', { 
        roomCode: code, 
        username: decodeURIComponent(username) 
      });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('joined-room', (data) => {
      setRoomData(data);
      setIsHost(data.isHost);
      setCurrentVideo(data.currentVideo);
      setMessages(data.messages || []);
      setUsers(data.users || []);
    });

    socketInstance.on('error', (data) => {
      setError(data.message);
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
      setMessages(prev => [...prev, message]);
    });

    // User events
    socketInstance.on('user-joined', (data) => {
      setUsers(prev => [...prev, data.user]);
    });

    socketInstance.on('user-left', (data) => {
      setUsers(prev => prev.filter(u => u.id !== data.user.id));
      if (data.newHost) {
        setIsHost(data.newHost.id === socketInstance.id);
      }
    });

    socketInstance.on('new-host', (data) => {
      setIsHost(data.newHost.id === socketInstance.id);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [code, username]);

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
  }, [isPlayerReady, currentVideo]);

  /**
   * Load video in YouTube player
   */
  const loadVideoInPlayer = (videoId) => {
    if (!window.YT || !window.YT.Player) return;

    // Destroy existing player
    if (playerRef.current) {
      playerRef.current.destroy();
    }

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
        showinfo: 0
      },
      events: {
        onReady: (event) => {
          console.log('Player ready');
        },
        onStateChange: (event) => {
          if (!isHost) return; // Only host can trigger sync events
          
          const currentTime = event.target.getCurrentTime();
          
          if (event.data === window.YT.PlayerState.PLAYING) {
            socket?.emit('video-play', { roomCode: code, currentTime });
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            socket?.emit('video-pause', { roomCode: code, currentTime });
          }
        }
      }
    });
  };

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
      roomCode: code, 
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
      roomCode: code,
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
      roomCode: code, 
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
              }
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
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
            
            {/* Video Section */}
            <div className={`${isMobile ? 'order-1' : 'lg:col-span-2'} space-y-4`}>
              
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
                      Load a video and click "Get Recommendations" to see AI-suggested videos
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className={`${isMobile ? 'order-2' : ''} space-y-4`}>
              
              {/* Users List */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Users ({users.length})</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className={user.id === socket?.id ? 'font-semibold text-purple-400' : ''}>
                        {user.username}
                      </span>
                      {roomData?.host === user.id && (
                        <span className="bg-purple-600 text-xs px-1 py-0.5 rounded">HOST</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat */}
              <div className="bg-gray-800 rounded-lg p-4 flex flex-col h-96">
                <h3 className="font-semibold mb-3">Chat</h3>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-2">
                  {messages.length > 0 ? (
                    messages.map((msg) => (
                      <div key={msg.id} className="text-sm">
                        <span className="font-medium text-purple-400">{msg.username}:</span>{' '}
                        <span className="text-gray-300">{msg.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-sm text-center py-8">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, sendMessage)}
                    placeholder="Type a message..."
                    maxLength={200}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-3 py-2 rounded transition-colors text-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}