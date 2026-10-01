import type { Accent, Course } from "./supabase/types";

// 3 trạng thái hiển thị của một khóa, gộp từ published + private.
export type CourseVisibility = "draft" | "private" | "public";

export function courseVisibility(c: Pick<Course, "published" | "private">): CourseVisibility {
  if (!c.published) return "draft";
  return c.private ? "private" : "public";
}

export const VISIBILITY: Record<
  CourseVisibility,
  { label: string; accent: Accent | "ink"; hint: string }
> = {
  draft: {
    label: "Nháp",
    accent: "ink",
    hint: "Đang soạn — chỉ coach thấy, chưa ai học được.",
  },
  private: {
    label: "🔒 Riêng tư",
    accent: "slate",
    hint: "Ẩn khỏi danh mục. Bạn vào học được (tự học); học viên chỉ thấy khi bạn phân khóa cho họ.",
  },
  public: {
    label: "Công khai",
    accent: "herb",
    hint: "Hiện trong danh mục cho mọi học viên.",
  },
};
