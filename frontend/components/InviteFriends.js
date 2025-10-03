import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../utils/urls'

export default function InviteFriends({ roomCode, roomData, isVisible, onClose }) {
  const { friends, sendRoomInvite } = useAuth()
  const [loading, setLoading] = useState({})
  const [success, setSuccess] = useState({})
  const [error, setError] = useState('')

  const handleInvite = async (friendId, friendName) => {
    setLoading(prev => ({ ...prev, [friendId]: true }))
    setError('')

    const { error } = await sendRoomInvite(friendId, roomCode, roomData)
    
    if (error) {
      setError(error.message)
    } else {
      setSuccess(prev => ({ ...prev, [friendId]: true }))
      setTimeout(() => {
        setSuccess(prev => ({ ...prev, [friendId]: false }))
      }, 3000)
    }
    
    setLoading(prev => ({ ...prev, [friendId]: false }))
  }

  if (!isVisible) return null

  const onlineFriends = friends.filter(friend => friend.is_online)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden border border-gray-600">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Invite Friends to Room</h3>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-4">
            <p className="text-gray-300 text-sm">Room Code: <span className="font-mono bg-gray-700 px-2 py-1 rounded">{roomCode}</span></p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {onlineFriends.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">😔</div>
              <p className="text-gray-400">No online friends to invite</p>
              <p className="text-gray-500 text-sm mt-1">Friends need to be online to receive invites</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <h4 className="text-white font-medium mb-3">Online Friends ({onlineFriends.length})</h4>
              {onlineFriends.map((friend) => (
                <div key={friend.id} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <img
                        src={friend.avatar_url || getAvatarUrl(friend.username)}
                        alt={friend.display_name}
                        className="w-10 h-10 rounded-full border-2 border-purple-400"
                      />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-700"></div>
                    </div>
                    <div>
                      <p className="text-white font-medium">{friend.display_name}</p>
                      <p className="text-gray-400 text-sm">@{friend.username}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleInvite(friend.id, friend.display_name)}
                    disabled={loading[friend.id] || success[friend.id]}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                      success[friend.id]
                        ? 'bg-green-600 text-white cursor-default'
                        : loading[friend.id]
                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {success[friend.id] ? '✓ Invited' : loading[friend.id] ? 'Sending...' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-750 border-t border-gray-600 p-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}