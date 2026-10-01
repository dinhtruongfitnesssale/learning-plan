import { requireCoach } from "@/lib/auth";
import { getOpenPayments, getUnmatchedTransfers } from "@/lib/data";
import { Card, Eyebrow, Badge } from "@/components/ui";
import { UNMATCHED_LABEL, formatVnd } from "@/lib/payment";
import { PaymentActions } from "./PaymentActions";

const dt = (s: string) =>
  new Date(s).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

export default async function PaymentsAdmin() {
  await requireCoach();
  const [payments, unmatched] = await Promise.all([
    getOpenPayments(),
    getUnmatchedTransfers(),
  ]);

  const matched = payments.filter((p) => p.status === "matched");
  const waiting = payments.filter((p) => p.status === "pending");

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Quản trị · Thanh toán</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Thanh toán</h1>
        <p className="text-ink/60 mt-2">
          Tiền về đúng mã thì hệ thống tự khớp; bạn bấm chốt là khóa học mở và
          học viên nhận email.
        </p>
      </section>

      <Section
        title="Đã nhận tiền · chờ bạn chốt"
        count={matched.length}
        empty="Chưa có khoản nào chờ chốt. 🎉"
      >
        {matched.map((p) => (
          <PaymentCard key={p.id} pay={p} />
        ))}
      </Section>

      {/* Khoản tiền đã về mà không khớp được đơn nào. Đây là mục dễ bỏ sót
          nhất và cũng đắt nhất: có người đã trả tiền mà không được học. */}
      {unmatched.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-serif text-xl">
            ⚠ Tiền về nhưng không khớp đơn ({unmatched.length})
          </h2>
          <p className="text-sm text-ink/60">
            Học viên gõ sai nội dung, chuyển thiếu, hoặc mã đã hết hạn. Đối
            chiếu rồi mở tay cho họ ở mục dưới.
          </p>
          {unmatched.map((e) => (
            <Card key={e.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono tnum font-semibold">
                  {formatVnd(e.amount)}
                </span>
                <Badge accent="clay">
                  {UNMATCHED_LABEL[e.result] ?? e.result}
                </Badge>
              </div>
              <p className="text-ink/60 mt-1.5 break-words">
                {e.content || "(không có nội dung)"}
              </p>
              <p className="text-xs text-ink/40 mt-1 font-mono">
                {dt(e.created_at)} · {e.provider_ref}
              </p>
            </Card>
          ))}
        </section>
      )}

      <Section
        title="Đang chờ chuyển khoản"
        count={waiting.length}
        empty="Không có đơn nào đang chờ."
      >
        {waiting.map((p) => (
          <PaymentCard key={p.id} pay={p} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="font-serif text-xl">
        {title} {count > 0 && `(${count})`}
      </h2>
      {count === 0 ? (
        <Card className="p-6 text-center text-ink/60 text-sm">{empty}</Card>
      ) : (
        children
      )}
    </section>
  );
}

type Row = Awaited<ReturnType<typeof getOpenPayments>>[number];

function PaymentCard({ pay }: { pay: Row }) {
  const matched = pay.status === "matched";
  // Chuyển thừa/thiếu so với giá khóa — phải đập vào mắt, đừng giấu.
  const off =
    pay.bank_amount !== null && pay.bank_amount !== pay.amount
      ? pay.bank_amount - pay.amount
      : 0;

  return (
    <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="text-2xl leading-none shrink-0">
          {pay.course?.cover_emoji ?? "📘"}
        </span>
        <div className="min-w-0">
          <div className="font-medium line-clamp-2">
            {pay.learner?.full_name || "(chưa đặt tên)"}
          </div>
          <div className="text-xs text-ink/45 truncate">{pay.user_email}</div>
          <div className="text-sm text-ink/60 mt-0.5 line-clamp-2">
            {pay.course_title}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
            <span className="font-mono tnum font-semibold text-ink">
              {formatVnd(pay.amount)}
            </span>
            <span className="font-mono text-amber">{pay.code}</span>
            <span className="text-ink/40 font-mono">
              {dt(matched ? (pay.matched_at ?? pay.created_at) : pay.created_at)}
            </span>
            {off !== 0 && (
              <span className="text-clay font-medium">
                {off > 0 ? "thừa " : "thiếu "}
                {formatVnd(Math.abs(off))}
              </span>
            )}
          </div>
        </div>
      </div>
      <PaymentActions paymentId={pay.id} matched={matched} />
    </Card>
  );
}
