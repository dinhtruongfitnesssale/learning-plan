import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPaymentByCode } from "@/lib/data";
import { Card, Eyebrow, buttonClass } from "@/components/ui";
import {
  BANK,
  PAYMENT_LABEL,
  bankConfigured,
  formatVnd,
  vietQrUrl,
} from "@/lib/payment";
import { PaymentPoll, CopyButton } from "./PaymentLive";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireUser();
  const { code } = await params;
  const pay = await getPaymentByCode(code);
  // RLS chỉ trả đơn của chính học viên (hoặc mọi đơn nếu là coach), nên
  // "không thấy" và "không phải của bạn" ra cùng một kết quả — đúng ý.
  if (!pay) notFound();

  const open = pay.status === "pending" || pay.status === "matched";

  return (
    <div className="max-w-md mx-auto space-y-5">
      <PaymentPoll active={open} />

      <section>
        <Eyebrow>Thanh toán</Eyebrow>
        <h1 className="font-serif text-2xl sm:text-3xl mt-2 flex items-start gap-2">
          <span className="shrink-0">{pay.course?.cover_emoji ?? "📘"}</span>
          <span className="min-w-0 break-words">{pay.course_title}</span>
        </h1>
      </section>

      {pay.status === "confirmed" ? (
        <Card className="p-6 text-center space-y-4">
          <p className="text-4xl leading-none">🎉</p>
          <p className="font-medium">Đã nhận học phí, khóa học đã mở.</p>
          {pay.course && (
            <Link
              href={`/hoc/khoa/${pay.course.slug}`}
              className={buttonClass("primary", "w-full")}
            >
              Vào học
            </Link>
          )}
        </Card>
      ) : !open ? (
        <Card className="p-6 text-center space-y-4">
          <p className="text-ink/70">
            Đơn này {PAYMENT_LABEL[pay.status]?.toLowerCase()}.
            {pay.note && (
              <>
                <br />
                <span className="text-sm text-ink/55">Lý do: {pay.note}</span>
              </>
            )}
          </p>
          <Link
            href="/hoc/khoa-hoc"
            className={buttonClass("outline", "w-full")}
          >
            Về danh mục khóa học
          </Link>
        </Card>
      ) : (
        <>
          <Card className="p-6 space-y-5">
            <div className="text-center">
              <p className="text-xs text-ink/50">Số tiền cần chuyển</p>
              <p className="font-mono tnum text-3xl font-semibold mt-1">
                {formatVnd(pay.amount)}
              </p>
            </div>

            {bankConfigured() ? (
              <div className="flex justify-center">
                <Image
                  src={vietQrUrl({ amount: pay.amount, code: pay.code })}
                  alt={`Mã QR chuyển khoản ${formatVnd(pay.amount)}`}
                  width={270}
                  height={320}
                  unoptimized
                  className="rounded-lg border border-ink/10"
                />
              </div>
            ) : (
              <p className="rounded-lg bg-clay-soft p-3 text-sm text-clay">
                ⚠ Chưa cấu hình tài khoản nhận tiền (BANK_ID / BANK_ACCOUNT).
                Nhắn admin nhé.
              </p>
            )}

            {/* Quét QR là điền sẵn hết. Bảng dưới dành cho ai chuyển khoản
                tay hoặc dùng app không quét được. */}
            <dl className="space-y-2 text-sm">
              <Row label="Ngân hàng" value={BANK.id || "—"} />
              <Row label="Số tài khoản" value={BANK.account || "—"} copy />
              <Row label="Chủ tài khoản" value={BANK.owner || "—"} />
              <Row label="Nội dung CK" value={pay.code} copy highlight />
            </dl>
          </Card>

          <Card className="p-5 space-y-3 text-sm text-ink/70">
            <p className="font-medium text-ink">
              {pay.status === "matched"
                ? "⏳ Đã nhận được tiền"
                : "Cách thanh toán"}
            </p>
            {pay.status === "matched" ? (
              <p>
                Hệ thống đã khớp khoản chuyển khoản của bạn. Coach sẽ xác nhận
                và mở khóa học, thường trong vài giờ. Bạn nhận được email khi
                khóa mở — không cần chuyển thêm lần nữa.
              </p>
            ) : (
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Quét mã QR bằng app ngân hàng, hoặc chuyển khoản tay.</li>
                <li>
                  Nội dung chuyển khoản phải có đúng mã{" "}
                  <span className="font-mono font-semibold text-ink">
                    {pay.code}
                  </span>
                  . Sai mã thì hệ thống không tự nhận ra được.
                </li>
                <li>Trang này tự cập nhật khi tiền về, không cần tải lại.</li>
              </ol>
            )}
            <p className="text-xs text-ink/45">
              Mã có hiệu lực tới{" "}
              {new Date(pay.expires_at).toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              })}
              . Chuyển khoản gặp trục trặc thì nhắn admin kèm mã này.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  copy = false,
  highlight = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-ink/55 shrink-0">{label}</dt>
      <dd className="flex items-center gap-2 min-w-0">
        <span
          className={`font-mono truncate ${highlight ? "font-semibold text-amber" : "text-ink"}`}
        >
          {value}
        </span>
        {copy && <CopyButton value={value} />}
      </dd>
    </div>
  );
}
