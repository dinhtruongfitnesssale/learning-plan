"use client";

import { useEffect, useRef } from "react";

// Thẻ chương gấp/mở (accordion) có nhớ trạng thái qua localStorage,
// để khi lật trang phân trang xong quay lại, chương vẫn mở như cũ.
export function Chapter({
  storageKey,
  summary,
  children,
  className,
}: {
  storageKey: string;
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (ref.current && localStorage.getItem(storageKey) === "1") {
      ref.current.open = true;
    }
  }, [storageKey]);

  return (
    <details
      ref={ref}
      className={className}
      onToggle={(e) => {
        try {
          localStorage.setItem(
            storageKey,
            e.currentTarget.open ? "1" : "0",
          );
        } catch {
          // localStorage bị chặn (chế độ riêng tư) — bỏ qua, chỉ mất tính năng nhớ.
        }
      }}
    >
      {summary}
      {children}
    </details>
  );
}
