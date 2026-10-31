"use server";

import { refresh, revalidatePath } from "next/cache";
import { normalizePromoCode, PROMO_CODE_RE } from "@/lib/promo";
import { guard, nonNeg } from "./_shared";

type Msg = { ok: boolean; message: string };

// ── Mã khuyến mãi ─────────────────────────────────────────────
// Tạo mới (không có id) hoặc sửa mã. Đơn đã áp mã từ trước giữ nguyên
// điều kiện cũ — payment_promos chụp lại lúc áp.
export async function savePromo(_prev: Msg | null, formData: FormData): Promise<Msg> {
  const supabase = await guard();
  const id = String(formData.get("id") ?? "");
  const code = normalizePromoCode(String(formData.get("code") ?? ""));
  if (!PROMO_CODE_RE.test(code))
    return {
      ok: false,
      message: "Mã gồm 3–30 ký tự: chữ không dấu, số, dấu - hoặc _.",
    };

  const type = String(formData.get("discount_type")) === "amount" ? "amount" : "percent";
  const value = nonNeg(formData.get("discount_value"));
  if (type === "percent" && (value < 1 || value > 100))
    return { ok: false, message: "Giảm theo % phải từ 1 đến 100." };
  if (type === "amount" && value < 1000)
    return { ok: false, message: "Số tiền giảm tối thiểu 1.000đ." };

  const rawMax = String(formData.get("max_uses") ?? "").trim();
  const maxUses = rawMax ? nonNeg(rawMax) : null;
  if (maxUses === 0) return { ok: false, message: "Tổng lượt phải lớn hơn 0 (để trống = không giới hạn)." };

  // Ô datetime-local không có múi giờ → hiểu là giờ Việt Nam.
  const rawEnds = String(formData.get("ends_at") ?? "").trim().slice(0, 16);
  const endsDate = rawEnds ? new Date(`${rawEnds}:00+07:00`) : null;
  if (endsDate && Number.isNaN(endsDate.getTime()))
    return { ok: false, message: "Hạn dùng không hợp lệ." };

  const allCourses = String(formData.get("scope")) !== "selected";
  const courseIds = [
    ...new Set(formData.getAll("course_ids").map(String).filter(Boolean)),
  ];
  if (!allCourses && courseIds.length === 0)
    return { ok: false, message: "Chọn ít nhất một khóa áp dụng." };

  const row = {
    code,
    label: String(formData.get("label") ?? "").trim(),
    discount_type: type,
    discount_value: value,
    all_courses: allCourses,
    max_uses: maxUses,
    ends_at: endsDate ? endsDate.toISOString() : null,
    stackable: formData.get("stackable") === "on",
    with_course_discount: formData.get("with_course_discount") === "on",
  };

  const { data, error } = id
    ? await supabase.from("promo_codes").update(row).eq("id", id).select("id").single()
    : await supabase.from("promo_codes").insert(row).select("id").single();
  if (error)
    return {
      ok: false,
      message:
        error.code === "23505"
          ? `Mã "${code}" đã có rồi, đặt mã khác nhé.`
          : `Chưa lưu được: ${error.message}`,
    };

  // Ghi đè danh sách khóa áp dụng.
  await supabase.from("promo_code_courses").delete().eq("promo_id", data.id);
  if (!allCourses)
    await supabase
      .from("promo_code_courses")
      .insert(courseIds.map((course_id) => ({ promo_id: data.id, course_id })));

  revalidatePath("/admin/khuyen-mai");
  return { ok: true, message: id ? "Đã lưu." : `Đã tạo mã ${code}.` };
}

export async function togglePromo(formData: FormData): Promise<Msg> {
  const supabase = await guard();
  const { error } = await supabase
    .from("promo_codes")
    .update({ active: formData.get("active") !== "true" })
    .eq("id", String(formData.get("id")));
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/khuyen-mai");
  refresh(); // làm mới ngay màn hình coach đang xem
  return { ok: true, message: "" };
}

// Đơn đã áp mã vẫn giữ số tiền (payment_promos.promo_id tự về null).
export async function deletePromo(formData: FormData): Promise<Msg> {
  const supabase = await guard();
  const { error } = await supabase
    .from("promo_codes")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/khuyen-mai");
  refresh(); // làm mới ngay màn hình coach đang xem
  return { ok: true, message: "" };
}
