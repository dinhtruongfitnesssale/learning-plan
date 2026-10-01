// Cấu hình tài khoản nhận học phí + tiện ích hiển thị.
//
// BANK và vietQrUrl() chỉ dùng trong Server Component (đọc env không có
// tiền tố NEXT_PUBLIC). formatVnd() thì dùng được cả hai phía.
//
// Đặt trong .env.local và Vercel:
//   BANK_ID       mã ngân hàng theo VietQR — "970436" hoặc "vietcombank"
//   BANK_ACCOUNT  số tài khoản nhận tiền
//   BANK_OWNER    tên chủ tài khoản, IN HOA KHÔNG DẤU
export const BANK = {
  id: process.env.BANK_ID ?? "",
  account: process.env.BANK_ACCOUNT ?? "",
  owner: process.env.BANK_OWNER ?? "",
};

export function bankConfigured() {
  return Boolean(BANK.id && BANK.account);
}

// Ảnh QR do vietqr.io sinh: quét bằng app ngân hàng là điền sẵn số tài
// khoản, SỐ TIỀN và NỘI DUNG chuyển khoản.
//
// Điền sẵn nội dung là chi tiết quan trọng nhất của cả luồng này. Bắt học
// viên gõ tay mã BHxxxxxxxx thì kiểu gì cũng có người gõ sai, mà sai mã
// là tiền về không khớp được đơn nào và bạn phải dò sao kê bằng tay.
export function vietQrUrl({ amount, code }: { amount: number; code: string }) {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: code,
    accountName: BANK.owner,
  });
  return `https://img.vietqr.io/image/${BANK.id}-${BANK.account}-compact2.png?${params}`;
}

export function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

// Nhãn tiếng Việt cho từng trạng thái đơn.
export const PAYMENT_LABEL: Record<string, string> = {
  pending: "Chờ chuyển khoản",
  matched: "Đã nhận tiền · chờ coach xác nhận",
  confirmed: "Đã mở khóa học",
  rejected: "Đã từ chối",
  expired: "Đã hết hạn",
};

// Lý do một khoản tiền về không khớp được đơn nào — coach cần đọc hiểu
// ngay để xử, nên viết bằng tiếng Việt thay vì để mã kỹ thuật.
export const UNMATCHED_LABEL: Record<string, string> = {
  no_code: "Nội dung CK không có mã",
  unknown_code: "Mã không tồn tại hoặc đơn đã đóng",
  expired: "Mã đã hết hạn",
  amount_short: "Chuyển thiếu tiền",
};
