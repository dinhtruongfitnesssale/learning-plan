"use server";

import { refresh, revalidatePath } from "next/cache";
import { SUGGESTED_COIN_PACKS } from "@/lib/coins";
import { guard, nonNeg } from "./_shared";

// ── Xu & nhiệm vụ ────────────────────────────────────────────
type Msg = { ok: boolean; message: string };

export async function updateCoinSettings(
  _prev: Msg | null,
  formData: FormData,
): Promise<Msg> {
  const supabase = await guard();
  const { error } = await supabase
    .from("coin_settings")
    .update({
      daily_cap: nonNeg(formData.get("daily_cap")),
      reward_checkin: nonNeg(formData.get("reward_checkin")),
      reward_lesson: nonNeg(formData.get("reward_lesson")),
      reward_quiz: nonNeg(formData.get("reward_quiz")),
      reward_module_quiz: nonNeg(formData.get("reward_module_quiz")),
      reward_streak7: nonNeg(formData.get("reward_streak7")),
      reward_review: nonNeg(formData.get("reward_review")),
      referral_inviter: nonNeg(formData.get("referral_inviter")),
      referral_invitee: nonNeg(formData.get("referral_invitee")),
      referral_monthly_limit: nonNeg(formData.get("referral_monthly_limit")),
      signup_enabled: formData.get("signup_enabled") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/xu");
  revalidatePath("/hoc/xu");
  return { ok: true, message: "Đã lưu cấu hình xu." };
}

export async function createCoinPack(formData: FormData) {
  const supabase = await guard();
  const name = String(formData.get("name") ?? "").trim();
  const price = nonNeg(formData.get("price"));
  const coins = nonNeg(formData.get("coins"));
  if (!name || price <= 0 || coins <= 0) return;
  await supabase.from("coin_packs").insert({
    name,
    price,
    coins,
    bonus: nonNeg(formData.get("bonus")),
    sort_order: nonNeg(formData.get("sort_order")),
  });
  revalidatePath("/admin/xu");
  revalidatePath("/hoc/xu");
}

// Tạo các gói gợi ý còn thiếu (so theo tên) — bấm lại không tạo trùng.
export async function seedCoinPacks() {
  const supabase = await guard();
  const { data: existing } = await supabase.from("coin_packs").select("name, sort_order");
  const names = new Set((existing ?? []).map((p) => p.name));
  let order = Math.max(-1, ...(existing ?? []).map((p) => p.sort_order)) + 1;
  const rows = SUGGESTED_COIN_PACKS.filter((p) => !names.has(p.name)).map(
    (p) => ({ ...p, sort_order: order++ }),
  );
  if (rows.length) await supabase.from("coin_packs").insert(rows);
  revalidatePath("/admin/xu");
  revalidatePath("/hoc/xu");
}

// Sửa gói nạp. Đơn đã tạo trước đó KHÔNG đổi: payments chốt sẵn số tiền và
// số xu lúc tạo đơn, nên học viên đang chuyển khoản theo giá cũ vẫn đúng.
export async function updateCoinPack(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const name = String(formData.get("name") ?? "").trim();
  const price = nonNeg(formData.get("price"));
  const coins = nonNeg(formData.get("coins"));
  if (!name) return { ok: false, message: "Nhập tên gói." };
  if (price < 1000) return { ok: false, message: "Giá tối thiểu 1.000đ." };
  if (coins <= 0) return { ok: false, message: "Số xu phải lớn hơn 0." };
  const { error } = await supabase
    .from("coin_packs")
    .update({
      name,
      price,
      coins,
      bonus: nonNeg(formData.get("bonus")),
      sort_order: nonNeg(formData.get("sort_order")),
    })
    .eq("id", String(formData.get("id")));
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/xu");
  revalidatePath("/hoc/xu");
  return { ok: true, message: "Đã lưu." };
}

export async function toggleCoinPack(formData: FormData): Promise<Msg> {
  const supabase = await guard();
  const { error } = await supabase
    .from("coin_packs")
    .update({ active: formData.get("active") !== "true" })
    .eq("id", String(formData.get("id")));
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/xu");
  revalidatePath("/hoc/xu");
  refresh(); // làm mới ngay màn hình coach đang xem
  return { ok: true, message: "" };
}

// Gói đã có đơn thì payments.pack_id tự về null (on delete set null) — đơn
// cũ vẫn giữ số xu đã chốt nên chốt muộn vẫn cộng đúng.
export async function deleteCoinPack(formData: FormData): Promise<Msg> {
  const supabase = await guard();
  const { error } = await supabase
    .from("coin_packs")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/xu");
  revalidatePath("/hoc/xu");
  refresh(); // làm mới ngay màn hình coach đang xem
  return { ok: true, message: "" };
}

// Coach tặng / trừ xu tay theo email (bù lỗi, thưởng sự kiện…).
export async function adjustCoins(
  _prev: Msg | null,
  formData: FormData,
): Promise<Msg> {
  const supabase = await guard();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const note = String(formData.get("note") ?? "").trim();
  if (!email || amount === 0) {
    return { ok: false, message: "Nhập email và số xu (khác 0)." };
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, full_name")
    // ilike để khỏi lệch hoa/thường; thoát % và _ cho khỏi khớp nhầm người.
    .ilike("email", email.replace(/[\\%_]/g, (ch) => "\\" + ch))
    .maybeSingle();
  if (!prof) return { ok: false, message: "Không thấy học viên với email này." };

  const { data, error } = await supabase.rpc("admin_adjust_coins", {
    p_user: prof.id,
    p_amount: amount,
    p_note: note,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/xu");
  return {
    ok: true,
    message: `${amount > 0 ? "Đã tặng" : "Đã trừ"} ${Math.abs(amount)} xu · ${
      prof.full_name || email
    } còn ${data} xu.`,
  };
}
