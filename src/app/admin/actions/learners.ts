"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCoach } from "@/lib/auth";
import { tempPassword } from "@/lib/slug";
import { guard } from "./_shared";

// ── Duyệt ghi danh / phân khóa ────────────────────────────────
export async function approveEnrollment(formData: FormData) {
  const supabase = await guard();
  const enrollmentId = String(formData.get("id"));
  // Cần user_id + course_id để gửi email báo học viên (lấy trước khi cập nhật).
  const { data: enroll } = await supabase
    .from("enrollments")
    .select("user_id, course_id, status")
    .eq("id", enrollmentId)
    .maybeSingle();
  // Duyệt = cấp lại lượt làm quiz mới (quan trọng khi duyệt HỌC LẠI).
  await supabase
    .from("enrollments")
    .update({ status: "approved", attempts_reset_at: new Date().toISOString() })
    .eq("id", enrollmentId);

  // Báo email cho học viên khi vừa MỞ quyền học (bỏ qua nếu đã đang học sẵn).
  // Best-effort: gửi lỗi không làm hỏng việc duyệt.
  if (enroll && enroll.status !== "approved") {
    try {
      const [{ data: prof }, { data: course }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", enroll.user_id)
          .maybeSingle(),
        supabase
          .from("courses")
          .select("title, slug, cover_emoji")
          .eq("id", enroll.course_id)
          .maybeSingle(),
      ]);
      if (prof?.email && course) {
        const { sendCourseAssignedEmail } = await import("@/lib/mailer");
        await sendCourseAssignedEmail({
          to: prof.email,
          fullName: prof.full_name ?? "",
          courseTitle: course.title,
          courseSlug: course.slug,
          courseEmoji: course.cover_emoji ?? "📘",
        });
      }
    } catch (e) {
      console.error("Gửi email duyệt yêu cầu thất bại:", e);
    }
  }

  revalidatePath("/admin/yeu-cau");
  revalidatePath("/admin");
}

export async function denyEnrollment(formData: FormData) {
  const supabase = await guard();
  await supabase.from("enrollments").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/yeu-cau");
  revalidatePath("/admin");
}

// Admin phân khóa trực tiếp cho học viên (duyệt luôn).
// Trả về kết quả kèm trạng thái gửi email để hiện xác nhận cho coach.
export async function assignCourse(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const userId = String(formData.get("user_id"));
  const courseId = String(formData.get("course_id"));
  if (!courseId) return { ok: false, message: "Thiếu khóa học." };
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("enrollments")
      .update({ status: "approved", attempts_reset_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("enrollments")
      .insert({ user_id: userId, course_id: courseId, status: "approved" });
  }

  // Báo email cho học viên khi vừa MỞ quyền học (bỏ qua nếu đã đang học sẵn).
  // Best-effort: gửi lỗi không làm hỏng việc phân khóa.
  let emailNote = "";
  if (!existing || existing.status !== "approved") {
    try {
      const [{ data: prof }, { data: course }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("courses")
          .select("title, slug, cover_emoji")
          .eq("id", courseId)
          .maybeSingle(),
      ]);
      if (prof?.email && course) {
        const { sendCourseAssignedEmail } = await import("@/lib/mailer");
        await sendCourseAssignedEmail({
          to: prof.email,
          fullName: prof.full_name ?? "",
          courseTitle: course.title,
          courseSlug: course.slug,
          courseEmoji: course.cover_emoji ?? "📘",
        });
        emailNote = " và đã gửi email thông báo cho học viên";
      } else if (!prof?.email) {
        emailNote = " (học viên chưa có email nên chưa gửi thông báo)";
      }
    } catch (e) {
      console.error("Gửi email phân khóa thất bại:", e);
      emailNote = " nhưng gửi email thông báo thất bại";
    }
  }

  revalidatePath(`/admin/hoc-vien/${userId}`);
  return { ok: true, message: `Đã mở khóa cho học viên${emailNote}.` };
}

// Phân công NỘI DUNG cho một học viên trong một khóa: gán riêng từng chương
// (cả chương) và/hoặc từng bài học. Ghi đè toàn bộ phân công của khóa này.
//   mode "all"    → xóa hết phân công (học viên xem TẤT CẢ, mặc định).
//   mode "custom" → chỉ mở các chương/bài được chọn.
export async function setContentAssignments(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const userId = String(formData.get("user_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const mode = String(formData.get("mode") ?? "custom");
  if (!userId || !courseId)
    return { ok: false, message: "Thiếu học viên hoặc khóa học." };

  const parseIds = (name: string) =>
    [
      ...new Set(
        String(formData.get(name) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
  const moduleIds = mode === "all" ? [] : parseIds("module_ids");
  const lessonIds = mode === "all" ? [] : parseIds("lesson_ids");

  // Phạm vi chương/bài thuộc khóa này (để xóa đúng phần cần ghi đè + chống
  // gán nhầm id ngoài khóa).
  const [{ data: mods }, { data: less }] = await Promise.all([
    supabase.from("modules").select("id").eq("course_id", courseId),
    supabase.from("lessons").select("id").eq("course_id", courseId),
  ]);
  const courseModuleIds = new Set((mods ?? []).map((m) => m.id as string));
  const courseLessonIds = new Set((less ?? []).map((l) => l.id as string));
  const okModules = moduleIds.filter((id) => courseModuleIds.has(id));
  const okLessons = lessonIds.filter((id) => courseLessonIds.has(id));

  // Ghi đè: xóa phân công cũ của khóa này rồi chèn lại theo lựa chọn mới.
  if (courseModuleIds.size > 0)
    await supabase
      .from("module_assignments")
      .delete()
      .eq("user_id", userId)
      .in("module_id", [...courseModuleIds]);
  if (courseLessonIds.size > 0)
    await supabase
      .from("lesson_assignments")
      .delete()
      .eq("user_id", userId)
      .in("lesson_id", [...courseLessonIds]);

  if (okModules.length > 0)
    await supabase
      .from("module_assignments")
      .insert(okModules.map((id) => ({ user_id: userId, module_id: id })));
  if (okLessons.length > 0)
    await supabase
      .from("lesson_assignments")
      .insert(okLessons.map((id) => ({ user_id: userId, lesson_id: id })));

  revalidatePath(`/admin/hoc-vien/${userId}`);
  if (okModules.length + okLessons.length === 0)
    return { ok: true, message: "Đã mở toàn bộ nội dung khóa cho học viên." };
  return {
    ok: true,
    message: `Đã lưu: mở ${okModules.length} chương và ${okLessons.length} bài lẻ cho học viên.`,
  };
}

export async function unassignCourse(formData: FormData) {
  const supabase = await guard();
  const userId = String(formData.get("user_id"));
  await supabase
    .from("enrollments")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", String(formData.get("course_id")));
  revalidatePath(`/admin/hoc-vien/${userId}`);
}

// Phân MỘT khóa cho NHIỀU học viên cùng lúc (mode "all" = mọi học viên,
// "selected" = danh sách id truyền qua "ids"). Bỏ qua ai đã đang học sẵn,
// duyệt luôn ai đang chờ, và gửi email thông báo cho người vừa được mở khóa.
export async function assignCourseToLearners(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await guard();
  const courseId = String(formData.get("course_id") ?? "");
  const courseSlug = String(formData.get("course_slug") ?? "");
  const mode = String(formData.get("mode") ?? "selected");
  if (!courseId) return { ok: false, message: "Thiếu khóa học." };

  // Danh sách học viên đích.
  let targetIds: string[];
  if (mode === "all") {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "learner");
    targetIds = (profs ?? []).map((p) => p.id);
  } else {
    targetIds = [
      ...new Set(
        String(formData.get("ids") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
  }
  if (targetIds.length === 0)
    return { ok: false, message: "Chưa chọn học viên nào." };

  // Enrollment hiện có của khóa này trong nhóm đích.
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, user_id, status")
    .eq("course_id", courseId)
    .in("user_id", targetIds);
  const byUser = new Map((existing ?? []).map((e) => [e.user_id, e]));

  const toInsert: string[] = []; // chưa ghi danh → thêm mới
  const toApprove: string[] = []; // enrollment id đang chờ → duyệt
  const newlyOpened: string[] = []; // user id vừa được mở khóa → gửi mail
  for (const uid of targetIds) {
    const e = byUser.get(uid);
    if (!e) {
      toInsert.push(uid);
      newlyOpened.push(uid);
    } else if (e.status !== "approved") {
      toApprove.push(e.id);
      newlyOpened.push(uid);
    }
    // đã approved → bỏ qua
  }

  if (toInsert.length > 0) {
    await supabase.from("enrollments").insert(
      toInsert.map((uid) => ({
        user_id: uid,
        course_id: courseId,
        status: "approved" as const,
      })),
    );
  }
  if (toApprove.length > 0) {
    await supabase
      .from("enrollments")
      .update({
        status: "approved",
        attempts_reset_at: new Date().toISOString(),
      })
      .in("id", toApprove);
  }

  // Gửi email thông báo (best-effort) cho học viên vừa được mở khóa.
  let sentCount = 0;
  if (newlyOpened.length > 0) {
    try {
      const [{ data: course }, { data: profs }] = await Promise.all([
        supabase
          .from("courses")
          .select("title, slug, cover_emoji")
          .eq("id", courseId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("email, full_name")
          .in("id", newlyOpened),
      ]);
      const recipients = (profs ?? [])
        .map((p) => ({ email: (p.email ?? "").trim(), name: p.full_name ?? "" }))
        .filter((p) => p.email);
      if (course && recipients.length > 0) {
        const { mailerReady, sendCourseAssignedEmail } = await import(
          "@/lib/mailer"
        );
        if (mailerReady()) {
          const BATCH = 5;
          for (let i = 0; i < recipients.length; i += BATCH) {
            const batch = recipients.slice(i, i + BATCH);
            const results = await Promise.allSettled(
              batch.map((p) =>
                sendCourseAssignedEmail({
                  to: p.email,
                  fullName: p.name,
                  courseTitle: course.title,
                  courseSlug: course.slug,
                  courseEmoji: course.cover_emoji ?? "📘",
                }),
              ),
            );
            results.forEach((r) => r.status === "fulfilled" && sentCount++);
          }
        }
      }
    } catch (e) {
      console.error("Gửi email phân khóa hàng loạt thất bại:", e);
    }
  }

  if (courseSlug) revalidatePath(`/admin/khoa-hoc/${courseSlug}`);

  const opened = toInsert.length + toApprove.length;
  const already = targetIds.length - opened;
  if (opened === 0)
    return {
      ok: true,
      message: `Tất cả ${already} học viên đã học sẵn khóa này rồi.`,
    };
  const parts = [`Đã mở khóa cho ${opened} học viên`];
  if (already > 0) parts.push(`${already} người đã có sẵn`);
  if (sentCount > 0) parts.push(`đã gửi email cho ${sentCount} người`);
  return { ok: true, message: parts.join(" · ") + "." };
}

// ── Học viên ──────────────────────────────────────────────────
// Tạo tài khoản học viên bằng service role (trigger tự tạo profile + streak).
// Tự động gửi email chào mừng (link đăng nhập + mật khẩu tạm + hướng dẫn) cho
// học viên. Vẫn trả về mật khẩu tạm để coach chép tay / gửi lại nếu cần.
export async function createLearner(
  _prev: {
    ok: boolean;
    message: string;
    password?: string;
    email?: string;
    fullName?: string;
    emailSent?: boolean;
    emailError?: string;
  } | null,
  formData: FormData,
): Promise<{
  ok: boolean;
  message: string;
  password?: string;
  email?: string;
  fullName?: string;
  emailSent?: boolean;
  emailError?: string;
}> {
  await requireCoach();
  const email = String(formData.get("email")).trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const customPw = String(formData.get("password") ?? "").trim();
  if (!email) return { ok: false, message: "Cần nhập email." };
  if (customPw && customPw.length < 6)
    return { ok: false, message: "Mật khẩu cần ít nhất 6 ký tự." };

  const password = customPw || tempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    return { ok: false, message: `Không tạo được: ${error.message}` };
  }
  revalidatePath("/admin/hoc-vien");

  // Tự động gửi email chào mừng. Nếu gửi lỗi vẫn coi như tạo thành công —
  // coach thấy cảnh báo và có thể chép tay hoặc bấm gửi lại.
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const { sendWelcomeEmail } = await import("@/lib/mailer");
    await sendWelcomeEmail({ to: email, fullName, password });
    emailSent = true;
  } catch (e) {
    emailError = e instanceof Error ? e.message : "Lỗi không xác định.";
  }

  return {
    ok: true,
    message: emailSent
      ? "Đã tạo tài khoản và gửi email hướng dẫn cho học viên."
      : "Đã tạo tài khoản (chưa gửi được email — chép tay hoặc bấm gửi lại):",
    password,
    email,
    fullName,
    emailSent,
    emailError,
  };
}

type LearnerState = {
  ok: boolean;
  message: string;
  password?: string;
} | null;

// Sửa tên + email học viên (email đổi qua auth admin).
export async function updateLearner(
  _prev: LearnerState,
  formData: FormData,
): Promise<LearnerState> {
  await requireCoach();
  const id = String(formData.get("id"));
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Cần nhập email." };

  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.updateUserById(id, {
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authErr) return { ok: false, message: `Lỗi: ${authErr.message}` };

  await admin
    .from("profiles")
    .update({ full_name: fullName, email })
    .eq("id", id);

  revalidatePath(`/admin/hoc-vien/${id}`);
  revalidatePath("/admin/hoc-vien");
  return { ok: true, message: "Đã lưu thay đổi." };
}

// Đặt lại mật khẩu (sinh mật khẩu tạm mới để gửi cho học viên).
export async function resetLearnerPassword(
  _prev: LearnerState,
  formData: FormData,
): Promise<LearnerState> {
  await requireCoach();
  const id = String(formData.get("id"));
  const password = tempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, message: `Lỗi: ${error.message}` };
  return { ok: true, message: "Mật khẩu mới (gửi cho học viên):", password };
}

// Xóa hẳn tài khoản học viên (kéo theo tiến độ, ghi danh, XP… qua cascade).
export async function deleteLearner(formData: FormData) {
  await requireCoach();
  const id = String(formData.get("id"));
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/admin/hoc-vien");
  redirect("/admin/hoc-vien");
}

// Bật/tắt chế độ khách mời cho một tài khoản. Tắt = trở thành học viên
// bình thường, tự bấm "Yêu cầu học" được.
export async function setLearnerGuest(formData: FormData) {
  await requireCoach();
  const id = String(formData.get("id"));
  const isGuest = String(formData.get("is_guest")) === "true";
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_guest: isGuest }).eq("id", id);
  revalidatePath(`/admin/hoc-vien/${id}`);
  revalidatePath("/admin/hoc-vien");
}

// ── Nhắc học bằng thông báo đẩy ──────────────────────────────
// Gửi ngay cho mọi học viên đang nghỉ (đã bật thông báo). Mỗi người tối
// đa 1 lần/ngày dù bấm bao nhiêu lần (push_log chặn trùng).
export async function remindInactiveNow(
  _prev: { ok: boolean; message: string } | null,
): Promise<{ ok: boolean; message: string }> {
  await guard();
  const { pushConfigured } = await import("@/lib/push");
  if (!pushConfigured()) {
    return { ok: false, message: "Chưa cấu hình khóa VAPID trên server." };
  }
  const { runReminders } = await import("@/lib/reminders");
  const r = await runReminders("manual");
  return {
    ok: true,
    message:
      r.candidates === 0
        ? "Không có ai đang nghỉ mà đã bật thông báo."
        : `Đã gửi tới ${r.sent}/${r.candidates} người${
            r.sent < r.candidates ? " (có người đã được nhắc hôm nay)" : ""
          }.`,
  };
}
