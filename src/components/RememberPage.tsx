"use client";

import { useEffect } from "react";
import { COURSE_PAGE_COOKIE } from "@/lib/course-page-cookie";

// Ghi lại trang danh sách bài đang xem, để refresh / quay lại khóa (link
// không có ?page) mở đúng trang vừa xem thay vì về trang 1.
export function RememberPage({ path, page }: { path: string; page: number }) {
  useEffect(() => {
    document.cookie = `${COURSE_PAGE_COOKIE}=${page}; path=${path}; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }, [path, page]);
  return null;
}
