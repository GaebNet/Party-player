import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import ServerStatus from '../components/ServerStatus';

/**
 * Enhanced Landing page with localStorage, avatar support, and profile management
 * Provides the main entry point to the watch party application
 */
export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempProfileUrl, setTempProfileUrl] = useState('');
  const [isImageValid, setIsImageValid] = useState(true);
  const router = useRouter();

  /**
   * Load user data from localStorage on component mount
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUsername = localStorage.getItem('partyplayer_username');
      const savedProfileUrl = localStorage.getItem('partyplayer_profile_url');
      
      if (savedUsername) {
        setUsername(savedUsername);
        setTempUsername(savedUsername);
      }
      
      if (savedProfileUrl) {
        setProfilePhotoUrl(savedProfileUrl);
        setTempProfileUrl(savedProfileUrl);
      }
    }
  }, []);

  /**
   * Save user data to localStorage
   */
  const saveUserData = (newUsername, newProfileUrl) => {
    if (typeof window !== 'undefined') {
      if (newUsername) {
        localStorage.setItem('partyplayer_username', newUsername);
      }
      if (newProfileUrl !== undefined) {
        if (newProfileUrl) {
          localStorage.setItem('partyplayer_profile_url', newProfileUrl);
        } else {
          localStorage.removeItem('partyplayer_profile_url');
        }
      }
    }
  };

  /**
   * Generate avatar URL or return profile photo
   */
  const getAvatarUrl = (name, photoUrl) => {
    console.log('Generating avatar URL:', { name, photoUrl, isImageValid });
    if (photoUrl && isImageValid) {
      return photoUrl;
    }
    
    // Generate initials-based avatar using DiceBear API
    const initials = (name || 'Guest').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const fallbackUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`;
    console.log('Using fallback avatar:', fallbackUrl);
    return fallbackUrl;
  };

  /**
   * Validate image URL
   */
  const validateImageUrl = (url) => {
    if (!url) {
      setIsImageValid(true);
      return;
    }

    const img = new Image();
    img.onload = () => setIsImageValid(true);
    img.onerror = () => setIsImageValid(false);
    img.src = url;
  };

  /**
   * Handle profile photo URL change
   */
  const handleProfileUrlChange = (url) => {
    setTempProfileUrl(url);
    validateImageUrl(url);
  };

  /**
   * Save profile changes
   */
  const saveProfile = () => {
    if (!tempUsername.trim()) {
      setError('Username cannot be empty');
      return;
    }

    setUsername(tempUsername.trim());
    setProfilePhotoUrl(tempProfileUrl);
    saveUserData(tempUsername.trim(), tempProfileUrl);
    setShowProfileEditor(false);
    setError('');
  };

  /**
   * Cancel profile editing
   */
  const cancelProfileEdit = () => {
    setTempUsername(username);
    setTempProfileUrl(profilePhotoUrl);
    setShowProfileEditor(false);
    setIsImageValid(true);
  };

  /**
   * Create a new room
   */
  const createRoom = async () => {
    if (!username.trim()) {
      setShowProfileEditor(true);
      setError('Please set up your profile first');
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
        // Save user data before navigating
        saveUserData(username, profilePhotoUrl);
        
        const avatarUrl = getAvatarUrl(username, profilePhotoUrl);
        console.log('Creating room with avatar:', avatarUrl);
        
        // Navigate to the room with username and avatar
        const params = new URLSearchParams({
          username: username.trim(),
          avatar: encodeURIComponent(avatarUrl)
        });
        router.push(`/r/${data.roomCode}?${params.toString()}`);
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
      setShowProfileEditor(true);
      setError('Please set up your profile first');
      return;
    }

    setError('');

    try {
      // Validate room exists
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/room/${roomCode.toUpperCase()}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          // Save user data before navigating
          saveUserData(username, profilePhotoUrl);
          
          const avatarUrl = getAvatarUrl(username, profilePhotoUrl);
          console.log('Joining room with avatar:', avatarUrl);
          
          // Navigate to the room with username and avatar
          const params = new URLSearchParams({
            username: username.trim(),
            avatar: encodeURIComponent(avatarUrl)
          });
          router.push(`/r/${roomCode.toUpperCase()}?${params.toString()}`);
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
        <ServerStatus />
        <div className="max-w-lg w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-3 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              🎬 Watch Party
            </h1>
            <p className="text-purple-200 text-lg">
              Watch YouTube videos together in perfect sync
            </p>
          </div>

          {/* Profile Section */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-6">
            {username ? (
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="relative group cursor-pointer" onClick={() => setShowProfileEditor(true)}>
                    <img
                      src={getAvatarUrl(username, profilePhotoUrl)}
                      alt={username}
                      className="w-16 h-16 rounded-2xl border-3 border-purple-400 shadow-lg group-hover:border-pink-400 transition-all duration-300"
                      onError={() => setIsImageValid(false)}
                    />
                    <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{username}</h3>
                    <p className="text-purple-200 text-sm">Click avatar to edit profile</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProfileEditor(true)}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-4 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm"
                >
                  Edit Profile
                </button>
              </div>
            ) : (
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Welcome!</h3>
                <p className="text-purple-200 text-sm mb-4">Set up your profile to get started</p>
                <button
                  onClick={() => setShowProfileEditor(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg"
                >
                  Create Profile
                </button>
              </div>
            )}

            {/* Profile Editor Modal */}
            {showProfileEditor && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-600 shadow-2xl p-6 w-full max-w-md">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-bold text-xl">Edit Profile</h3>
                    <button
                      onClick={cancelProfileEdit}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Avatar Preview */}
                  <div className="text-center mb-6">
                    <img
                      src={getAvatarUrl(tempUsername, tempProfileUrl)}
                      alt="Avatar Preview"
                      className={`w-20 h-20 rounded-2xl mx-auto border-3 shadow-lg transition-all duration-300 ${
                        isImageValid ? 'border-purple-400' : 'border-red-400'
                      }`}
                      onError={() => setIsImageValid(false)}
                    />
                    <p className="text-gray-300 text-sm mt-2">Avatar Preview</p>
                  </div>

                  {/* Username Input */}
                  <div className="mb-4">
                    <label className="block text-white font-medium mb-2">Username</label>
                    <input
                      type="text"
                      value={tempUsername}
                      onChange={(e) => setTempUsername(e.target.value)}
                      placeholder="Enter your username..."
                      maxLength={20}
                      className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                    />
                  </div>

                  {/* Profile Photo URL */}
                  <div className="mb-6">
                    <label className="block text-white font-medium mb-2">Profile Photo URL (Optional)</label>
                    <input
                      type="url"
                      value={tempProfileUrl}
                      onChange={(e) => handleProfileUrlChange(e.target.value)}
                      placeholder="https://example.com/your-photo.jpg"
                      className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:border-transparent transition-all duration-300 ${
                        isImageValid ? 'border-white/30 focus:ring-purple-500' : 'border-red-400 focus:ring-red-500'
                      }`}
                    />
                    {!isImageValid && tempProfileUrl && (
                      <p className="text-red-400 text-sm mt-1">Invalid image URL. Using default avatar.</p>
                    )}
                    <p className="text-gray-400 text-xs mt-1">Leave empty to use generated avatar</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={cancelProfileEdit}
                      className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-xl font-semibold transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={!tempUsername.trim()}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-gray-600 disabled:to-gray-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 disabled:cursor-not-allowed"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm mb-4 backdrop-blur-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            {username && (
              <div className="space-y-4">
                {/* Create Room */}
                <button
                  onClick={createRoom}
                  disabled={isCreating}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {isCreating ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Room...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <span>🚀</span>
                      <span>Create New Room</span>
                    </div>
                  )}
                </button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-gradient-to-r from-white/10 to-white/5 text-purple-200 rounded-full backdrop-blur-sm">
                      or join existing
                    </span>
                  </div>
                </div>

                {/* Join Room */}
                <div className="space-y-3">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                    placeholder="Enter 6-character room code..."
                    maxLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-purple-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                  />
                  <button
                    onClick={joinRoom}
                    disabled={!roomCode.trim()}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <span>🎯</span>
                      <span>Join Room</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
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