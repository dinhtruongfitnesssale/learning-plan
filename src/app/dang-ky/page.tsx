import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_NAME } from "@/lib/brand";
import { SignUpForm } from "./SignUpForm";

// Trang đăng ký: ai cũng tự tạo tài khoản được (khi coach bật). Vào qua
// link giới thiệu /dang-ky?ref=MÃ thì nhận thêm quà chào mừng.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const code = (ref ?? "").trim().toUpperCase();

  // Trang công khai (chưa đăng nhập) → đọc bằng service role, chỉ lấy đúng
  // tên người mời và cờ bật/tắt, không lộ gì thêm.
  const admin = createAdminClient();
  const [{ data: cfg }, { data: inviter }] = await Promise.all([
    admin
      .from("coin_settings")
      .select("signup_enabled, referral_invitee")
      .eq("id", 1)
      .maybeSingle(),
    code
      ? admin
          .from("profiles")
          .select("full_name")
          .eq("referral_code", code)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const open = !!cfg?.signup_enabled;
  // Mã sai vẫn cho đăng ký thường, chỉ là không có quà.
  const referred = !!inviter;
  const badCode = !!code && !referred;
  const inviterName =
    (inviter as { full_name: string } | null)?.full_name || "Một người bạn";

  return (
    <main className="safe-x safe-b flex-1 grid place-items-center pt-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt={APP_NAME} width={40} height={40} />
          <span className="font-serif text-xl">{APP_NAME}</span>
        </Link>

        {open && referred ? (
          <>
            <p className="eyebrow mb-2">Lời mời</p>
            <h1 className="font-serif text-3xl mb-1">
              {inviterName} mời bạn vào học
            </h1>
            <p className="text-ink/60 text-sm mb-7">
              Tạo tài khoản để học thử miễn phí
              {cfg && cfg.referral_invitee > 0 && (
                <>
                  {" "}
                  và nhận ngay <b>{cfg.referral_invitee} xu</b> quà chào mừng
                </>
              )}
              .
            </p>
            <SignUpForm code={code} />
          </>
        ) : open ? (
          <>
            <p className="eyebrow mb-2">Đăng ký</p>
            <h1 className="font-serif text-3xl mb-1">Tạo tài khoản</h1>
            <p className="text-ink/60 text-sm mb-7">
              Miễn phí — vào học thử ngay sau khi tạo.
            </p>
            {badCode && (
              <p className="text-xs text-clay bg-clay-soft rounded-lg px-3 py-2 mb-4">
                Mã giới thiệu “{code}” không đúng nên không có quà chào mừng —
                bạn vẫn đăng ký bình thường được.
              </p>
            )}
            <SignUpForm code="" />
          </>
        ) : (
          <>
            <p className="eyebrow mb-2">Đăng ký</p>
            <h1 className="font-serif text-3xl mb-2">Đăng ký đang tạm đóng</h1>
            <p className="text-ink/60 text-sm">
              Hiện chưa mở đăng ký tài khoản mới. Liên hệ coach để được cấp
              tài khoản.
            </p>
          </>
        )}

        <p className="text-xs text-ink/45 mt-6">
          Đã có tài khoản?{" "}
          <Link href="/login" className="link">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
