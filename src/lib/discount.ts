// Ưu đãi học phí khóa học (0023). Dùng được cả server lẫn client.
import type { Course } from "./supabase/types";
import { formatVnd } from "./payment";

type Priced = Pick<
  Course,
  "price" | "discount_type" | "discount_value" | "discount_ends_at" | "discount_label"
>;

export function discountActive(c: Priced, now = Date.now()) {
  return (
    c.price > 0 &&
    !!c.discount_type &&
    c.discount_value > 0 &&
    (!c.discount_ends_at || new Date(c.discount_ends_at).getTime() > now)
  );
}

// Học phí THỰC phải trả. Khớp course_final_price() ở DB — số tiền chốt
// đơn vẫn do RPC tính, hàm này chỉ để hiển thị.
export function coursePrice(c: Priced, now = Date.now()) {
  if (!discountActive(c, now)) return c.price;
  if (c.discount_type === "percent") {
    const pct = Math.min(c.discount_value, 99);
    return Math.max(Math.round((c.price * (100 - pct)) / 100000) * 1000, 0);
  }
  return Math.max(c.price - c.discount_value, 0);
}

// "-20%" hoặc "-50.000đ"
export function discountBadge(c: Priced) {
  return c.discount_type === "percent"
    ? `-${c.discount_value}%`
    : `-${formatVnd(c.discount_value)}`;
}

export function discountEndsText(c: Priced) {
  if (!c.discount_ends_at) return "";
  return (
    "đến " +
    new Date(c.discount_ends_at).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  );
}
