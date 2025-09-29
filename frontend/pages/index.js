import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

/**
 * Landing page for creating or joining rooms
 * Provides the main entry point to the watch party application
 */
export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  /**
   * Create a new room
   */
  const createRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.roomCode) {
        // Navigate to the room with username
        router.push(`/r/${data.roomCode}?username=${encodeURIComponent(username.trim())}`);
      } else {
        setError('Failed to create room. Please try again.');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please check your connection.');
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Join an existing room
   */
  const joinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setError('');

    try {
      // Validate room exists
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/room/${roomCode.toUpperCase()}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          router.push(`/r/${roomCode.toUpperCase()}?username=${encodeURIComponent(username.trim())}`);
        } else {
          setError('Room not found. Please check the room code.');
        }
      } else {
        setError('Room not found. Please check the room code.');
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please check your connection.');
    }
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  return (
    <>
      <Head>
        <title>Watch Party - Synchronized YouTube Viewing</title>
        <meta name="description" content="Create or join ephemeral watch parties to enjoy YouTube videos together in perfect sync" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">🎬 Watch Party</h1>
            <p className="text-purple-200 text-lg">
              Watch YouTube videos together in perfect sync
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Your Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, roomCode ? joinRoom : createRoom)}
                placeholder="Enter your name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                maxLength={20}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Create Room */}
            <div className="space-y-3">
              <button
                onClick={createRoom}
                disabled={isCreating || !username.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating Room...' : '🚀 Create New Room'}
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Join Room */}
            <div className="space-y-3">
              <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700">
                Join Existing Room
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => handleKeyPress(e, joinRoom)}
                placeholder="Enter 6-character room code..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                maxLength={6}
              />
              <button
                onClick={joinRoom}
                disabled={!username.trim() || !roomCode.trim()}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                🎯 Join Room
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="text-center space-y-2">
            <div className="text-purple-200 text-sm">
              ✨ Synchronized video playback • 💬 Real-time chat • 📱 Mobile-friendly
            </div>
            <div className="text-purple-300 text-xs">
              Rooms are ephemeral - no data is permanently stored
            </div>
          </div>
        </div>
      </div>
    </>
  );
}