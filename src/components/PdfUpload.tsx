"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveLessonPdf, removeLessonPdf } from "@/app/admin/actions";
import { buttonClass } from "@/components/ui";

const BUCKET = "lesson-files";
const MAX_MB = 25;

export function PdfUpload({
  lessonId,
  courseId,
  pdfUrl,
  pdfName,
}: {
  lessonId: string;
  courseId: string;
  pdfUrl: string;
  pdfName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Chỉ nhận file PDF.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File quá ${MAX_MB}MB.`);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${lessonId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: "application/pdf" });
    if (upErr) {
      setError(`Tải lên lỗi: ${upErr.message}`);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("course_id", courseId);
    fd.set("pdf_url", data.publicUrl);
    fd.set("pdf_name", file.name);
    await saveLessonPdf(fd);
    setBusy(false);
    router.refresh();
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    // Cố gắng xóa file trong Storage (suy ra path từ public URL).
    const marker = `/${BUCKET}/`;
    const i = pdfUrl.indexOf(marker);
    if (i !== -1) {
      const path = decodeURIComponent(pdfUrl.slice(i + marker.length));
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([path]);
    }
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("course_id", courseId);
    await removeLessonPdf(fd);
    setBusy(false);
    router.refresh();
  }

  if (pdfUrl) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xl">📄</span>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="link flex-1 truncate">
          {pdfName || "Tài liệu PDF"}
        </a>
        <button
          onClick={onRemove}
          disabled={busy}
          className="text-sm text-clay hover:underline shrink-0"
        >
          {busy ? "…" : "Gỡ"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onUpload}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={buttonClass("outline")}
      >
        {busy ? "Đang tải lên…" : "📄 Chọn file PDF"}
      </button>
      <span className="text-xs text-ink/45 ml-3">Tối đa {MAX_MB}MB</span>
      {error && <p className="text-clay text-sm mt-2">{error}</p>}
    </div>
  );
}
