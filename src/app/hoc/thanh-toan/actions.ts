"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatVnd } from "@/lib/payment";
import { normalizePromoCode } from "@/lib/promo";

type PromoState = { ok: boolean; message: string } | null;
type Repriced = { amount: number; free: boolean };

// Học viên áp mã khuyến mãi vào đơn học phí đang chờ. Mọi kiểm tra (hạn,
// lượt, khóa áp dụng, cộng dồn) và số tiền mới đều do RPC làm ở server.
export async function applyPromo(_prev: PromoState, formData: FormData): Promise<PromoState> {
  await requireUser();
  const payCode = String(formData.get("payment_code") ?? "");
  const code = normalizePromoCode(String(formData.get("code") ?? ""));
  const before = Number(formData.get("amount")) || 0;
  if (!code) return { ok: false, message: "Nhập mã khuyến mãi nhé." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_promo_code", {
    p_payment_code: payCode,
    p_code: code,
  });
  if (error) return { ok: false, message: error.message };

  const r = data as Repriced;
  revalidatePath(`/hoc/thanh-toan/${payCode}`);
  if (r.free) {
    revalidatePath("/hoc", "layout");
    return { ok: true, message: "Mã đã giảm hết học phí, khóa học đã mở!" };
  }
  return {
    ok: true,
    message:
      r.amount < before
        ? `Đã áp mã ${code}: còn ${formatVnd(r.amount)}.`
        : `Đã áp mã ${code}, nhưng ưu đãi của khóa đang có lợi hơn nên giá giữ nguyên.`,
  };
}

export async function removePromo(formData: FormData) {
  await requireUser();
  const payCode = String(formData.get("payment_code") ?? "");
  const supabase = await createClient();
  await supabase.rpc("remove_promo_code", {
    p_payment_code: payCode,
    p_code: String(formData.get("code") ?? ""),
  });
  revalidatePath(`/hoc/thanh-toan/${payCode}`);
}
