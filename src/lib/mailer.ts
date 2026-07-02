import nodemailer from "nodemailer";
import { APP_NAME, APP_TAGLINE, COLORS } from "./brand";

// Gửi mail bằng Gmail SMTP (App Password của coach). Chỉ chạy phía server.
// Cần 3 biến môi trường:
//   GMAIL_USER            — địa chỉ Gmail dùng để gửi (vd: ban@gmail.com)
//   GMAIL_APP_PASSWORD    — App Password 16 ký tự tạo ở Google Account > Bảo mật
//   NEXT_PUBLIC_APP_URL   — địa chỉ gốc của app (vd: https://bephoc.vercel.app)

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

export function mailerReady() {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function appUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, ""); // bỏ dấu "/" thừa ở cuối
}

function transport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

// Nội dung email chào mừng — link đăng nhập, email, mật khẩu tạm,
// cách đổi mật khẩu, cách học và cách yêu cầu khóa mới.
function welcomeHtml({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}) {
  const base = appUrl();
  const loginUrl = `${base}/login`;
  const changePwUrl = `${base}/hoc/doi-mat-khau`;
  const coursesUrl = `${base}/hoc/khoa-hoc`;
  const hi = fullName ? `Chào ${fullName},` : "Chào bạn,";

  const step = (n: number, title: string, body: string) => `
    <tr>
      <td style="vertical-align:top;padding:0 12px 0 0;">
        <div style="width:26px;height:26px;border-radius:50%;background:${COLORS.amber};color:${COLORS.paper};font-weight:700;font-size:13px;text-align:center;line-height:26px;">${n}</div>
      </td>
      <td style="padding-bottom:16px;">
        <div style="font-weight:600;color:${COLORS.ink};font-size:15px;">${title}</div>
        <div style="color:#4a463f;font-size:14px;line-height:1.6;margin-top:2px;">${body}</div>
      </td>
    </tr>`;

  return `<!doctype html>
<html lang="vi">
<body style="margin:0;padding:0;background:${COLORS.paper2};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper2};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.paper};border:1px solid #e2dccf;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:${COLORS.ink};padding:28px 32px;">
          <div style="color:${COLORS.paper};font-size:20px;font-weight:700;">${APP_NAME}</div>
          <div style="color:#b9b3a6;font-size:13px;margin-top:2px;">${APP_TAGLINE}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="color:${COLORS.ink};font-size:16px;margin:0 0 6px;">${hi}</p>
          <p style="color:#4a463f;font-size:14px;line-height:1.6;margin:0 0 20px;">
            Tài khoản học của bạn đã được tạo. Dưới đây là thông tin đăng nhập và hướng dẫn bắt đầu.
          </p>

          <!-- Thông tin đăng nhập -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper2};border:1px solid #e2dccf;border-radius:12px;margin-bottom:20px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:12px;color:#8a8578;text-transform:uppercase;letter-spacing:.5px;">Email đăng nhập</div>
              <div style="font-size:15px;color:${COLORS.ink};font-weight:600;margin:2px 0 12px;font-family:ui-monospace,Menlo,Consolas,monospace;">${email}</div>
              <div style="font-size:12px;color:#8a8578;text-transform:uppercase;letter-spacing:.5px;">Mật khẩu tạm</div>
              <div style="font-size:15px;color:${COLORS.amber};font-weight:700;margin-top:2px;font-family:ui-monospace,Menlo,Consolas,monospace;">${password}</div>
            </td></tr>
          </table>

          <!-- Nút đăng nhập -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:999px;background:${COLORS.ink};">
              <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;color:${COLORS.paper};font-size:15px;font-weight:600;text-decoration:none;border-radius:999px;">Đăng nhập ngay</a>
            </td></tr>
          </table>

          <div style="font-size:15px;font-weight:700;color:${COLORS.ink};margin-bottom:14px;">Các bước bắt đầu</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${step(1, "Đăng nhập", `Mở <a href="${loginUrl}" style="color:${COLORS.amber};">trang đăng nhập</a> và nhập email cùng mật khẩu tạm ở trên.`)}
            ${step(2, "Đổi mật khẩu", `Ngay sau khi vào, hãy đổi sang mật khẩu riêng của bạn tại mục <a href="${changePwUrl}" style="color:${COLORS.amber};">Đổi mật khẩu</a> để bảo mật.`)}
            ${step(3, "Bắt đầu học", `Vào <a href="${coursesUrl}" style="color:${COLORS.amber};">Khóa học</a>, chọn khóa và học từng bài. Làm bài kiểm tra để đánh dấu hoàn thành và nhận điểm XP.`)}
            ${step(4, "Yêu cầu khóa mới", `Muốn học thêm khóa? Vào <a href="${coursesUrl}" style="color:${COLORS.amber};">Khóa học</a>, bấm <b>“Yêu cầu học”</b> ở khóa bạn muốn — coach duyệt là bạn vào học ngay.`)}
          </table>

          <p style="color:#8a8578;font-size:13px;line-height:1.6;margin:20px 0 0;border-top:1px solid #e2dccf;padding-top:16px;">
            Nếu bạn không yêu cầu tài khoản này, có thể bỏ qua email. Cần hỗ trợ, chỉ cần trả lời email này.
          </p>
        </td></tr>

        <tr><td style="background:${COLORS.paper2};padding:16px 32px;color:#8a8578;font-size:12px;">
          ${APP_NAME} • ${APP_TAGLINE}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function welcomeText({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}) {
  const base = appUrl();
  const hi = fullName ? `Chào ${fullName},` : "Chào bạn,";
  return `${hi}

Tài khoản học của bạn đã được tạo. Thông tin đăng nhập:

  Link đăng nhập: ${base}/login
  Email:          ${email}
  Mật khẩu tạm:   ${password}

Các bước bắt đầu:
  1. Đăng nhập bằng email và mật khẩu tạm ở trên.
  2. Đổi mật khẩu riêng tại: ${base}/hoc/doi-mat-khau
  3. Bắt đầu học tại: ${base}/hoc/khoa-hoc — chọn khóa, học từng bài, làm bài kiểm tra để hoàn thành.
  4. Yêu cầu khóa mới: vào Khóa học, bấm "Yêu cầu học" ở khóa muốn học — coach duyệt là vào học ngay.

Cần hỗ trợ, chỉ cần trả lời email này.

${APP_NAME} • ${APP_TAGLINE}`;
}

// Gửi email chào mừng cho học viên. Ném lỗi nếu chưa cấu hình hoặc gửi thất bại.
export async function sendWelcomeEmail(opts: {
  to: string;
  fullName: string;
  password: string;
}) {
  if (!mailerReady()) {
    throw new Error(
      "Chưa cấu hình gửi email. Điền GMAIL_USER và GMAIL_APP_PASSWORD trong .env.local.",
    );
  }
  const { to, fullName, password } = opts;
  await transport().sendMail({
    from: `"${APP_NAME}" <${GMAIL_USER}>`,
    to,
    subject: `Tài khoản học của bạn tại ${APP_NAME}`,
    text: welcomeText({ fullName, email: to, password }),
    html: welcomeHtml({ fullName, email: to, password }),
  });
}
