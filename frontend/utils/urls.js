// Utility functions for external API URLs
export const getAvatarUrl = (seed) => {
  const baseUrl = process.env.NEXT_PUBLIC_DICEBEAR_API_URL || 'https://api.dicebear.com/7.x/initials/svg'
  return `${baseUrl}?seed=${encodeURIComponent(seed)}&backgroundColor=7c3aed,a855f7,ec4899&textColor=ffffff`
}

export const getYouTubeApiUrl = () => {
  return process.env.NEXT_PUBLIC_YOUTUBE_API_URL || 'https://www.youtube.com/iframe_api'
}

export const getYouTubeThumbnailUrl = (videoId) => {
  const baseUrl = process.env.NEXT_PUBLIC_YOUTUBE_THUMBNAIL_URL || 'https://img.youtube.com/vi'
  return `${baseUrl}/${videoId}/default.jpg`
}

export const getYouTubeVideoUrl = (videoId) => {
  return `https://www.youtube.com/watch?v=${videoId}`
}