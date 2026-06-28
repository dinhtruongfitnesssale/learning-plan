// Thông tin nhận diện thương hiệu — đổi tên app ở đây là đổi toàn bộ.
export const APP_NAME = "Trung Precision Coach";
export const APP_TAGLINE = "Học khỏe mỗi ngày";

// Bảng màu (đồng bộ với @theme trong globals.css) — dùng khi cần màu trong JS/SVG.
export const COLORS = {
  paper: "#F6F2EA",
  paper2: "#EFE9DD",
  ink: "#14110E",
  amber: "#B5651E",
  herb: "#5C6E48",
  slate: "#3A5567",
  clay: "#A33A2A",
} as const;

// Loại khóa học
export const CATEGORIES = {
  dinh_duong: { label: "Dinh dưỡng", emoji: "🍲" },
  tap_luyen: { label: "Tập luyện", emoji: "🏃" },
} as const;
export type CategoryKey = keyof typeof CATEGORIES;

// Cấp độ (level) dựa trên tổng XP — đo sự tiến bộ thật, không phải mở app nhiều lần.
export const LEVELS = [
  { level: 1, min: 0, name: "Tập sự" },
  { level: 2, min: 150, name: "Vào bếp" },
  { level: 3, min: 400, name: "Quen tay" },
  { level: 4, min: 800, name: "Đầu bếp" },
  { level: 5, min: 1400, name: "Bếp trưởng" },
  { level: 6, min: 2200, name: "Nghệ nhân" },
] as const;

export function levelForXp(xp: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) current = l;
  const next = LEVELS.find((l) => l.min > xp) ?? null;
  const span = next ? next.min - current.min : 1;
  const into = xp - current.min;
  return {
    ...current,
    next,
    progress: next ? Math.min(1, into / span) : 1,
    toNext: next ? next.min - xp : 0,
  };
}
