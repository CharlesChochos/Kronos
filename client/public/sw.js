const CACHE_NAME = 'kronos-v1';
const STATIC_CACHE = 'kronos-static-v1';
const DYNAMIC_CACHE = 'kronos-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

const API_CACHE_DURATION = 5 * 60 * 1000;

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network request failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok && request.url.includes('/api/')) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    if (request.destination === 'document') {
      return caches.match('/');
    }
    
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = { title: 'Kronos', body: 'You have a new notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SET_BADGE') {
    updateAppBadge(event.data.count);
  }
  
  if (event.data && event.data.type === 'CLEAR_BADGE') {
    clearAppBadge();
  }
});

async function updateAppBadge(count) {
  if (self.registration && 'setAppBadge' in self.registration) {
    try {
      if (count > 0) {
        await self.registration.setAppBadge(count);
      } else {
        await self.registration.clearAppBadge();
      }
    } catch (error) {
      console.log('[SW] Unable to set app badge:', error);
    }
  }
}

async function clearAppBadge() {
  if (self.registration && 'clearAppBadge' in self.registration) {
    try {
      await self.registration.clearAppBadge();
    } catch (error) {
      console.log('[SW] Unable to clear app badge:', error);
    }
  }
}

const SYNC_QUEUE_KEY = 'kronos-sync-queue';

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  console.log('[SW] Syncing pending data...');
  
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('/api/')) {
        try {
          const freshResponse = await fetch(request);
          if (freshResponse.ok) {
            await cache.put(request, freshResponse.clone());
            console.log('[SW] Synced:', request.url);
          }
        } catch (error) {
          console.log('[SW] Failed to sync:', request.url, error);
        }
      }
    }
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    });
    
    console.log('[SW] Background sync complete');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    throw error;
  }
}

self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'refresh-notifications') {
    event.waitUntil(refreshNotifications());
  }
});

async function refreshNotifications() {
  try {
    const response = await fetch('/api/notifications');
    if (response.ok) {
      const notifications = await response.json();
      const unreadCount = notifications.filter(n => !n.read).length;
      await updateAppBadge(unreadCount);
    }
  } catch (error) {
    console.log('[SW] Failed to refresh notifications:', error);
  }
}
