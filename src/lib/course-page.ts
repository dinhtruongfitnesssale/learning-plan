import "server-only";
import { cookies } from "next/headers";
import { COURSE_PAGE_COOKIE } from "@/lib/course-page-cookie";

// Trang danh sách bài cần mở: ?page trên URL nếu có, không thì trang đã
// nhớ trong cookie của khóa (xem RememberPage), mặc định trang 1.
export async function resolveCoursePage(param: string | undefined) {
  if (param) return Number(param) || 1;
  const saved = (await cookies()).get(COURSE_PAGE_COOKIE)?.value;
  return Number(saved) || 1;
}
