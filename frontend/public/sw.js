// Shows an alert sent by the jobs process as a notification on this device,
// even with no tab of the app open, and opens the alerts page when it is tapped.

self.addEventListener("push", (event) => {
  const alert = event.data ? event.data.json() : null;
  if (!alert) return;
  event.waitUntil(
    self.registration.showNotification(alert.title, {
      body: alert.body,
      tag: alert.tag,
      renotify: true,
      data: { url: alert.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/alerts", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const same = open.find((client) => client.url === url);
      if (same) return same.focus();
      return self.clients.openWindow(url);
    }),
  );
});
