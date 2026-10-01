import "server-only";
import { BANK } from "./payment";

// Hỏi lại SePay: giao dịch webhook vừa báo có THẬT trong tài khoản không.
//
// Đây là lớp chống webhook giả. Kẻ gian lộ được PAYMENT_WEBHOOK_SECRET thì
// gửi được tin báo "có tiền", nhưng không chen được giao dịch vào sổ của
// SePay — API này đọc thẳng sổ đó bằng token riêng (SEPAY_API_TOKEN).
//
// Tài liệu: GET https://my.sepay.vn/userapi/transactions/details/{id}
//           Authorization: Bearer <SEPAY_API_TOKEN>   (giới hạn 2 req/giây)

export function sepayApiConfigured() {
  return Boolean(process.env.SEPAY_API_TOKEN);
}

export type VerifyResult =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

type SepayTx = {
  id: string;
  account_number: string;
  amount_in: string;
  amount_out: string;
  transaction_content: string;
  reference_number: string;
};

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");

export async function verifySepayTransaction(opts: {
  /** id giao dịch phía SePay (trường "id" trong webhook). */
  sepayId: string;
  /** Mã đơn BHxxxxxxxx phải có trong nội dung chuyển khoản. */
  code: string;
  /** referenceCode trong webhook (nếu có) — phải trùng với sổ SePay. */
  reference?: string;
}): Promise<VerifyResult> {
  const token = process.env.SEPAY_API_TOKEN;
  if (!token) return { ok: false, reason: "chưa cấu hình SEPAY_API_TOKEN" };
  if (!/^\d+$/.test(opts.sepayId)) {
    return { ok: false, reason: "webhook thiếu id giao dịch SePay" };
  }

  let tx: SepayTx | undefined;
  try {
    const res = await fetch(
      `https://my.sepay.vn/userapi/transactions/details/${opts.sepayId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return { ok: false, reason: `SePay API trả ${res.status}` };
    tx = ((await res.json()) as { transaction?: SepayTx }).transaction;
  } catch (e) {
    return { ok: false, reason: `không gọi được SePay API (${(e as Error).message})` };
  }
  if (!tx) return { ok: false, reason: "SePay không có giao dịch này" };

  const amountIn = Math.round(Number(tx.amount_in));
  if (!(amountIn > 0) || Number(tx.amount_out) > 0) {
    return { ok: false, reason: "không phải giao dịch tiền vào" };
  }
  // Tiền phải vào ĐÚNG tài khoản nhận học phí (nếu SePay có nối nhiều TK).
  if (BANK.account && norm(tx.account_number ?? "") !== norm(BANK.account)) {
    return { ok: false, reason: "tiền vào tài khoản khác" };
  }
  if (!norm(tx.transaction_content ?? "").includes(norm(opts.code))) {
    return { ok: false, reason: "nội dung CK trên sổ không có mã đơn" };
  }
  if (
    opts.reference &&
    tx.reference_number &&
    norm(tx.reference_number) !== norm(opts.reference)
  ) {
    return { ok: false, reason: "mã tham chiếu không khớp" };
  }
  return { ok: true, amount: amountIn };
}
