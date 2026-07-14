"use client";

import { useEffect, useRef, useState } from "react";

// Trình phát YouTube "khóa": ẩn toàn bộ giao diện YouTube (không tiêu đề,
// không logo, không nút Chia sẻ / "Xem trên YouTube"), chỉ cho xem ngay trong
// web app. Một lớp phủ trong suốt chặn mọi cú bấm vào khung YouTube (kể cả
// chuột phải / màn hình kết thúc). Điều khiển bằng thanh riêng của app: phát /
// dừng, tua, toàn màn hình — đọc thời lượng & vị trí qua IFrame API.
export function YouTubeLockedPlayer({ id }: { id: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const seekingRef = useRef(false); // đang kéo thanh tua → khỏi bị message ghi đè
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // controls=0 → không còn giao diện YouTube để bấm ra ngoài; enablejsapi để
  // điều khiển qua postMessage; rel=0 & modestbranding & iv_load_policy để bớt
  // tối đa nhãn/gợi ý dẫn sang YouTube.
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

  // Bắt tay để player gửi lại trạng thái (đang phát, vị trí, thời lượng…).
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
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const info = data?.info;
        if (!info) return;
        // 1 = đang phát, 2 = tạm dừng, 0 = kết thúc.
        if (info.playerState === 1) setPlaying(true);
        else if (info.playerState === 2 || info.playerState === 0)
          setPlaying(false);
        if (typeof info.duration === "number" && info.duration > 0)
          setDuration(info.duration);
        if (typeof info.currentTime === "number" && !seekingRef.current)
          setCurrent(info.currentTime);
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

  function commitSeek(e: React.SyntheticEvent<HTMLInputElement>) {
    const v = Number(e.currentTarget.value);
    setCurrent(v);
    command("seekTo", [v, true]);
    seekingRef.current = false;
  }

  const max = duration || 0;

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

        {/* Lớp phủ chặn mọi tương tác với khung YouTube; bấm để phát / dừng. */}
        <button
          type="button"
          onClick={toggle}
          onDoubleClick={toggleFullscreen}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={playing ? "Tạm dừng" : "Phát video"}
          className="absolute inset-0 z-10 w-full h-full grid place-items-center group focus:outline-none"
        >
          {!playing && (
            <span className="grid place-items-center w-16 h-16 rounded-full bg-ink/55 text-paper text-3xl backdrop-blur-sm transition-transform group-hover:scale-105">
              ▶
            </span>
          )}
        </button>

        {/* Thanh điều khiển của app: phát/dừng · tua · thời gian · toàn màn hình. */}
        <div
          className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2.5 px-3 py-2 bg-gradient-to-t from-ink/85 via-ink/45 to-transparent text-paper"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Tạm dừng" : "Phát"}
            className="shrink-0 w-8 h-8 grid place-items-center rounded-md hover:bg-paper/15 transition-colors text-sm"
          >
            {playing ? "❚❚" : "▶"}
          </button>

          <span className="shrink-0 font-mono text-xs tnum tabular-nums">
            {fmt(current)}
          </span>

          <input
            type="range"
            min={0}
            max={max}
            step="any"
            value={Math.min(current, max)}
            disabled={max === 0}
            aria-label="Tua video"
            onPointerDown={() => (seekingRef.current = true)}
            onChange={(e) => setCurrent(Number(e.currentTarget.value))}
            onPointerUp={commitSeek}
            onKeyUp={commitSeek}
            className="flex-1 h-1.5 accent-amber cursor-pointer disabled:cursor-default"
          />

          <span className="shrink-0 font-mono text-xs tnum tabular-nums text-paper/70">
            {fmt(max)}
          </span>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toàn màn hình"
            className="shrink-0 w-8 h-8 grid place-items-center rounded-md hover:bg-paper/15 transition-colors text-sm"
          >
            ⛶
          </button>
        </div>
      </div>
    </div>
  );
}

// Giây → m:ss.
function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}
