// Nhúng video từ nhiều nguồn phổ biến. Trả về null nếu không có URL.
function toEmbed(url: string): { kind: "iframe" | "file"; src: string } | null {
  const u = url.trim();
  if (!u) return null;

  // YouTube
  const yt =
    u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };

  // Vimeo
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };

  // Google Drive
  const drive = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive)
    return { kind: "iframe", src: `https://drive.google.com/file/d/${drive[1]}/preview` };

  // File trực tiếp
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)) return { kind: "file", src: u };

  // Mặc định: thử nhúng như iframe.
  return { kind: "iframe", src: u };
}

export function VideoEmbed({ url }: { url: string }) {
  const embed = toEmbed(url);
  if (!embed) return null;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-ink/10 bg-ink">
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        {embed.kind === "file" ? (
          <video src={embed.src} controls className="absolute inset-0 w-full h-full" />
        ) : (
          <iframe
            src={embed.src}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
