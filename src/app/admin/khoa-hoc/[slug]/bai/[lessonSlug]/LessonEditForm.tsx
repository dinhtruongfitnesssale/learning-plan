"use client";

import { useActionState } from "react";
import { updateLesson, deleteLesson } from "../../../../actions";
import { Card, buttonClass } from "@/components/ui";
import type { Lesson, Module } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export function LessonEditForm({
  lesson: l,
  courseId,
  courseSlug,
  modules: mods,
}: {
  lesson: Lesson;
  courseId: string;
  courseSlug: string;
  modules: Module[];
}) {
  const [state, formAction, pending] = useActionState(updateLesson, null);

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={l.id} />
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="course_slug" value={courseSlug} />
        <input type="hidden" name="lesson_slug" value={l.slug} />
        <label className="block">
          <span className="text-sm text-ink/70">Tiêu đề</span>
          <input name="title" defaultValue={l.title} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">Tóm tắt (1 dòng)</span>
          <input name="summary" defaultValue={l.summary} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">
            Link video (YouTube / Vimeo / Google Drive / .mp4) — để trống nếu không có
          </span>
          <input
            name="video_url"
            defaultValue={l.video_url}
            placeholder="https://youtu.be/..."
            className={inputCls}
          />
        </label>
        <div className="grid sm:grid-cols-[1fr_220px] gap-3">
          <label className="block">
            <span className="text-sm text-ink/70">
              Link tài liệu PDF (Google Drive) — để trống nếu không có
            </span>
            <input
              name="pdf_url"
              defaultValue={l.pdf_url}
              placeholder="https://drive.google.com/file/d/.../view"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">Tên tài liệu hiển thị</span>
            <input
              name="pdf_name"
              defaultValue={l.pdf_name}
              placeholder="VD: Mâm cơm mẫu.pdf"
              className={inputCls}
            />
          </label>
        </div>
        <label className="flex items-center gap-2.5 rounded-lg bg-paper-2 px-3 py-2.5">
          <input
            type="checkbox"
            name="allow_download"
            defaultChecked={l.allow_download}
            className="w-4 h-4 accent-[var(--color-herb)]"
          />
          <span className="text-sm text-ink/80">
            Cho phép học viên tải tài liệu về (tắt = chỉ xem trong bài)
          </span>
        </label>
        <label className="block">
          <span className="text-sm text-ink/70">
            Nội dung (Markdown — ## tiêu đề, - gạch đầu dòng, **đậm**, &gt; trích dẫn)
          </span>
          <textarea
            name="content"
            defaultValue={l.content}
            rows={14}
            className={`${inputCls} font-mono leading-relaxed`}
          />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-sm text-ink/70">Phút đọc</span>
            <input
              name="est_minutes"
              type="number"
              defaultValue={l.est_minutes}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">XP thưởng</span>
            <input
              name="xp_reward"
              type="number"
              defaultValue={l.xp_reward}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink/70">Chương</span>
            <select
              name="module_id"
              defaultValue={l.module_id ?? ""}
              className={inputCls}
            >
              <option value="">Không xếp</option>
              {mods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              name="published"
              defaultChecked={l.published}
              className="w-4 h-4 accent-[var(--color-herb)]"
            />
            <span className="text-sm text-ink/70">Hiển thị</span>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button disabled={pending} className={buttonClass("primary")}>
              {pending ? "Đang lưu…" : "Lưu bài học"}
            </button>
            {state?.ok && (
              <span className="text-herb text-sm font-medium">
                ✓ Đã lưu{" "}
                {state.savedAt
                  ? `lúc ${new Date(state.savedAt).toLocaleTimeString("vi-VN")}`
                  : ""}
              </span>
            )}
            {state && !state.ok && (
              <span className="text-clay text-sm">{state.message}</span>
            )}
          </div>
          <button
            formAction={deleteLesson}
            className="text-sm text-clay hover:underline"
          >
            Xóa bài
          </button>
        </div>
      </form>
    </Card>
  );
}
