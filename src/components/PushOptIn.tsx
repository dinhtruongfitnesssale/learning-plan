"use client";

import { useEffect, useState } from "react";
import { Card, buttonClass } from "@/components/ui";
import {
  savePushSubscription,
  removePushSubscription,
  sendTestPush,
} from "@/app/hoc/push-actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const SNOOZE_KEY = "push-optin-snooze";

type State =
  | "checking"
  | "unsupported" // trình duyệt không hỗ trợ → ẩn hẳn
  | "ios-install" // iPhone chưa "Thêm vào MH chính" → hướng dẫn
  | "denied" // đã chặn quyền thông báo
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Thẻ "Bật nhắc học" trên bảng học. Bật rồi thì thu gọn thành 1 dòng.
export function PushOptIn({
  audience = "learner",
}: {
  /** coach: lời mời "nhận báo tiền về" thay vì "nhắc học". */
  audience?: "learner" | "coach";
} = {}) {
  const [state, setState] = useState<State>("checking");
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [snoozed, setSnoozed] = useState(false);

  useEffect(() => {
    (async () => {
      if (!VAPID) return setState("unsupported");
      try {
        const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
        if (until > Date.now()) setSnoozed(true);
      } catch {}

      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iPhone chỉ nhận thông báo web khi app đã được thêm ra màn hình chính.
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }

      const reg = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setSub(existing);
        setState("on");
        // Đồng bộ lại: máy này có thể vừa đổi tài khoản đăng nhập.
        savePushSubscription(existing.toJSON(), navigator.userAgent);
      } else {
        setState(Notification.permission === "denied" ? "denied" : "off");
      }
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setNote("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const r = await savePushSubscription(s.toJSON(), navigator.userAgent);
      if (!r.ok) throw new Error("save");
      setSub(s);
      setState("on");
      await sendTestPush();
    } catch {
      if (Notification.permission === "denied") setState("denied");
      else setNote("Chưa bật được. Thử lại sau nhé.");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe().catch(() => {});
    }
    setSub(null);
    setState("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const r = await sendTestPush();
    setNote(r.ok ? "Đã gửi — xem thông báo trên máy nhé." : "Gửi thử không được.");
    setBusy(false);
  }

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 86400_000));
    } catch {}
    setSnoozed(true);
  }

  if (state === "checking" || state === "unsupported") return null;

  if (state === "on") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/55">
        <span>
          🔔 Đã bật thông báo {audience === "coach" ? "tiền về" : "nhắc học"} trên
          máy này
        </span>
        <button onClick={test} disabled={busy} className="link">
          Gửi thử
        </button>
        <button onClick={turnOff} disabled={busy} className="link">
          Tắt
        </button>
        {note && <span>{note}</span>}
      </div>
    );
  }

  if (snoozed) return null;

  return (
    <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <span className="text-2xl shrink-0">🔔</span>
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium">
          {audience === "coach"
            ? "Nhận thông báo tiền về trên điện thoại"
            : "Bật nhắc học trên điện thoại"}
        </div>
        {state === "ios-install" ? (
          <p className="text-ink/60 mt-0.5">
            Trên iPhone: bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên) →{" "}
            <b>Thêm vào MH chính</b>, rồi mở app từ màn hình chính và bật ở
            đây.
          </p>
        ) : state === "denied" ? (
          <p className="text-ink/60 mt-0.5">
            Bạn đã chặn thông báo. Mở cài đặt trình duyệt → Quyền của trang →
            cho phép <b>Thông báo</b>, rồi tải lại trang.
          </p>
        ) : (
          <p className="text-ink/60 mt-0.5">
            {audience === "coach"
              ? "Báo từng giao dịch: đã tự mở khóa, cần bạn chốt, hay tiền về không khớp đơn."
              : "Nhắc khi chuỗi ngày học sắp đứt hoặc lâu rồi bạn chưa vào học. Không spam."}
          </p>
        )}
        {note && <p className="text-clay text-xs mt-1">{note}</p>}
      </div>
      <div className="btn-row shrink-0">
        {state === "off" && (
          <button
            onClick={turnOn}
            disabled={busy}
            className={buttonClass("primary")}
          >
            {busy ? "Đang bật…" : "Bật nhắc"}
          </button>
        )}
        <button onClick={snooze} className={buttonClass("ghost")}>
          Để sau
        </button>
      </div>
    </Card>
  );
}
