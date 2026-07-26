// AFROLOC push handlers, imported at runtime by the Workbox-generated sw.js
// via `workbox.importScripts: ["/sw-push.js"]` (see vite.config.ts).
//
// This file contains ONLY push-related handlers. Lifecycle (install / activate /
// skipWaiting / clientsClaim) and fetch/caching are owned by Workbox in the
// generated service worker, so they are intentionally NOT defined here.

// Push event - show notification
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push received", event);

  let notificationData = {
    title: "AFROLOC",
    body: "Você tem uma nova notificação",
    icon: "/pwa-192x192.png",
    badge: "/apple-touch-icon.png",
    data: {},
    tag: "notification",
    requireInteraction: false,
    vibrate: [100],
    actions: [],
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        ...notificationData,
        title: payload.title || notificationData.title,
        body: payload.message || payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        requireInteraction: payload.priority === "urgent" || payload.priority === "high",
        data: payload.data || notificationData.data,
        vibrate: payload.priority === "urgent" ? [200, 100, 200] : notificationData.vibrate,
        actions: payload.actions || notificationData.actions,
      };
    } catch (error) {
      console.error("[Service Worker] Error parsing push data:", error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: notificationData.vibrate,
      actions: notificationData.actions,
    }),
  );
});

// Notification click event - handle user interaction
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification clicked", event);

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if possible
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }

      // Open a new window otherwise
      if (clients.openWindow) {
        const urlToOpen = event.notification.data?.url || "/";
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

// Background sync event - for offline support (placeholder)
self.addEventListener("sync", (event) => {
  console.log("[Service Worker] Background sync", event.tag);

  if (event.tag === "sync-notifications") {
    event.waitUntil(Promise.resolve());
  }
});
