import { requireUser } from "@/lib/auth";
import { Card, Eyebrow } from "@/components/ui";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePassword() {
  const { profile } = await requireUser();

  return (
    <div className="max-w-xl space-y-6">
      <section>
        <Eyebrow>Tài khoản</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Đổi mật khẩu</h1>
        <p className="text-ink/60 mt-2">
          Đặt mật khẩu mới cho tài khoản{" "}
          <span className="font-medium text-ink">{profile?.email}</span>.
        </p>
      </section>

      <Card className="p-6">
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
