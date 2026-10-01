import { createHash, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySepayTransaction } from "@/lib/sepay";
import {
  notifyAutoConfirmed,
  notifyNeedsConfirm,
  notifyUnmatched,
} from "@/lib/payment-notify";

// POST /api/thanh-toan/webhook — ngân hàng/cổng đối soát báo "có tiền về".
//
// Đây là route DUY NHẤT của app mở cho người ngoài internet gọi, nên nó
// tự xác thực bằng khóa bí mật riêng (xem proxy: đã cho vào danh sách
// công khai để không bị đá về /login).
//
// Nguyên tắc: route này KHÔNG tự quyết định gì. Nó chỉ xác thực, chuẩn
// hóa payload rồi đẩy hết vào RPC match_bank_transfer — toàn bộ việc
// chống gửi lặp, dò mã và khớp tiền nằm trong một transaction ở DB.
//
// ENV cần có:
//   PAYMENT_WEBHOOK_SECRET  — khóa dán vào cấu hình webhook bên cổng
//   SEPAY_API_TOKEN         — token API SePay, để HỎI LẠI giao dịch trước
//                             khi tự chốt (thiếu → mọi đơn chờ coach bấm)
//   SUPABASE_SERVICE_ROLE_KEY — đã có sẵn
//
// Mặc định viết theo SePay (Authorization: Apikey <key>). Đổi cổng thì
// chỉ sửa verifySecret + parsePayload bên dưới, phần còn lại giữ nguyên.

const PROVIDER = "sepay";

// So khóa bằng timingSafeEqual để không rò rỉ độ dài/nội dung khóa qua
// thời gian phản hồi. Hash trước vì timingSafeEqual đòi hai buffer bằng
// độ dài — so trực tiếp sẽ ném lỗi khi kẻ gửi đưa khóa dài ngắn khác nhau.
function secretMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function verifySecret(request: Request): boolean {
  const expected = process.env.PAYMENT_WEBHOOK_SECRET;
  // Thiếu env → từ chối hết. Không bao giờ "chưa cấu hình thì cho qua".
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const given = header.replace(/^Apikey\s+/i, "").trim();
  if (!given) return false;

  return secretMatches(given, expected);
}

interface BankTransfer {
  ref: string;
  amount: number;
  content: string;
}

// Chuẩn hóa payload của cổng về 3 thứ RPC cần. Trả null nếu không phải
// giao dịch TIỀN VÀO hoặc thiếu dữ liệu bắt buộc.
function parsePayload(body: Record<string, unknown>): BankTransfer | null {
  // transferType 'out' = tiền ra khỏi tài khoản, không liên quan học phí.
  if (String(body.transferType ?? "in").toLowerCase() !== "in") return null;

  const ref = String(body.referenceCode ?? body.id ?? "").trim();
  const amount = Math.round(Number(body.transferAmount ?? 0));
  // Nội dung CK có thể nằm ở content hoặc description tùy ngân hàng —
  // ghép cả hai rồi để regex trong RPC tự dò mã.
  const content = [body.content, body.description]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!ref || !Number.isFinite(amount) || amount <= 0) return null;
  return { ref, amount, content };
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    // Không nói rõ sai ở đâu.
    return Response.json({ success: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return Response.json({ success: false }, { status: 400 });
  }

  const transfer = parsePayload(body);
  if (!transfer) {
    // Payload hợp lệ nhưng không phải thứ ta xử lý (tiền ra, thiếu mã
    // giao dịch…). Trả 200 để cổng đừng gửi lại mãi.
    return Response.json({ success: true, result: "ignored" });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("match_bank_transfer", {
    p_provider: PROVIDER,
    p_ref: transfer.ref,
    p_amount: transfer.amount,
    p_content: transfer.content,
    p_payload: body,
  });

  if (error) {
    // Lỗi phía MÌNH (DB sập, sai quyền…) → trả 5xx để cổng gửi lại.
    // Nuốt lỗi và trả 200 ở đây là mất luôn giao dịch, không cứu được.
    console.error("Webhook thanh toán thất bại:", error);
    return Response.json({ success: false }, { status: 500 });
  }

  // result: matched | duplicate | no_code | unknown_code | expired | amount_short
  // Mọi trường hợp đều là 200: DB đã ghi log, không cần cổng gửi lại.
  const r = data as { result: string; code: string | null };

  if (r.result === "matched" && r.code) {
    const code = r.code;
    // TỰ CHỐT: chỉ khi SePay API xác nhận giao dịch là thật. Số tiền đưa
    // vào RPC là số API trả về, không phải số trong webhook. Mọi lỗi ở
    // đây đều "an toàn": đơn giữ 'matched' và coach được báo để bấm tay.
    const v = await verifySepayTransaction({
      sepayId: String(body.id ?? ""),
      code,
      reference: body.referenceCode ? String(body.referenceCode) : undefined,
    });
    let reason = v.ok ? "" : v.reason;
    if (v.ok) {
      const { data: ac, error: acErr } = await admin.rpc("auto_confirm_payment", {
        p_code: code,
        p_verified_amount: v.amount,
      });
      const res = (ac as { result: string; cap?: number } | null)?.result;
      if (acErr) {
        console.error("auto_confirm_payment lỗi:", acErr);
        reason = "lỗi khi tự chốt";
      } else if (res === "confirmed") {
        after(() => notifyAutoConfirmed(code));
        return Response.json({ success: true, result: "auto_confirmed", code });
      } else {
        reason =
          res === "over_cap"
            ? "vượt trần tự chốt"
            : res === "amount_mismatch"
              ? "số tiền lệch với đơn"
              : res === "disabled"
                ? "đang tắt tự chốt"
                : "đơn không còn chờ";
      }
    }
    after(() => notifyNeedsConfirm(code, reason));
  } else if (r.result !== "duplicate") {
    after(() => notifyUnmatched(r.result, transfer.amount, transfer.content));
  }

  return Response.json({ success: true, ...r });
}
