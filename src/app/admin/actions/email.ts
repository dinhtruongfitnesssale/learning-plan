"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCoach } from "@/lib/auth";
import { randomPassword, nameFromEmail, parseEmails } from "@/lib/slug";

// Gửi email nội dung tự soạn hàng loạt cho học viên.
// Người nhận: tất cả học viên / học viên một khóa / danh sách chọn tay.
// Dùng {ten} trong tiêu đề hoặc nội dung để tự chèn tên từng học viên.
export async function sendBroadcastEmail(
  _prev: { ok: boolean; message: string; count?: number; done?: boolean } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string; count?: number; done?: boolean }> {
  await requireCoach();
  const supabase = await createClient();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const mode = String(formData.get("mode") ?? "all");
  if (!subject) return { ok: false, message: "Cần nhập tiêu đề email." };
  if (!body) return { ok: false, message: "Cần nhập nội dung email." };

  // Đọc ảnh đính kèm (nếu có). Chỉ nhận file ảnh; tổng dung lượng ≤ 10MB.
  const MAX_TOTAL = 10 * 1024 * 1024;
  const files = formData
    .getAll("attachments")
    .filter((f): f is File => f instanceof File && f.size > 0);
  let totalBytes = 0;
  const images: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/"))
      return { ok: false, message: `Tệp "${f.name}" không phải ảnh.` };
    totalBytes += f.size;
    if (totalBytes > MAX_TOTAL)
      return { ok: false, message: "Tổng dung lượng ảnh vượt quá 10MB." };
    images.push({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
      contentType: f.type,
    });
  }

  // Gom danh sách người nhận theo chế độ.
  let ids: string[] | null = null; // null = tất cả học viên
  if (mode === "course") {
    const courseId = String(formData.get("course_id") ?? "");
    if (!courseId) return { ok: false, message: "Hãy chọn một khóa học." };
    const { data: enr } = await supabase
      .from("enrollments")
      .select("user_id")
      .eq("course_id", courseId)
      .eq("status", "approved");
    ids = [...new Set((enr ?? []).map((e) => e.user_id))];
    if (ids.length === 0)
      return { ok: false, message: "Khóa này chưa có học viên nào." };
  } else if (mode === "selected") {
    ids = String(formData.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0)
      return { ok: false, message: "Hãy chọn ít nhất một học viên." };
  }

  let pq = supabase
    .from("profiles")
    .select("email, full_name")
    .eq("role", "learner");
  if (ids) pq = pq.in("id", ids);
  const { data: rows } = await pq;

  // Lọc email hợp lệ, bỏ trùng.
  const seen = new Set<string>();
  const recipients = (rows ?? [])
    .map((r) => ({ email: (r.email ?? "").trim(), name: r.full_name ?? "" }))
    .filter((r) => {
      if (!r.email || seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });
  if (recipients.length === 0)
    return { ok: false, message: "Không có địa chỉ email hợp lệ để gửi." };

  const { mailerReady, sendCustomEmail } = await import("@/lib/mailer");
  if (!mailerReady())
    return {
      ok: false,
      message:
        "Chưa cấu hình gửi email. Điền GMAIL_USER và GMAIL_APP_PASSWORD trong .env.local.",
    };

  const fill = (s: string, name: string) =>
    s.replaceAll("{ten}", name || "bạn");

  // Gửi theo lô nhỏ để nhanh hơn nhưng không quá tải SMTP.
  let sent = 0;
  const failed: string[] = [];
  const sentEmails: string[] = []; // để đóng dấu "đã nhận email tự soạn"
  const BATCH = 5;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((r) =>
        sendCustomEmail({
          to: r.email,
          subject: fill(subject, r.name),
          body: fill(body, r.name),
          images,
        }),
      ),
    );
    results.forEach((res, idx) => {
      if (res.status === "fulfilled") {
        sent++;
        sentEmails.push(batch[idx].email);
      } else failed.push(batch[idx].email);
    });
  }

  // Lưu vết: đóng dấu mốc nhận email tự soạn gần nhất cho người gửi thành công.
  // Best-effort — lỗi ghi vết không làm hỏng kết quả gửi.
  if (sentEmails.length > 0) {
    try {
      await createAdminClient()
        .from("profiles")
        .update({ last_custom_email_at: new Date().toISOString() })
        .in("email", sentEmails);
      revalidatePath("/admin/gui-mail");
    } catch (e) {
      console.error("Lưu vết gửi email tự soạn thất bại:", e);
    }
  }

  if (failed.length === 0)
    return {
      ok: true,
      done: true,
      message: `Đã gửi thành công tới ${sent} học viên.`,
      count: sent,
    };
  return {
    ok: sent > 0,
    message: `Đã gửi ${sent}/${recipients.length}. Lỗi với: ${failed.join(", ")}`,
    count: sent,
  };
}

// Gửi email chào mừng (link đăng nhập + email + mật khẩu + hướng dẫn) cho học viên.
// Dùng ngay sau khi tạo tài khoản / đặt lại mật khẩu — lúc còn mật khẩu tạm.
export async function sendLearnerEmail(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  await requireCoach();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password)
    return { ok: false, message: "Thiếu email hoặc mật khẩu để gửi." };

  try {
    const { sendWelcomeEmail } = await import("@/lib/mailer");
    await sendWelcomeEmail({ to: email, fullName, password });
    return { ok: true, message: `Đã gửi email hướng dẫn tới ${email}.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định.";
    return { ok: false, message: `Gửi email thất bại: ${msg}` };
  }
}

// ── Tặng khóa cho khách mời (dán nhiều email cùng lúc) ────────
// Coach dán một loạt email vào trang khóa học. Với mỗi email:
//   • chưa có tài khoản → tạo mới (mật khẩu ngẫu nhiên, tên lấy từ email),
//     đánh dấu là KHÁCH MỜI (không được tự yêu cầu học khóa khác);
//   • đã có tài khoản   → giữ nguyên, chỉ mở thêm khóa này.
// Sau đó mở khóa cho tất cả và gửi email hướng dẫn (kèm mật khẩu cho
// người mới, chỉ link khóa học cho người đã có tài khoản).
export type InviteGuestsState = {
  ok: boolean;
  message: string;
  /** Tài khoản vừa tạo hoặc vừa được cấp mật khẩu mới — hiện ra để coach
   *  chép tay nếu email gửi lỗi. */
  created?: { email: string; password: string }[];
  invalid?: string[];
  failed?: string[];
};

export async function inviteGuestsToCourse(
  _prev: InviteGuestsState | null,
  formData: FormData,
): Promise<InviteGuestsState> {
  await requireCoach();
  const courseId = String(formData.get("course_id") ?? "");
  const courseSlug = String(formData.get("course_slug") ?? "");
  if (!courseId) return { ok: false, message: "Thiếu khóa học." };

  const { emails, invalid } = parseEmails(String(formData.get("emails") ?? ""));
  if (emails.length === 0)
    return {
      ok: false,
      message: invalid.length
        ? "Không có email nào hợp lệ."
        : "Hãy dán ít nhất một email.",
      invalid,
    };
  const MAX = 200;
  if (emails.length > MAX)
    return {
      ok: false,
      message: `Mỗi lần tối đa ${MAX} email (bạn đang dán ${emails.length}).`,
    };

  const admin = createAdminClient();

  // Ai đã có tài khoản rồi?
  const { data: existingProfiles } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .in("email", emails);
  const profileByEmail = new Map(
    (existingProfiles ?? []).map((p) => [(p.email ?? "").toLowerCase(), p]),
  );

  // Tạo tài khoản cho email chưa có.
  const created: { id: string; email: string; password: string; fullName: string }[] = [];
  const failed: string[] = [];
  for (const email of emails) {
    if (profileByEmail.has(email)) continue;
    const password = randomPassword();
    const fullName = nameFromEmail(email);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data?.user) {
      failed.push(email);
      continue;
    }
    created.push({ id: data.user.id, email, password, fullName });
  }

  // Đánh dấu khách mời (chỉ với tài khoản VỪA tạo — không hạ quyền
  // học viên cũ đang có sẵn tài khoản).
  if (created.length > 0) {
    await admin
      .from("profiles")
      .update({ is_guest: true })
      .in(
        "id",
        created.map((c) => c.id),
      );
  }

  // Người đã có tài khoản: mật khẩu lưu dạng băm nên không đọc lại được.
  // Ai CHƯA từng đăng nhập lần nào thì chắc chắn không biết mật khẩu của
  // mình — cấp mật khẩu mới rồi gửi kèm để họ vào học được ngay. Ai từng
  // đăng nhập rồi thì giữ nguyên mật khẩu đang dùng, trừ khi coach tick
  // "cấp lại mật khẩu cho tất cả".
  const resetAll = String(formData.get("reset_password") ?? "") === "on";
  const existing = emails
    .filter((e) => profileByEmail.has(e))
    .map((e) => {
      const p = profileByEmail.get(e)!;
      return {
        id: p.id as string,
        email: e,
        fullName: (p.full_name as string) || nameFromEmail(e),
        isCoach: p.role === "coach",
      };
    });

  const reset: { id: string; email: string; password: string; fullName: string }[] = [];
  const kept: { id: string; email: string; fullName: string }[] = [];
  const PW_BATCH = 5;
  for (let i = 0; i < existing.length; i += PW_BATCH) {
    await Promise.all(
      existing.slice(i, i + PW_BATCH).map(async (t) => {
        // Không bao giờ đặt lại mật khẩu của tài khoản coach.
        let needsPassword = resetAll && !t.isCoach;
        if (!needsPassword && !t.isCoach) {
          const { data } = await admin.auth.admin.getUserById(t.id);
          needsPassword = !data?.user?.last_sign_in_at;
        }
        if (needsPassword) {
          const password = randomPassword();
          const { error } = await admin.auth.admin.updateUserById(t.id, { password });
          if (!error) {
            reset.push({ ...t, password });
            return;
          }
        }
        kept.push(t);
      }),
    );
  }

  // Mở khóa cho tất cả (người mới + người đã có tài khoản).
  const targets = [
    ...created.map((c) => ({
      id: c.id,
      email: c.email,
      fullName: c.fullName,
      password: c.password as string | null,
      isNew: true,
    })),
    ...reset.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.fullName,
      password: r.password as string | null,
      isNew: false,
    })),
    ...kept.map((k) => ({
      id: k.id,
      email: k.email,
      fullName: k.fullName,
      password: null as string | null,
      isNew: false,
    })),
  ];

  const { data: existingEnr } = await admin
    .from("enrollments")
    .select("id, user_id, status")
    .eq("course_id", courseId)
    .in(
      "user_id",
      targets.map((t) => t.id),
    );
  const enrByUser = new Map((existingEnr ?? []).map((e) => [e.user_id, e]));

  const toInsert: string[] = [];
  const toApprove: string[] = [];
  const newlyOpened = new Set<string>();
  for (const t of targets) {
    const e = enrByUser.get(t.id);
    if (!e) {
      toInsert.push(t.id);
      newlyOpened.add(t.id);
    } else if (e.status !== "approved") {
      toApprove.push(e.id);
      newlyOpened.add(t.id);
    }
  }
  if (toInsert.length > 0) {
    await admin.from("enrollments").insert(
      toInsert.map((uid) => ({
        user_id: uid,
        course_id: courseId,
        status: "approved" as const,
      })),
    );
  }
  if (toApprove.length > 0) {
    await admin
      .from("enrollments")
      .update({ status: "approved", attempts_reset_at: new Date().toISOString() })
      .in("id", toApprove);
  }

  // Gửi email (best-effort, theo lô 5 để Gmail không chặn).
  let sentCount = 0;
  let mailError: string | null = null;
  try {
    const { data: course } = await admin
      .from("courses")
      .select("title, slug, cover_emoji")
      .eq("id", courseId)
      .maybeSingle();
    const { mailerReady, sendGuestInviteEmail, sendCourseAssignedEmail } =
      await import("@/lib/mailer");
    if (!mailerReady()) {
      mailError = "chưa cấu hình gửi email";
    } else if (course) {
      // Người mới luôn cần email (có mật khẩu). Người cũ chỉ báo khi
      // khóa này thực sự vừa được mở.
      const recipients = targets.filter(
        (t) => t.password !== null || newlyOpened.has(t.id),
      );
      const BATCH = 5;
      for (let i = 0; i < recipients.length; i += BATCH) {
        const results = await Promise.allSettled(
          recipients.slice(i, i + BATCH).map((t) =>
            t.password
              ? sendGuestInviteEmail({
                  to: t.email,
                  fullName: t.fullName,
                  password: t.password,
                  courseTitle: course.title,
                  courseSlug: course.slug,
                  courseEmoji: course.cover_emoji ?? "📘",
                  isNewAccount: t.isNew,
                })
              : sendCourseAssignedEmail({
                  to: t.email,
                  fullName: t.fullName,
                  courseTitle: course.title,
                  courseSlug: course.slug,
                  courseEmoji: course.cover_emoji ?? "📘",
                }),
          ),
        );
        results.forEach((r) => r.status === "fulfilled" && sentCount++);
      }
    }
  } catch (e) {
    console.error("Gửi email mời khách thất bại:", e);
    mailError = e instanceof Error ? e.message : "lỗi không xác định";
  }

  revalidatePath("/admin/hoc-vien");
  if (courseSlug) revalidatePath(`/admin/khoa-hoc/${courseSlug}`);

  const parts: string[] = [];
  if (created.length > 0) parts.push(`tạo mới ${created.length} tài khoản`);
  if (reset.length > 0) parts.push(`cấp mật khẩu mới cho ${reset.length} người`);
  if (kept.length > 0) parts.push(`${kept.length} người dùng mật khẩu sẵn có`);
  const opened = toInsert.length + toApprove.length;
  parts.push(opened > 0 ? `mở khóa cho ${opened} người` : "không ai cần mở thêm");
  if (sentCount > 0) parts.push(`gửi email cho ${sentCount} người`);
  if (mailError) parts.push(`email chưa gửi được (${mailError})`);
  if (failed.length > 0) parts.push(`${failed.length} email tạo lỗi`);

  return {
    ok: true,
    message: "Đã xong: " + parts.join(" · ") + ".",
    created: [...created, ...reset].map((c) => ({
      email: c.email,
      password: c.password,
    })),
    invalid,
    failed,
  };
}
