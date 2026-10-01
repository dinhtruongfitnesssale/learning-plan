// Service worker của Bếp Học — chỉ lo THÔNG BÁO ĐẨY (nhắc học).
// Không cache trang: app luôn cần mạng, cache sai còn làm học viên
// thấy bài cũ.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Bếp Học";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/logo.png",
      badge: "/logo.png",
      // Cùng tag → thông báo mới thay thông báo cũ, không chất đống.
      tag: data.tag || "nhac-hoc",
      renotify: true,
      data: { url: data.url || "/hoc" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data && event.notification.data.url) || "/hoc",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      // App đang mở sẵn → chuyển tới đó thay vì mở thêm cửa sổ.
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          await w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
