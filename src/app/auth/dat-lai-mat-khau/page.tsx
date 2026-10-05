import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { ResetForm } from "./ResetForm";

// Mở từ link trong email quên mật khẩu: /auth/dat-lai-mat-khau?token_hash=…
// (nằm dưới /auth nên ai chưa đăng nhập cũng vào được).
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash: tokenHash = "" } = await searchParams;

  return (
    <main className="safe-x safe-b flex-1 grid place-items-center pt-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt={APP_NAME} width={40} height={40} />
          <span className="font-serif text-xl">{APP_NAME}</span>
        </Link>

        <p className="eyebrow mb-2">Tài khoản</p>
        {tokenHash ? (
          <>
            <h1 className="font-serif text-3xl mb-1">Đặt mật khẩu mới</h1>
            <p className="text-ink/60 text-sm mb-7">
              Lưu xong bạn sẽ vào học luôn.
            </p>
            <ResetForm tokenHash={tokenHash} />
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl mb-2">Link chưa đúng</h1>
            <p className="text-ink/60 text-sm">
              Link đặt lại mật khẩu bị thiếu hoặc sai. Hãy mở lại link trong
              email, hoặc{" "}
              <Link href="/quen-mat-khau" className="link">
                yêu cầu link mới
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
