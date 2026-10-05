// Tiện ích ví xu dùng được cả server lẫn client (không đọc env, không DB).
import type { CoinKind, CoinSettings, Course } from "./supabase/types";

export function formatCoins(n: number) {
  return n.toLocaleString("vi-VN") + " xu";
}

// Nhãn tiếng Việt cho từng dòng sổ xu.
export const COIN_KIND_LABEL: Record<CoinKind, string> = {
  checkin: "Điểm danh",
  lesson: "Học xong bài",
  quiz: "Đạt quiz bài",
  module_quiz: "Đạt quiz chương",
  streak: "Mốc chuỗi ngày học",
  review: "Đánh giá khóa học",
  referral_inviter: "Giới thiệu bạn bè",
  referral_invitee: "Quà bạn mới",
  topup: "Nạp xu",
  admin: "Coach điều chỉnh",
  unlock_lesson: "Mở bài học",
  unlock_course: "Mở cả khóa",
};

// Khóa có bán (tiền hoặc xu) hoặc cho học thử → học viên chưa ghi danh
// vẫn vào trang khóa để học thử / mua, thay vì chỉ "Yêu cầu học".
export function isMonetized(c: Pick<Course, "price" | "free_lessons" | "lesson_coin_price" | "course_coin_price">) {
  return (
    c.price > 0 ||
    c.free_lessons > 0 ||
    c.lesson_coin_price > 0 ||
    c.course_coin_price > 0
  );
}

// Số xu TỐI ĐA một người cày được mỗi ngày (trần học bài/quiz + điểm danh).
// Chuỗi 7 ngày cộng thêm thỉnh thoảng nên chia đều ra từng ngày.
export function maxDailyEarn(s: Pick<CoinSettings, "daily_cap" | "reward_checkin" | "reward_streak7">) {
  return s.daily_cap + s.reward_checkin + s.reward_streak7 / 7;
}

// "Cày nhanh nhất bao nhiêu ngày thì đủ X xu" — giả định ngày nào cũng
// chạm trần. Đây là cận dưới; người học thường cần lâu hơn.
export function daysToEarn(coins: number, s: Parameters<typeof maxDailyEarn>[0]) {
  const perDay = maxDailyEarn(s);
  if (coins <= 0) return 0;
  if (perDay <= 0) return Infinity;
  return Math.ceil(coins / perDay);
}

export function formatDays(n: number) {
  if (!Number.isFinite(n)) return "không cày được (thưởng đang = 0)";
  return `~${n} ngày`;
}

// Khóa TỰ DUYỆT: học viên bấm là vào học ngay. Khớp course_auto_approves()
// ở DB (0022) — chỉ khóa miễn phí, công khai mới được tự duyệt.
export function autoApproves(
  c: Pick<
    Course,
    "auto_approve" | "published" | "private" | "price" | "course_coin_price" | "lesson_coin_price"
  >,
) {
  return (
    !!c.auto_approve &&
    c.published &&
    !c.private &&
    c.price === 0 &&
    c.course_coin_price === 0 &&
    c.lesson_coin_price === 0
  );
}

// 3 gói nạp gợi ý, mốc 1 xu ≈ 100đ; nạp nhiều tặng thêm (+10%, +20%).
export const SUGGESTED_COIN_PACKS = [
  { name: "Gói nhỏ", price: 50000, coins: 500, bonus: 0 },
  { name: "Gói vừa", price: 100000, coins: 1000, bonus: 100 },
  { name: "Gói lớn", price: 200000, coins: 2000, bonus: 400 },
];
