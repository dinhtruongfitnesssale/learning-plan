import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { ForgotForm } from "./ForgotForm";

// Quên mật khẩu: nhập email → nhận link đặt lại qua Gmail.
export default function ForgotPasswordPage() {
  return (
    <main className="safe-x safe-b flex-1 grid place-items-center pt-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt={APP_NAME} width={40} height={40} />
          <span className="font-serif text-xl">{APP_NAME}</span>
        </Link>

        <p className="eyebrow mb-2">Tài khoản</p>
        <h1 className="font-serif text-3xl mb-1">Quên mật khẩu</h1>
        <p className="text-ink/60 text-sm mb-7">
          Nhập email bạn dùng để đăng nhập, chúng tôi sẽ gửi link đặt mật khẩu
          mới.
        </p>
        <ForgotForm />

        <p className="text-sm text-ink/60 mt-6">
          Nhớ ra rồi?{" "}
          <Link href="/login" className="link">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
