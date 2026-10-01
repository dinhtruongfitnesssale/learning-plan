"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Tự tải lại trang khi đơn còn đang mở, để học viên chuyển khoản xong là
// thấy trạng thái đổi mà không phải bấm F5. Dừng hẳn khi đơn đã đóng —
// không để tab mở quên gõ cửa server mãi mãi.
export function PaymentPoll({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}

// Chép mã/số tài khoản. Trên điện thoại gõ tay 8 ký tự hex rất dễ sai,
// mà sai một ký tự là tiền về không khớp được đơn.
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={copy} className="text-xs link shrink-0">
      {copied ? "Đã chép ✓" : (label ?? "Chép")}
    </button>
  );
}
