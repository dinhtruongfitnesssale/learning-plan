import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Bỏ qua asset tĩnh & file ảnh. sw.js (service worker nhắc học) phải
    // tải được kể cả khi phiên hết hạn, không thì trình duyệt đá nó đi.
    "/((?!_next/static|_next/image|favicon.svg|icon.svg|logo.png|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
