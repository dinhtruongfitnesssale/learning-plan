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

// Nội dung trang giới thiệu khóa (/hoc/khoa-hoc/<slug>) — cột thêm ở 0025.
export async function updateCourseLanding(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const id = String(formData.get("id"));
  const slug = String(formData.get("slug"));
  const text = (k: string) => String(formData.get(k) ?? "").trim();
  const { error } = await supabase
    .from("courses")
    .update({
      intro: text("intro"),
      outcomes: text("outcomes"),
      audience: text("audience"),
      instructor_name: text("instructor_name"),
      instructor_bio: text("instructor_bio"),
    })
    .eq("id", id);
  if (error) {
    return {
      ok: false,
      message: /column/i.test(error.message)
        ? "Chưa lưu được: cần chạy migration 0025_course_landing.sql trên Supabase trước."
        : `Chưa lưu được: ${error.message}`,
    };
  }
  revalidatePath(`/admin/khoa-hoc/${slug}`);
  revalidatePath(`/hoc/khoa-hoc/${slug}`);
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

// ── Cập nhật chương + bài học từ Excel ────────────────────────
export type LessonImportState = {
  ok: boolean;
  created?: number;
  updated?: number;
  newChapters?: number;
  errors?: string[];
};

// So khớp tên chương / tên bài: không phân biệt hoa thường, khoảng trắng thừa.
const nameKey = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export async function importLessons(
  _prev: LessonImportState,
  formData: FormData,
): Promise<LessonImportState> {
  const supabase = await guard();
  const courseId = String(formData.get("course_id"));
  const courseSlug = String(formData.get("course_slug"));

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: ["Chưa chọn file Excel."] };
  }
  const { parseLessonWorkbook } = await import("@/lib/lesson-import");
  const { rows, errors } = parseLessonWorkbook(Buffer.from(await file.arrayBuffer()));
  if (errors.length > 0) return { ok: false, errors };

  const [{ data: modData }, { data: lessonData }] = await Promise.all([
    supabase
      .from("modules")
      .select("id, title, sort_order")
      .eq("course_id", courseId)
      .order("sort_order")
      .order("id"),
    supabase
      .from("lessons")
      .select("id, slug, title, module_id, sort_order")
      .eq("course_id", courseId),
  ]);
  const mods = modData ?? [];
  const existing = lessonData ?? [];
  const bySlug = new Map(existing.map((l) => [l.slug as string, l]));

  // Mã bài lạ (vd. file tải từ khóa khác) → báo lỗi, không nhập gì.
  for (const r of rows) {
    if (r.slug && !bySlug.has(r.slug)) {
      errors.push(
        `Dòng ${r.excelRow}: "Mã bài" ${r.slug} không có trong khóa này — bài mới thì để trống ô này.`,
      );
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  // Chương: dùng lại chương trùng tên, chưa có thì tạo. Chương theo thứ tự
  // xuất hiện trong file, các chương không nhắc tới xếp sau.
  const modByKey = new Map<string, string>();
  for (const m of mods) if (!modByKey.has(nameKey(m.title))) modByKey.set(nameKey(m.title), m.id);
  const fileChapters: string[] = [];
  for (const r of rows) {
    if (r.chapter && !fileChapters.some((c) => nameKey(c) === nameKey(r.chapter))) {
      fileChapters.push(r.chapter);
    }
  }
  const toCreate = fileChapters.filter((c) => !modByKey.has(nameKey(c)));
  if (toCreate.length > 0) {
    const { data: created, error } = await supabase
      .from("modules")
      .insert(toCreate.map((title, i) => ({ course_id: courseId, title, sort_order: mods.length + i })))
      .select("id, title");
    if (error) return { ok: false, errors: ["Tạo chương lỗi: " + error.message] };
    for (const m of created ?? []) modByKey.set(nameKey(m.title), m.id);
  }
  const modOrder = [
    ...fileChapters.map((c) => modByKey.get(nameKey(c))!),
    ...mods.map((m) => m.id).filter((id) => !fileChapters.some((c) => modByKey.get(nameKey(c)) === id)),
  ];

  // Bài: khớp theo Mã bài, không có mã thì theo tên bài (chưa khớp dòng nào).
  const used = new Set<string>();
  const matches = rows.map((r) => {
    let hit = r.slug ? bySlug.get(r.slug) : undefined;
    if (!hit) {
      hit = existing.find((l) => !used.has(l.id) && nameKey(l.title) === nameKey(r.title));
    }
    if (hit) used.add(hit.id);
    return hit;
  });

  // Slug cho bài mới: không trùng bài nào trong khóa.
  const slugs = new Set(existing.map((l) => l.slug as string));
  const freshSlug = (title: string) => {
    const base = slugify(title) || "bai";
    let s = base;
    for (let n = 2; slugs.has(s); n++) s = `${base}-${n}`;
    slugs.add(s);
    return s;
  };

  // Thứ tự bài: theo file, rồi các bài không có trong file giữ thứ tự cũ.
  const rest = existing
    .filter((l) => !used.has(l.id))
    .sort((a, b) => a.sort_order - b.sort_order);

  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  rows.forEach((r, i) => {
    const fields: Record<string, unknown> = {
      title: r.title,
      module_id: r.chapter ? modByKey.get(nameKey(r.chapter)) : null,
      sort_order: i,
    };
    // Ô trống: bài cũ giữ nguyên, bài mới lấy mặc định của bảng.
    for (const k of ["summary", "video_url", "pdf_url", "pdf_name", "content", "est_minutes", "published"] as const) {
      if (r[k] !== null) fields[k] = r[k];
    }
    const hit = matches[i];
    if (hit) updates.push({ id: hit.id, patch: fields });
    else inserts.push({ ...fields, course_id: courseId, slug: freshSlug(r.title) });
  });
  rest.forEach((l, i) => {
    const sort_order = rows.length + i;
    if (l.sort_order !== sort_order) updates.push({ id: l.id, patch: { sort_order } });
  });

  // Ghi: chương trước (thứ tự), rồi bài cũ, rồi bài mới. Chạy song song theo lô nhỏ.
  const failures: string[] = [];
  const jobs: (() => PromiseLike<{ error: { message: string } | null }>)[] = [
    ...modOrder
      .map((id, i) => ({ id, i, old: mods.find((m) => m.id === id)?.sort_order }))
      .filter((m) => m.old !== m.i)
      .map((m) => () => supabase.from("modules").update({ sort_order: m.i }).eq("id", m.id)),
    ...updates.map((u) => () => supabase.from("lessons").update(u.patch).eq("id", u.id)),
  ];
  for (let i = 0; i < jobs.length; i += 10) {
    const res = await Promise.all(jobs.slice(i, i + 10).map((j) => j()));
    for (const { error } of res) if (error) failures.push(error.message);
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("lessons").insert(inserts);
    if (error) failures.push("Thêm bài mới lỗi: " + error.message);
  }

  revalidatePath(`/admin/khoa-hoc/${courseSlug}`, "layout");
  if (failures.length > 0) {
    return { ok: false, errors: [`Đã ghi một phần, còn ${failures.length} lỗi:`, ...failures.slice(0, 5)] };
  }
  return {
    ok: true,
    created: inserts.length,
    updated: rows.length - inserts.length,
    newChapters: toCreate.length,
  };
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
