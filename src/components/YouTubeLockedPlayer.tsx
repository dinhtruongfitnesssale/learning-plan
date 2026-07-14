"use client";

import { useEffect, useRef, useState } from "react";

// Trình phát YouTube "khóa": ẩn toàn bộ giao diện YouTube (không tiêu đề,
// không logo, không nút Chia sẻ / "Xem trên YouTube"), chỉ cho phát ngay trong
// web app. Một lớp phủ trong suốt chặn mọi cú bấm vào khung YouTube (kể cả
// chuột phải / màn hình kết thúc) và chỉ dùng để phát / tạm dừng. Học viên vẫn
// xem toàn màn hình được bằng nút riêng của app.
export function YouTubeLockedPlayer({ id }: { id: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);

  // controls=0 → không còn giao diện YouTube để bấm ra ngoài; enablejsapi để
  // điều khiển phát/dừng qua postMessage; rel=0 & modestbranding & iv_load_policy
  // để bớt tối đa nhãn/gợi ý dẫn sang YouTube.
  const src =
    `https://www.youtube-nocookie.com/embed/${id}` +
    `?enablejsapi=1&controls=0&rel=0&modestbranding=1&playsinline=1` +
    `&disablekb=1&iv_load_policy=3&fs=0`;

  function command(func: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }

  // Bắt tay để nhận sự kiện trạng thái, đồng bộ nút phát/dừng theo player thật.
  function handshake() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
      "*",
    );
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (typeof e.origin !== "string" || !e.origin.includes("youtube")) return;
      try {
        const data =
          typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const state: unknown = data?.info?.playerState;
        // 1 = đang phát, 2 = tạm dừng, 0 = kết thúc.
        if (state === 1) setPlaying(true);
        else if (state === 2 || state === 0) setPlaying(false);
      } catch {
        /* bỏ qua message không phải của player */
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function toggle() {
    if (playing) command("pauseVideo");
    else command("playVideo");
    setPlaying((p) => !p);
  }

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-ink/10 bg-ink">
      <div
        ref={wrapRef}
        className="relative w-full bg-ink"
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          ref={iframeRef}
          src={src}
          onLoad={handshake}
          title="Video bài học"
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        />

        {/* Lớp phủ chặn mọi tương tác với khung YouTube; chỉ để phát / dừng. */}
        <button
          type="button"
          onClick={toggle}
          onDoubleClick={toggleFullscreen}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={playing ? "Tạm dừng" : "Phát video"}
          className="absolute inset-0 w-full h-full grid place-items-center group focus:outline-none"
        >
          {!playing && (
            <span className="grid place-items-center w-16 h-16 rounded-full bg-ink/55 text-paper text-3xl backdrop-blur-sm transition-transform group-hover:scale-105">
              ▶
            </span>
          )}
        </button>

        {/* Nút toàn màn hình riêng của app (không dùng nút của YouTube). */}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Toàn màn hình"
          className="absolute bottom-3 right-3 grid place-items-center w-9 h-9 rounded-lg bg-ink/55 text-paper text-sm backdrop-blur-sm hover:bg-ink/75 transition-colors"
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
