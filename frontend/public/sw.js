/**
 * Service Worker for Watch Party PWA
 * Handles caching, offline functionality, and background sync
 * Note: Videos are NOT cached to prevent storage bloat
 */

const CACHE_NAME = 'watch-party-v1.0.0';
const STATIC_CACHE_NAME = 'watch-party-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'watch-party-dynamic-v1.0.0';

// Files to cache for offline functionality (app shell)
const STATIC_FILES = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  // Add other static assets as needed
  // Note: We don't cache Next.js generated files as they change with builds
];

// Files that should never be cached
const NEVER_CACHE = [
  // YouTube video content
  /youtube\.com/,
  /ytimg\.com/,
  /googlevideo\.com/,
  // Socket.IO connections
  /socket\.io/,
  // API endpoints
  /\/api\//,
  // Dynamic video content
  /\/embed\//,
];

/**
 * Install event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching static files...');
        // Only cache essential files, don't fail if some are missing
        return cache.addAll(STATIC_FILES.filter(Boolean));
      })
      .catch((error) => {
        console.warn('SW: Failed to cache some static files:', error);
      })
      .then(() => {
        console.log('SW: Installation complete');
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old caches
              return cacheName.startsWith('watch-party-') && 
                     cacheName !== STATIC_CACHE_NAME && 
                     cacheName !== DYNAMIC_CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('SW: Activation complete');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - Handle network requests with caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for certain requests
  if (shouldNeverCache(url)) {
    return; // Let the request go through normally
  }
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

/**
 * Check if URL should never be cached
 */
function shouldNeverCache(url) {
  return NEVER_CACHE.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(url.href);
    }
    return url.href.includes(pattern);
  });
}

/**
 * Check if request is for a static asset
 */
function isStaticAsset(url) {
  return url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
}

/**
 * Check if request is a navigation request
 */
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

/**
 * Handle static assets with cache-first strategy
 */
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Return cached version and update in background
      fetchAndCache(request, cache);
      return cachedResponse;
    }
    
    // Fetch and cache if not in cache
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
    
  } catch (error) {
    console.warn('SW: Error handling static asset:', error);
    // Return a fallback response if available
    return new Response('Asset not available offline', { status: 503 });
  }
}

/**
 * Handle navigation requests with network-first strategy
 */
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('SW: Network failed, trying cache for navigation');
    
    // Fallback to cache
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to index page for SPA routing
    const indexResponse = await cache.match('/');
    if (indexResponse) {
      return indexResponse;
    }
    
    // Ultimate fallback
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Watch Party - Offline</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container {
              max-width: 400px;
            }
            h1 {
              font-size: 2rem;
              margin-bottom: 1rem;
            }
            p {
              font-size: 1.1rem;
              margin-bottom: 2rem;
              opacity: 0.9;
            }
            button {
              background: rgba(255,255,255,0.2);
              border: 2px solid white;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 1rem;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            button:hover {
              background: white;
              color: #667eea;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎬 Watch Party</h1>
            <p>You're currently offline. Please check your internet connection to join watch parties.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>
    `, {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Handle dynamic requests with network-first strategy
 */
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (networkResponse.status === 200 && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Try to serve from cache
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return a meaningful error response
    return new Response('Content not available offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Background fetch and cache helper
 */
async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response);
    }
  } catch (error) {
    // Silently fail background updates
    console.warn('SW: Background fetch failed:', error);
  }
}

/**
 * Message handling for communication with the main app
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({
        type: 'VERSION',
        payload: { version: CACHE_NAME }
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
      
    default:
      console.log('SW: Unknown message type:', type);
  }
});

/**
 * Clear all caches (for debugging/maintenance)
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('SW: All caches cleared');
}

/**
 * Handle push notifications (placeholder for future enhancement)
 */
self.addEventListener('push', (event) => {
  console.log('SW: Push notification received');
  // TODO: Implement push notifications for room invites, etc.
});

/**
 * Handle background sync (placeholder for future enhancement)
 */
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync triggered:', event.tag);
  // TODO: Implement background sync for chat messages, etc.
});

console.log('SW: Service worker script loaded');