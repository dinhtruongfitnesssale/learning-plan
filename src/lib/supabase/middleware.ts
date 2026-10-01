import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresh phiên Supabase trên mỗi request + chặn route cần đăng nhập.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // /dang-ky: bạn được giới thiệu tự tạo tài khoản qua link ?ref=MÃ.
  const isAuthPage = pathname === "/login" || pathname === "/dang-ky";
  // Route công khai: landing, login, asset tĩnh, auth callback, và
  // manifest (trình duyệt tải file này khi “Thêm vào màn hình chính”,
  // không kèm cookie — chặn lại là mất icon/tên app).
  //
  // /api/thanh-toan/webhook: ngân hàng gọi server-to-server, KHÔNG có
  // cookie phiên. Không mở ở đây thì mọi webhook bị đá về /login bằng
  // redirect 307 — cổng đọc là "gửi thất bại", tiền về mà app không
  // biết, và lỗi này hoàn toàn im lặng. Route tự xác thực bằng khóa bí
  // mật riêng, không dựa vào phiên đăng nhập.
  const isPublic =
    pathname === "/" ||
    isAuthPage ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/api/thanh-toan/webhook" ||
    // Vercel Cron gọi không kèm cookie; route tự kiểm CRON_SECRET.
    pathname === "/api/cron/nhac-hoc" ||
    pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/hoc";
    return NextResponse.redirect(url);
  }

  return response;
}
