import { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';

/**
 * Modern VoiceChat Component - Complete Redesign
 * Enhanced UI with gradients, animations, and modern aesthetics
 */
export default function ModernVoiceChat({ socket, roomCode, username, users, isHost }) {
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
      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      
      console.log('Toggling mute state:', { newMutedState, roomCode });
      
      // Emit mute status to server
      if (newMutedState) {
        console.log('Emitting user-muted event');
        socket.emit('user-muted', { roomCode });
      } else {
        console.log('Emitting user-unmuted event');
        socket.emit('user-unmuted', { roomCode });
      }
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
    <div className="relative overflow-hidden">
      {/* Modern gradient background container */}
      <div className="bg-gradient-to-br from-indigo-900/90 via-purple-900/90 to-pink-900/90 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-2xl">
        
        {/* Header with animated icon */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg transition-all duration-300 ${isVoiceChatEnabled ? 'animate-pulse' : ''}`}>
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold text-xl bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                Voice Chat
              </h3>
              <p className="text-purple-200 text-sm">
                {isVoiceChatEnabled ? 'Connected' : 'Ready to connect'}
              </p>
            </div>
          </div>
          
          {/* Connection indicator */}
          {voiceUsers.size > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isVoiceChatEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-white font-medium text-sm">
                  {voiceUsers.size} in voice
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="space-y-4">
          {!isVoiceChatEnabled ? (
            <button
              onClick={initializeVoiceChat}
              disabled={isConnecting}
              className={`w-full group relative overflow-hidden rounded-xl py-4 px-6 font-semibold text-white transition-all duration-300 transform hover:scale-105 ${
                isConnecting
                  ? 'bg-gradient-to-r from-gray-600 to-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-lg hover:shadow-green-500/25'
              }`}
            >
              <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <div className="relative flex items-center justify-center space-x-3">
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                    <span>Join Voice Chat</span>
                  </>
                )}
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Mute/Unmute button */}
              <button
                onClick={toggleMute}
                className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 transform hover:scale-105 ${
                  isMuted
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-red-500/25'
                    : 'bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20'
                }`}
              >
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="relative flex items-center justify-center space-x-2">
                  {isMuted ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13.22 7.22a.75.75 0 011.06 1.06L11.06 11.5l3.22 3.22a.75.75 0 11-1.06 1.06L10 12.56l-3.22 3.22a.75.75 0 01-1.06-1.06L8.94 11.5 5.72 8.28a.75.75 0 011.06-1.06L10 10.44l3.22-3.22z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">Unmute</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 715 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">Mute</span>
                    </>
                  )}
                </div>
              </button>

              {/* Deafen/Undeafen button */}
              <button
                onClick={toggleDeafen}
                className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 transform hover:scale-105 ${
                  isDeafened
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg hover:shadow-orange-500/25'
                    : 'bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20'
                }`}
              >
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="relative flex items-center justify-center space-x-2">
                  {isDeafened ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15z" />
                      </svg>
                      <span className="text-sm">Hear</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1z" />
                      </svg>
                      <span className="text-sm">Deafen</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Secondary controls when connected */}
          {isVoiceChatEnabled && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={testAudioPlayback}
                className="group relative overflow-hidden bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20 rounded-xl py-2 px-4 font-medium transition-all duration-300 transform hover:scale-105"
              >
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="relative flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Test Audio</span>
                </div>
              </button>

              <button
                onClick={leaveVoiceChat}
                className="group relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl py-2 px-4 font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25"
              >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <div className="relative flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h9.5A2.25 2.25 0 0117 4.25v4.5A2.25 2.25 0 0114.75 11h-5.5A2.25 2.25 0 017 8.75v-4.5zm5.25-.25a.75.75 0 00-.75.75v4.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-.75-.75h-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">Leave</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Enhanced Connection Status */}
        {isVoiceChatEnabled && (
          <div className="mt-6 space-y-4">
            {/* Connection stats */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-white font-medium">Voice Status</span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5L10 17.5 6.5 14H4.25A2.25 2.25 0 012 11.75v-6.5A2.25 2.25 0 014.25 3h11.738z" clipRule="evenodd" />
                    </svg>
                    <span className="text-blue-200">{connectedPeers.size}</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isDeafened 
                      ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-200 border border-red-500/20' 
                      : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-200 border border-green-500/20'
                  }`}>
                    {isDeafened ? '🔇 Deafened' : '🔊 Listening'}
                  </div>
                </div>
              </div>

              {/* Audio status indicators */}
              {Object.entries(audioDebugInfo).length > 0 && (
                <div className="space-y-2">
                  <div className="text-purple-200 text-xs font-medium mb-2">Audio Connections:</div>
                  {Object.entries(audioDebugInfo).map(([userId, info]) => (
                    <div key={userId} className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/5">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          info.status === 'playing' || info.status === 'playing_retry' 
                            ? 'bg-green-400 animate-pulse' 
                            : info.status.includes('failed') 
                              ? 'bg-red-400' 
                              : 'bg-yellow-400 animate-pulse'
                        }`}></div>
                        <span className="text-white text-xs font-mono">
                          {userId.substring(0, 8)}...
                        </span>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        info.status === 'playing' || info.status === 'playing_retry' 
                          ? 'text-green-200 bg-green-500/20' 
                          : info.status.includes('failed') 
                            ? 'text-red-200 bg-red-500/20' 
                            : 'text-yellow-200 bg-yellow-500/20'
                      }`}>
                        {info.status === 'playing' ? '🎵 Active' : 
                         info.status === 'playing_retry' ? '🔄 Retry' :
                         info.status.includes('failed') ? '❌ Failed' : '⏳ Connecting'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Participants list */}
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-xl"></div>
        </div>
      </div>
    </div>
  );
}