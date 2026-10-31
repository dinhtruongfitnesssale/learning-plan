// Mã khuyến mãi (0024). Dùng được cả server lẫn client — số tiền của đơn
// vẫn do RPC apply_promo_code tính, ở đây chỉ để hiển thị và kiểm tra form.
import type { PaymentPromo } from "./supabase/types";
import { formatVnd } from "./payment";

// Khớp check của promo_codes.code ở DB.
export const PROMO_CODE_RE = /^[A-Z0-9_-]{3,30}$/;

export function normalizePromoCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

// "-20%" hoặc "-50.000đ"
export function promoBadge(p: Pick<PaymentPromo, "discount_type" | "discount_value">) {
  return p.discount_type === "percent"
    ? `-${p.discount_value}%`
    : `-${formatVnd(p.discount_value)}`;
}
