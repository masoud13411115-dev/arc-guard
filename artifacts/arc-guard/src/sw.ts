// @ts-nocheck
/// <reference lib="webworker" />
/// <reference types="workbox-sw" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();

setCacheNameDetails({ prefix: 'arc-guard', suffix: 'v1' });

// Precache all Vite-built assets (includes index.html + offline.html)
precacheAndRoute(self.__WB_MANIFEST ?? []);
cleanupOutdatedCaches();

// ── Cache: Google Fonts ───────────────────────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'arc-guard-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// ── Cache: Images ─────────────────────────────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'arc-guard-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// ── Cache: Firebase / Google APIs ─────────────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com'),
  new NetworkFirst({
    cacheName: 'arc-guard-firebase',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
);

// ── Offline fallback ──────────────────────────────────────────────────────────
// For navigation requests: serve index.html (SPA) if cached, else offline.html
const offlineFallback = async (request) => {
  try {
    const cached = await caches.match(request) ?? await caches.match('index.html');
    if (cached) return cached;
  } catch {}
  const offlinePage = await caches.match('offline.html');
  return offlinePage ?? new Response('<h1>آفلاین</h1>', { headers: { 'Content-Type': 'text/html' } });
};

registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      try {
        return await fetch(request);
      } catch {
        return offlineFallback(request);
      }
    },
    { denylist: [/^\/api\//, /^\/_\//] },
  ),
);

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = { body: event.data?.text() ?? 'هشدار جدید' }; }

  const isEmergency = payload.kind === 'sos';

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'ARC Guard 🛡️', {
      body: payload.body ?? 'هشدار جدید دریافت شد',
      icon: '/arc-guard/icon-192.png',
      badge: '/arc-guard/icon-96.png',
      tag: payload.tag ?? 'arc-guard',
      requireInteraction: isEmergency || (payload.requireInteraction ?? false),
      silent: false,
      dir: 'rtl',
      data: payload,
      vibrate: isEmergency ? [300, 100, 300, 100, 300] : [200, 100, 200],
    }),
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes('/arc-guard'));
      if (existing) return existing.focus();
      return self.clients.openWindow('/arc-guard/');
    }),
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'arc-patrol-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((all) => {
        all.forEach((c) => c.postMessage({ type: 'SYNC_PATROL_LOGS' }));
      }),
    );
  }
});

// ── Messages from app ─────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
