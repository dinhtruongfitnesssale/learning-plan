"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { autoApproves } from "@/lib/coins";
import { requireCoach } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { guard, nonNeg } from "./_shared";

// ── Khóa học ──────────────────────────────────────────────────
export async function createCourse(formData: FormData) {
  const supabase = await guard();
  const title = String(formData.get("title")).trim();
  if (!title) return;
  const { data } = await supabase
    .from("courses")
    .insert({
      title,
      slug: slugify(title) || `khoa-${Date.now()}`,
      summary: String(formData.get("summary") ?? ""),
      cover_emoji: String(formData.get("cover_emoji") || "🍲"),
      accent: (String(formData.get("accent")) || "amber") as
        | "amber"
        | "herb"
        | "slate"
        | "clay",
      category: String(formData.get("category")) || "dinh_duong",
    })
    .select("id, slug")
    .single();
  revalidatePath("/admin/khoa-hoc");
  if (data) redirect(`/admin/khoa-hoc/${data.slug}`);
}

export async function updateCourse(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Tên khóa không được để trống." };
  const price = nonNeg(formData.get("price"));

  // Ưu đãi học phí (0023). Ô loại để trống = tắt ưu đãi.
  const rawType = String(formData.get("discount_type") ?? "");
  const discountType = rawType === "percent" || rawType === "amount" ? rawType : null;
  const discountValue = discountType ? nonNeg(formData.get("discount_value")) : 0;
  if (discountType === "percent" && (discountValue < 1 || discountValue > 99))
    return { ok: false, message: "Ưu đãi theo % phải từ 1 đến 99." };
  if (discountType === "amount" && (discountValue < 1 || discountValue >= price))
    return {
      ok: false,
      message: "Số tiền giảm phải lớn hơn 0 và nhỏ hơn học phí.",
    };
  // Ô datetime-local không có múi giờ → hiểu là giờ Việt Nam.
  const rawEnds = String(formData.get("discount_ends_at") ?? "").trim().slice(0, 16);
  const endsDate = rawEnds ? new Date(`${rawEnds}:00+07:00`) : null;
  if (endsDate && Number.isNaN(endsDate.getTime()))
    return { ok: false, message: "Hạn ưu đãi không hợp lệ." };
  const discountEndsAt = discountType && endsDate ? endsDate.toISOString() : null;

  const { error } = await supabase
    .from("courses")
    .update({
      title,
      summary: String(formData.get("summary") ?? ""),
      cover_emoji: String(formData.get("cover_emoji") || "🍲"),
      accent: String(formData.get("accent")) as
        | "amber"
        | "herb"
        | "slate"
        | "clay",
      category: String(formData.get("category")),
      // Giá do coach nhập → ép về số nguyên không âm. Giá > 0 đổi nút của
      // học viên từ "Yêu cầu học" sang "Đăng ký" + chuyển khoản.
      price,
      discount_type: discountType,
      discount_value: discountValue,
      discount_ends_at: discountEndsAt,
      discount_label: discountType
        ? String(formData.get("discount_label") ?? "").trim()
        : "",
      // Học thử + giá xu (0018). 0 = tắt tính năng tương ứng.
      free_lessons: nonNeg(formData.get("free_lessons")),
      lesson_coin_price: nonNeg(formData.get("lesson_coin_price")),
      course_coin_price: nonNeg(formData.get("course_coin_price")),
      auto_approve: formData.get("auto_approve") === "on",
    })
    .eq("id", id);
  if (error) return { ok: false, message: `Chưa lưu được: ${error.message}` };

  // Vừa bật tự duyệt cho khóa miễn phí → duyệt luôn các yêu cầu đang chờ,
  // không thì người xin trước khi bật vẫn phải đợi.
  const { data: fresh } = await supabase
    .from("courses")
    .select("auto_approve, published, private, price, course_coin_price, lesson_coin_price")
    .eq("id", id)
    .maybeSingle();
  if (fresh && autoApproves(fresh)) {
    await supabase
      .from("enrollments")
      .update({ status: "approved", attempts_reset_at: new Date().toISOString() })
      .eq("course_id", id)
      .eq("status", "pending");
    revalidatePath("/admin/yeu-cau");
  }
  revalidatePath(`/admin/khoa-hoc/${slug}`);
  revalidatePath("/hoc/khoa-hoc");
  return { ok: true, message: "Đã lưu" };
}

// ── Loại khóa học ─────────────────────────────────────────────
export async function createCategory(formData: FormData) {
  const supabase = await guard();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const emoji = String(formData.get("emoji") ?? "").trim();
  const accent = (String(formData.get("accent")) || "amber") as
    | "amber"
    | "herb"
    | "slate"
    | "clay";

  // Slug duy nhất từ tên loại.
  const base = slugify(label) || `loai-${Date.now()}`;
  let slug = base;
  for (let i = 2; ; i++) {
    const { data: dup } = await supabase
      .from("course_categories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!dup) break;
    slug = `${base}-${i}`;
  }

  const { count } = await supabase
    .from("course_categories")
    .select("id", { count: "exact", head: true });
  await supabase
    .from("course_categories")
    .insert({ slug, label, emoji, accent, sort_order: count ?? 0 });
  updateTag("categories"); // làm mới cache getCategories() ngay
  revalidatePath("/admin/khoa-hoc");
}

export async function deleteCategory(formData: FormData) {
  const supabase = await guard();
  const slug = String(formData.get("slug"));
  // Không xóa nếu còn khóa đang dùng loại này.
  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("category", slug);
  if ((count ?? 0) > 0) return;
  await supabase.from("course_categories").delete().eq("slug", slug);
  updateTag("categories"); // làm mới cache getCategories() ngay
  revalidatePath("/admin/khoa-hoc");
}

export async function deleteCourse(formData: FormData) {
  const supabase = await guard();
  await supabase.from("courses").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/khoa-hoc");
  redirect("/admin/khoa-hoc");
}

// ── Chương (module) ───────────────────────────────────────────
export async function createModule(formData: FormData) {
  const supabase = await guard();
  const courseId = String(formData.get("course_id"));
  const courseSlug = String(formData.get("course_slug"));
  // sort_order = lớn nhất hiện có + 1 (tránh trùng số sau khi xóa chương).
  const { data: last } = await supabase
    .from("modules")
    .select("sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("modules").insert({
    course_id: courseId,
    title: String(formData.get("title")),
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
}

export async function updateModule(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  const title = String(formData.get("title")).trim();
  if (!title) return;
  // Ngày mở chương (YYYY-MM-DD); trống = mở ngay (NULL).
  const availableOn = String(formData.get("available_on") ?? "").trim() || null;
  await supabase
    .from("modules")
    .update({ title, available_on: availableOn })
    .eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
}

export async function deleteModule(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  // Bài học trong chương tự chuyển về "Chưa xếp chương" (FK on delete set null).
  await supabase.from("modules").delete().eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
}

// ── Bài học ───────────────────────────────────────────────────
export async function createLesson(formData: FormData) {
  const supabase = await guard();
  const courseId = String(formData.get("course_id"));
  const courseSlug = String(formData.get("course_slug"));
  const title = String(formData.get("title")).trim();
  if (!title) return;
  // sort_order = lớn nhất hiện có + 1 (tránh trùng số sau khi xóa bài).
  const { data: last } = await supabase
    .from("lessons")
    .select("sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const moduleId = String(formData.get("module_id") || "");
  const { data } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      module_id: moduleId || null,
      title,
      slug: slugify(title) || `bai-${Date.now()}`,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("slug")
    .single();
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
  if (data) redirect(`/admin/khoa-hoc/${courseSlug}/bai/${data.slug}`);
}

export async function updateLesson(
  _prev: { ok: boolean; savedAt?: number; message?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; savedAt?: number; message?: string }> {
  await requireCoach();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const courseSlug = String(formData.get("course_slug"));
  const lessonSlug = String(formData.get("lesson_slug"));
  const { error } = await supabase
    .from("lessons")
    .update({
      title: String(formData.get("title")),
      summary: String(formData.get("summary") ?? ""),
      content: String(formData.get("content") ?? ""),
      video_url: String(formData.get("video_url") ?? "").trim(),
      pdf_url: String(formData.get("pdf_url") ?? "").trim(),
      pdf_name: String(formData.get("pdf_name") ?? "").trim(),
      est_minutes: Number(formData.get("est_minutes") || 5),
      xp_reward: Number(formData.get("xp_reward") || 20),
      module_id: String(formData.get("module_id") || "") || null,
      published: String(formData.get("published")) === "on",
      allow_download: String(formData.get("allow_download")) === "on",
      // Ngày mở bài (YYYY-MM-DD); trống = mở ngay (NULL).
      available_on: String(formData.get("available_on") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: "Lưu lỗi: " + error.message };
  revalidatePath(`/admin/khoa-hoc/${courseSlug}/bai/${lessonSlug}`);
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteLesson(formData: FormData) {
  const supabase = await guard();
  const courseSlug = String(formData.get("course_slug"));
  await supabase.from("lessons").delete().eq("id", String(formData.get("id")));
  revalidatePath(`/admin/khoa-hoc/${courseSlug}`);
  redirect(`/admin/khoa-hoc/${courseSlug}`);
}

// Đổi trạng thái khóa: nháp / riêng tư / công khai (gộp published + private).
export async function setCourseVisibility(formData: FormData) {
  const supabase = await guard();
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  const mode = String(formData.get("mode"));
  if (!["draft", "private", "public"].includes(mode)) return;
  await supabase
    .from("courses")
    .update({ published: mode !== "draft", private: mode === "private" })
    .eq("id", id);
  revalidatePath(`/admin/khoa-hoc/${slug}`);
  revalidatePath("/admin/khoa-hoc");
  revalidatePath("/hoc", "layout");
}
