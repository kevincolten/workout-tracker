// Service Worker for Workout Tracker PWA

// Increment this version to trigger an update
const CACHE_VERSION = 5;
const CACHE_NAME = `workout-tracker-v${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/watch.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon.svg'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing new version:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    // Don't skip waiting - let the app control when to update
});

// Activate event - clean up old caches and notify clients
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new version:', CACHE_NAME);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName.startsWith('workout-tracker-') && cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
            .then(() => {
                // Notify all clients that the app was updated
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'APP_UPDATED' });
                    });
                });
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip API requests (npoint.io) - always go to network
    if (event.request.url.includes('api.npoint.io')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Clone the response
                        const responseToCache = networkResponse.clone();

                        // Cache the fetched response
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed, return offline fallback for HTML
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Listen for skip waiting message from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting requested');
        self.skipWaiting();
    }
});

// Background sync for workout data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-workouts') {
        event.waitUntil(syncWorkouts());
    }
});

async function syncWorkouts() {
    // This will be triggered when the app comes back online
    // The main app.js handles the actual sync logic
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_REQUESTED' });
    });
}
