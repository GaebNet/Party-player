import { useState, useEffect } from 'react';

/**
 * Server Status Component
 * Displays the backend server status with detailed information
 */
export default function ServerStatus() {
  const [status, setStatus] = useState('checking'); // 'online', 'offline', 'checking'
  const [details, setDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  /**
   * Check server health
   */
  const checkServerStatus = async () => {
    try {
      setStatus('checking');

      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Add timeout
        signal: AbortSignal.timeout(5000)
      });

      const data = await response.json();
      setLastChecked(new Date());

      if (response.ok && data.status === 'ok') {
        setStatus('online');
        setDetails({
          status: 'online',
          uptime: data.uptime,
          rooms: data.rooms,
          timestamp: data.timestamp,
          responseTime: Date.now() - new Date(data.timestamp).getTime()
        });
      } else {
        setStatus('offline');
        setDetails({
          status: 'error',
          message: `Server responded with status ${response.status}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      setStatus('offline');
      setLastChecked(new Date());
      setDetails({
        status: 'error',
        message: error.name === 'TimeoutError'
          ? 'Server timeout (5s) - server may be overloaded'
          : error.message || 'Network error - check your connection',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * Format uptime
   */
  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  /**
   * Format last checked time
   */
  const formatLastChecked = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Check status on mount and every 30 seconds
  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Get status color and icon
   */
  const getStatusDisplay = () => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-500',
          icon: '🟢',
          text: 'Online'
        };
      case 'offline':
        return {
          color: 'bg-red-500',
          icon: '🔴',
          text: 'Offline'
        };
      case 'checking':
      default:
        return {
          color: 'bg-yellow-500',
          icon: '🟡',
          text: 'Checking...'
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`${statusDisplay.color} text-white px-3 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 text-sm font-medium`}
        title="Click for server details"
      >
        <span>{statusDisplay.icon}</span>
        <span>Server {statusDisplay.text}</span>
      </button>

      {/* Details Modal */}
      {showDetails && (
        <div className="absolute top-12 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-80 max-w-96">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">Server Status</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* Status */}
            <div className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${statusDisplay.color}`}></span>
              <span className="font-medium">
                Status: <span className={status === 'online' ? 'text-green-600' : status === 'offline' ? 'text-red-600' : 'text-yellow-600'}>
                  {statusDisplay.text}
                </span>
              </span>
            </div>

            {/* Last Checked */}
            <div className="text-sm text-gray-600">
              Last checked: {formatLastChecked(lastChecked)}
            </div>

            {/* Details */}
            {details && (
              <div className="border-t pt-3 space-y-2">
                {status === 'online' ? (
                  <>
                    <div className="text-sm">
                      <span className="font-medium">Uptime:</span> {formatUptime(details.uptime)}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Active Rooms:</span> {details.rooms}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Response Time:</span> {details.responseTime}ms
                    </div>
                    <div className="text-sm text-gray-500">
                      Server time: {new Date(details.timestamp).toLocaleString()}
                    </div>
                  </>
                ) : (
                  <div className="text-sm">
                    <span className="font-medium text-red-600">Error:</span>
                    <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                      {details.message}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={checkServerStatus}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded transition-colors duration-200"
              disabled={status === 'checking'}
            >
              {status === 'checking' ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}