// Danh sách mục điều hướng dùng chung cho thanh trên (máy rộng) và thanh
// dưới đáy (điện thoại) — sửa một chỗ là cả hai nơi đổi theo.
export type NavItem = {
  href: string;
  label: string;
  // Nhãn ngắn cho thanh dưới đáy (ô hẹp, chữ phải nằm gọn 1 dòng).
  short?: string;
  icon: string;
  // primary: hiện thành tab dưới đáy; còn lại nằm trong tab "Thêm".
  primary?: boolean;
  badge?: number;
};

export function getNavItems({
  variant,
  isCoach,
  pendingCount = 0,
  payCount = 0,
  isGuest = false,
}: {
  variant: "learner" | "coach";
  isCoach: boolean;
  /** Khách mời không có ví xu → ẩn mục Xu. */
  isGuest?: boolean;
  pendingCount?: number;
  /** Số giao dịch đã khớp tiền, đang chờ coach bấm chốt. */
  payCount?: number;
}): NavItem[] {
  if (variant === "learner") {
    return [
      { href: "/hoc", label: "Bảng học", icon: "🏠", primary: true },
      { href: "/hoc/khoa-hoc", label: "Khóa học", icon: "📚", primary: true },
      ...(isGuest
        ? []
        : [
            {
              href: "/hoc/xu",
              label: "Xu & nhiệm vụ",
              short: "Xu",
              icon: "🪙",
              primary: true,
            } satisfies NavItem,
          ]),
      {
        href: "/hoc/doi-mat-khau",
        label: "Đổi mật khẩu",
        short: "Mật khẩu",
        icon: "🔑",
        primary: isGuest,
      },
      ...(isCoach
        ? [
            {
              href: "/admin",
              label: "Quản trị",
              icon: "🛠️",
              primary: true,
            } satisfies NavItem,
          ]
        : []),
    ];
  }

  return [
    { href: "/admin", label: "Tổng quan", icon: "📊", primary: true },
    { href: "/admin/khoa-hoc", label: "Khóa học", icon: "📚", primary: true },
    { href: "/admin/hoc-vien", label: "Học viên", icon: "👥", primary: true },
    { href: "/admin/gui-mail", label: "Gửi mail", icon: "✉️" },
    { href: "/admin/theo-doi", label: "Theo dõi", icon: "📈" },
    { href: "/admin/danh-gia", label: "Đánh giá", icon: "⭐" },
    { href: "/admin/xu", label: "Xu & nhiệm vụ", short: "Xu", icon: "🪙" },
    {
      href: "/admin/yeu-cau",
      label: "Yêu cầu",
      icon: "📥",
      primary: true,
      badge: pendingCount,
    },
    {
      href: "/admin/thanh-toan",
      label: "Thanh toán",
      short: "Tiền",
      icon: "💳",
      badge: payCount,
    },
    { href: "/hoc", label: "Xem trước", icon: "👁️" },
  ];
}

// Mục đang mở: /hoc và /admin là trang gốc nên phải khớp đúng, tránh sáng
// đèn ở mọi trang con.
export function isNavActive(pathname: string, href: string) {
  if (href === "/hoc" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
