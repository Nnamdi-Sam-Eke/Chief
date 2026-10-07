// Chief's service worker: exists ONLY to receive Web Push events while no
// tab is open, and to route a notification click back into the app. It does
// NOT do offline caching / asset precaching — that's a separate concern this
// app doesn't need yet, so keep this file small and single-purpose.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Chief", body: "New insight waiting for you.", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON push payload — fall back to the default text above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/__grok/icon-180.png",
      badge: "/__grok/icon-180.png",
      data: { url: payload.url || "/" },
      tag: "chief-insight", // collapses a burst of pushes into one notification slot
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
