/**
 * J.A.R.V.I.S. School Assistant - Service Worker
 * Version 2.0.0
 * 
 * Handles offline functionality and caching
 */

const CACHE_NAME = 'jarvis-school-v2.1.0';
const CACHE_URLS = [
    './',
    './index.html',
    './manifest.json'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
    console.log('[JARVIS SW] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[JARVIS SW] Caching app shell');
                return cache.addAll(CACHE_URLS);
            })
            .then(() => {
                console.log('[JARVIS SW] Install complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[JARVIS SW] Install failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[JARVIS SW] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[JARVIS SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[JARVIS SW] Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }
                
                // Not in cache - fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone the response
                        const responseToCache = networkResponse.clone();
                        
                        // Add to cache
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('[JARVIS SW] Fetch failed:', error);
                        
                        // If it's a navigation request, return the cached index.html
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        // Return a fallback response for other requests
                        return new Response('Offline - Bitte stelle eine Internetverbindung her.', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain; charset=utf-8'
                            })
                        });
                    });
            })
    );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Background sync for future implementation
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('[JARVIS SW] Background sync triggered');
        // Future: Sync data with server
    }
});

// Push notifications for future implementation
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body || 'Neue Benachrichtigung von JARVIS',
        icon: './icon-192.png',
        badge: './icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || './'
        },
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'J.A.R.V.I.S.', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || './';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already an open window
                for (const client of clientList) {
                    if (client.url.includes('index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

console.log('[JARVIS SW] Service Worker loaded');
