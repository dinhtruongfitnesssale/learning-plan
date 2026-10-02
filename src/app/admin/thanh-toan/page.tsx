import { requireCoach } from "@/lib/auth";
import {
  getOpenPayments,
  getUnmatchedTransfers,
  getPaymentSettings,
  getRecentConfirmed,
} from "@/lib/data";
import { sepayApiConfigured } from "@/lib/sepay";
import { AutoConfirmSettings } from "./AutoConfirmSettings";
import { Card, Eyebrow, Badge } from "@/components/ui";
import { UNMATCHED_LABEL, formatVnd } from "@/lib/payment";
import { PaymentActions } from "./PaymentActions";
import { Pagination, paginate } from "@/components/Pagination";

// Mỗi mục phân trang riêng, tham số trang riêng để lật mục này không đổi mục kia.
const CARDS_PER_PAGE = 6;
const ROWS_PER_PAGE = 10;
type PageParams = {
  chot?: string;
  lech?: string;
  gan?: string;
  cho?: string;
};

const dt = (s: string) =>
  new Date(s).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

export default async function PaymentsAdmin({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  await requireCoach();
  const sp = await searchParams;
  const [payments, unmatched, settings, recent] = await Promise.all([
    getOpenPayments(),
    getUnmatchedTransfers(),
    getPaymentSettings(),
    getRecentConfirmed(50),
  ]);
  const apiReady = sepayApiConfigured();
  const webhookReady = Boolean(process.env.PAYMENT_WEBHOOK_SECRET);

  const matched = payments.filter((p) => p.status === "matched");
  const waiting = payments.filter((p) => p.status === "pending");

  const matchedPg = paginate(matched, Number(sp.chot), CARDS_PER_PAGE);
  const unmatchedPg = paginate(unmatched, Number(sp.lech), CARDS_PER_PAGE);
  const recentPg = paginate(recent, Number(sp.gan), ROWS_PER_PAGE);
  const waitingPg = paginate(waiting, Number(sp.cho), CARDS_PER_PAGE);
  // Giữ trang hiện tại của các mục khác khi lật một mục.
  const keep = {
    chot: matchedPg.page > 1 ? String(matchedPg.page) : "",
    lech: unmatchedPg.page > 1 ? String(unmatchedPg.page) : "",
    gan: recentPg.page > 1 ? String(recentPg.page) : "",
    cho: waitingPg.page > 1 ? String(waitingPg.page) : "",
  };
  const pager = (
    param: keyof PageParams,
    pg: { page: number; totalPages: number },
    hash: string,
  ) => (
    <Pagination
      basePath="/admin/thanh-toan"
      page={pg.page}
      totalPages={pg.totalPages}
      params={{ ...keep, [param]: "" }}
      pageParam={param}
      hash={hash}
    />
  );

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Quản trị · Thanh toán</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Thanh toán</h1>
        <p className="text-ink/60 mt-2">
          Tiền về đúng mã, đúng số và dưới trần thì hệ thống tự mở khóa / cộng
          xu và báo về điện thoại bạn. Chỉ ngoại lệ mới nằm lại đây chờ bạn
          chốt.
        </p>
      </section>

      <AutoConfirmSettings
        settings={settings}
        apiReady={apiReady}
        webhookReady={webhookReady}
      />

      <Section
        id="cho-chot"
        title="Đã nhận tiền · chờ bạn chốt"
        count={matched.length}
        empty="Chưa có khoản nào chờ chốt. 🎉"
      >
        {matchedPg.items.map((p) => (
          <PaymentCard key={p.id} pay={p} />
        ))}
        {pager("chot", matchedPg, "cho-chot")}
      </Section>

      {/* Khoản tiền đã về mà không khớp được đơn nào. Đây là mục dễ bỏ sót
          nhất và cũng đắt nhất: có người đã trả tiền mà không được học. */}
      {unmatched.length > 0 && (
        <section id="khong-khop" className="space-y-2.5 scroll-mt-20">
          <h2 className="font-serif text-xl">
            ⚠ Tiền về nhưng không khớp đơn ({unmatched.length})
          </h2>
          <p className="text-sm text-ink/60">
            Học viên gõ sai nội dung, chuyển thiếu, hoặc mã đã hết hạn. Đối
            chiếu rồi mở tay cho họ ở mục dưới.
          </p>
          {unmatchedPg.items.map((e) => (
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
          {pager("lech", unmatchedPg, "khong-khop")}
        </section>
      )}

      {recent.length > 0 && (
        <section id="gan-day" className="space-y-2.5 scroll-mt-20">
          <h2 className="font-serif text-xl">Đã chốt gần đây</h2>
          <Card className="divide-y divide-ink/10">
            {recentPg.items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="shrink-0">{p.coins > 0 ? "🪙" : "📘"}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{p.course_title}</div>
                  <div className="text-xs text-ink/45 truncate">
                    {p.user_email} · {dt(p.confirmed_at)}
                  </div>
                </div>
                <span className="font-mono tnum text-xs shrink-0">
                  {formatVnd(p.amount)}
                </span>
                <Badge accent={p.auto_confirmed ? "herb" : "ink"} className="shrink-0">
                  {p.auto_confirmed ? "Tự động" : "Tay"}
                </Badge>
              </div>
            ))}
          </Card>
          {pager("gan", recentPg, "gan-day")}
        </section>
      )}

      <Section
        id="cho-chuyen-khoan"
        title="Đang chờ chuyển khoản"
        count={waiting.length}
        empty="Không có đơn nào đang chờ."
      >
        {waitingPg.items.map((p) => (
          <PaymentCard key={p.id} pay={p} />
        ))}
        {pager("cho", waitingPg, "cho-chuyen-khoan")}
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  count,
  empty,
  children,
}: {
  id: string;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-2.5 scroll-mt-20">
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
          {pay.coins > 0 ? "🪙" : (pay.course?.cover_emoji ?? "📘")}
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
