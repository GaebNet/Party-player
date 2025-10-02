import { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';

/**
 * Modern VoiceChat Component
 * Handles WebRTC voice communication with aesthetic UI design
 */
export default function VoiceChat({ socket, roomCode, username, users, isHost }) {
  // Voice chat state
  const [isVoiceChatEnabled, setIsVoiceChatEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState(new Set());
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioDebugInfo, setAudioDebugInfo] = useState({});
  const [connectedPeers, setConnectedPeers] = useState(new Set());

  // Refs for managing streams and peers
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const audioElementsRef = useRef({});

  /**
   * Initialize voice chat - get user media and set up listeners
   */
  const initializeVoiceChat = async () => {
    try {
      setIsConnecting(true);
      console.log('Initializing voice chat...');
      
      // Get user media (audio only)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });

      console.log('Got user media stream:', stream);
      localStreamRef.current = stream;
      
      // Initially mute the stream
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });

      // Join voice chat room
      console.log('Emitting join-voice-chat event:', { roomCode, username });
      socket.emit('join-voice-chat', { roomCode, username });
      setIsVoiceChatEnabled(true);
      setIsConnecting(false);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsConnecting(false);
      alert('Could not access microphone. Please check your permissions and try again.');
    }
  };

  /**
   * Leave voice chat and clean up all connections
   */
  const leaveVoiceChat = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      peer.destroy();
    });
    peersRef.current = {};

    // Remove all audio elements
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElementsRef.current = {};

    // Leave voice chat room
    socket.emit('leave-voice-chat', { roomCode });
    setIsVoiceChatEnabled(false);
    setVoiceUsers(new Set());
  };

  /**
   * Toggle mute state
   */
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  /**
   * Test audio playback capability
   */
  const testAudioPlayback = async () => {
    try {
      // Create a test audio with a short beep
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      alert('If you heard a beep, your audio is working! If not, check your browser audio settings.');
    } catch (error) {
      console.error('Audio test failed:', error);
      alert('Audio test failed. Your browser may not support audio or audio is disabled.');
    }
  };

  /**
   * Toggle deafen state (mute all incoming audio)
   */
  const toggleDeafen = () => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);
    
    // Apply deafen state to all current audio elements
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.muted = newDeafenState;
      console.log(`Audio element ${newDeafenState ? 'muted' : 'unmuted'}`);
    });
    
    console.log(`Deafen toggled: ${newDeafenState ? 'ON' : 'OFF'}`);
  };

  /**
   * Create a peer connection for a new user
   */
  const createPeer = (userToCall, callerID, stream) => {
    console.log('Creating peer for userToCall:', userToCall, 'as callerID:', callerID);
    
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      }
    });

    peer.on('signal', signal => {
      console.log('Sending signal to:', userToCall, 'from:', callerID);
      socket.emit('sending-signal', { userToCall, callerID, signal });
    });

    peer.on('stream', remoteStream => {
      console.log('Received remote stream from:', userToCall);
      
      // Update debug info
      setAudioDebugInfo(prev => ({
        ...prev,
        [userToCall]: { 
          status: 'stream_received', 
          timestamp: new Date().toLocaleTimeString(),
          streamActive: remoteStream.active,
          audioTracks: remoteStream.getAudioTracks().length
        }
      }));
      
      // Create audio element for this user
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = isDeafened;
      
      // Set volume to ensure it's audible
      audio.volume = 1.0;
      
      // Add to DOM to ensure browser treats it properly
      audio.style.display = 'none';
      document.body.appendChild(audio);
      
      // Store reference
      audioElementsRef.current[userToCall] = audio;
      
      // Add connection to tracked peers
      setConnectedPeers(prev => new Set([...prev, userToCall]));
      
      // Attempt to play with better error handling
      const playAudio = async () => {
        try {
          await audio.play();
          console.log('Audio playing successfully for user:', userToCall);
          setAudioDebugInfo(prev => ({
            ...prev,
            [userToCall]: { 
              ...prev[userToCall],
              status: 'playing', 
              error: null
            }
          }));
        } catch (error) {
          console.error('Audio play failed for user:', userToCall, error);
          setAudioDebugInfo(prev => ({
            ...prev,
            [userToCall]: { 
              ...prev[userToCall],
              status: 'play_failed', 
              error: error.message
            }
          }));
          
          // Try again after a short delay
          setTimeout(async () => {
            try {
              await audio.play();
              console.log('Audio playing successfully after retry for user:', userToCall);
              setAudioDebugInfo(prev => ({
                ...prev,
                [userToCall]: { 
                  ...prev[userToCall],
                  status: 'playing_retry', 
                  error: null
                }
              }));
            } catch (retryError) {
              console.error('Audio play failed on retry for user:', userToCall, retryError);
              setAudioDebugInfo(prev => ({
                ...prev,
                [userToCall]: { 
                  ...prev[userToCall],
                  status: 'play_failed_retry', 
                  error: retryError.message
                }
              }));
            }
          }, 1000);
        }
      };
      
      playAudio();
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
    });

    peer.on('close', () => {
      console.log('Peer connection closed for user:', userToCall);
      // Clean up audio element
      if (audioElementsRef.current[userToCall]) {
        const audio = audioElementsRef.current[userToCall];
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
        delete audioElementsRef.current[userToCall];
      }
      
      // Remove from connected peers
      setConnectedPeers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userToCall);
        return newSet;
      });
      
      // Clean up debug info
      setAudioDebugInfo(prev => {
        const newInfo = { ...prev };
        delete newInfo[userToCall];
        return newInfo;
      });
    });

    return peer;
  };

  /**
   * Accept an incoming peer connection
   */
  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      }
    });

    peer.on('signal', signal => {
      socket.emit('returning-signal', { signal, callerID });
    });

    peer.on('stream', remoteStream => {
      console.log('Received remote stream from:', callerID);
      
      // Update debug info
      setAudioDebugInfo(prev => ({
        ...prev,
        [callerID]: { 
          status: 'stream_received', 
          timestamp: new Date().toLocaleTimeString(),
          streamActive: remoteStream.active,
          audioTracks: remoteStream.getAudioTracks().length
        }
      }));
      
      // Create audio element for this user
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = isDeafened;
      
      // Set volume to ensure it's audible
      audio.volume = 1.0;
      
      // Add to DOM to ensure browser treats it properly
      audio.style.display = 'none';
      document.body.appendChild(audio);
      
      // Store reference
      audioElementsRef.current[callerID] = audio;
      
      // Add connection to tracked peers
      setConnectedPeers(prev => new Set([...prev, callerID]));
      
      // Attempt to play with better error handling
      const playAudio = async () => {
        try {
          await audio.play();
          console.log('Audio playing successfully for user:', callerID);
          setAudioDebugInfo(prev => ({
            ...prev,
            [callerID]: { 
              ...prev[callerID],
              status: 'playing', 
              error: null
            }
          }));
        } catch (error) {
          console.error('Audio play failed for user:', callerID, error);
          setAudioDebugInfo(prev => ({
            ...prev,
            [callerID]: { 
              ...prev[callerID],
              status: 'play_failed', 
              error: error.message
            }
          }));
          
          // Try again after a short delay
          setTimeout(async () => {
            try {
              await audio.play();
              console.log('Audio playing successfully after retry for user:', callerID);
              setAudioDebugInfo(prev => ({
                ...prev,
                [callerID]: { 
                  ...prev[callerID],
                  status: 'playing_retry', 
                  error: null
                }
              }));
            } catch (retryError) {
              console.error('Audio play failed on retry for user:', callerID, retryError);
              setAudioDebugInfo(prev => ({
                ...prev,
                [callerID]: { 
                  ...prev[callerID],
                  status: 'play_failed_retry', 
                  error: retryError.message
                }
              }));
            }
          }, 1000);
        }
      };
      
      playAudio();
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
    });

    peer.on('close', () => {
      // Clean up audio element
      if (audioElementsRef.current[callerID]) {
        const audio = audioElementsRef.current[callerID];
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
        delete audioElementsRef.current[callerID];
      }
      
      // Remove from connected peers
      setConnectedPeers(prev => {
        const newSet = new Set(prev);
        newSet.delete(callerID);
        return newSet;
      });
      
      // Clean up debug info
      setAudioDebugInfo(prev => {
        const newInfo = { ...prev };
        delete newInfo[callerID];
        return newInfo;
      });
    });

    peer.signal(incomingSignal);
    return peer;
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    console.log('Setting up voice chat socket listeners...');

    // Handle voice chat users list update
    socket.on('voice-chat-users', (users) => {
      console.log('Received voice-chat-users:', users);
      setVoiceUsers(new Set(users));
    });

    // Handle new user joining voice chat
    socket.on('user-joined-voice', (payload) => {
      console.log('Received user-joined-voice:', payload);
      if (localStreamRef.current && payload.callerID !== socket.id) {
        console.log('Creating peer for new user:', payload.callerID);
        const peer = createPeer(payload.callerID, socket.id, localStreamRef.current);
        peersRef.current[payload.callerID] = peer;
      }
    });

    // Handle receiving call signal
    socket.on('receiving-returned-signal', (payload) => {
      console.log('Received receiving-returned-signal:', payload);
      const item = peersRef.current[payload.id];
      if (item) {
        item.signal(payload.signal);
      }
    });

    // Handle incoming call
    socket.on('receiving-signal', (payload) => {
      console.log('Received receiving-signal:', payload);
      if (localStreamRef.current) {
        const peer = addPeer(payload.signal, payload.callerID, localStreamRef.current);
        peersRef.current[payload.callerID] = peer;
      }
    });

    // Handle user leaving voice chat
    socket.on('user-left-voice', (payload) => {
      console.log('Received user-left-voice:', payload);
      if (peersRef.current[payload.callerID]) {
        peersRef.current[payload.callerID].destroy();
        delete peersRef.current[payload.callerID];
      }
      if (audioElementsRef.current[payload.callerID]) {
        audioElementsRef.current[payload.callerID].pause();
        audioElementsRef.current[payload.callerID].srcObject = null;
        delete audioElementsRef.current[payload.callerID];
      }
    });

    return () => {
      console.log('Cleaning up voice chat socket listeners...');
      socket.off('voice-chat-users');
      socket.off('user-joined-voice');
      socket.off('receiving-returned-signal');
      socket.off('receiving-signal');
      socket.off('user-left-voice');
    };
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isVoiceChatEnabled) {
        leaveVoiceChat();
      }
    };
  }, []);

  // Update audio elements mute state when deafened state changes
  useEffect(() => {
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.muted = isDeafened;
    });
  }, [isDeafened]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          Voice Chat
        </h3>
        
        {voiceUsers.size > 0 && (
          <span className="text-sm text-gray-400">
            {voiceUsers.size} participant{voiceUsers.size !== 1 ? 's' : ''} in voice
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {!isVoiceChatEnabled ? (
          <button
            onClick={initializeVoiceChat}
            disabled={isConnecting}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isConnecting
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Join Voice Chat'
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isMuted
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {isMuted ? (
                <>
                  <svg className="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13.22 7.22a.75.75 0 011.06 1.06L11.06 11.5l3.22 3.22a.75.75 0 11-1.06 1.06L10 12.56l-3.22 3.22a.75.75 0 01-1.06-1.06L8.94 11.5 5.72 8.28a.75.75 0 011.06-1.06L10 10.44l3.22-3.22z" clipRule="evenodd" />
                    <path d="M7 4a3 3 0 016 0v4c0 .615-.187 1.187-.508 1.664L9.972 7.144A3.001 3.001 0 007 4zM10 10.94A7.001 7.001 0 0017 8a1 1 0 10-2 0 5 5 0 01-8.532 3.532l1.406-1.406A2.999 2.999 0 0010 8v2.94z" />
                  </svg>
                  Unmute
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Mute
                </>
              )}
            </button>

            <button
              onClick={toggleDeafen}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDeafened
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {isDeafened ? (
                <>
                  <svg className="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM2.343 4.343a.75.75 0 011.061 0l1.06 1.061a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM15.596 13.596a.75.75 0 011.061 0l1.06 1.061a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061z" />
                  </svg>
                  Undeafen
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
                  </svg>
                  Deafen
                </>
              )}
            </button>

            <button
              onClick={leaveVoiceChat}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Leave Voice
            </button>

            <button
              onClick={testAudioPlayback}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Test Audio
            </button>
          </div>
        )}
      </div>

      {/* Connection Status and Debug Info */}
      {isVoiceChatEnabled && (
        <div className="mt-3 text-xs text-gray-400">
          <div className="flex justify-between items-center mb-2">
            <span>Audio Connections: {connectedPeers.size}</span>
            <span className={`px-2 py-1 rounded ${isDeafened ? 'bg-red-600' : 'bg-green-600'} text-white`}>
              {isDeafened ? 'Deafened' : 'Listening'}
            </span>
          </div>
          
          {Object.entries(audioDebugInfo).length > 0 && (
            <div className="space-y-1">
              <div className="text-gray-500">Audio Status:</div>
              {Object.entries(audioDebugInfo).map(([userId, info]) => (
                <div key={userId} className="flex justify-between text-xs">
                  <span>User {userId.substring(0, 8)}...</span>
                  <span className={`${
                    info.status === 'playing' || info.status === 'playing_retry' 
                      ? 'text-green-400' 
                      : info.status.includes('failed') 
                        ? 'text-red-400' 
                        : 'text-yellow-400'
                  }`}>
                    {info.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Voice participants list */}
      {voiceUsers.size > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <h4 className="text-sm text-gray-400 mb-2">In Voice Chat:</h4>
          <div className="flex flex-wrap gap-2">
            {users
              .filter(user => voiceUsers.has(user.id))
              .map(user => (
                <span
                  key={user.id}
                  className="px-2 py-1 bg-green-600 text-white text-sm rounded-full flex items-center"
                >
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  {user.username}
                  {user.id === socket?.id && ' (You)'}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}