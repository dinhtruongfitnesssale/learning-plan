import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCoinCenter } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { COIN_KIND_LABEL, formatCoins } from "@/lib/coins";
import { formatVnd } from "@/lib/payment";
import { CopyButton } from "@/app/hoc/thanh-toan/[code]/PaymentLive";
import { CheckinButton } from "./CoinWidgets";
import { startTopup } from "./actions";

const dt = (s: string) =>
  new Date(s).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

export default async function CoinCenter({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { user, profile } = await requireUser();
  // Khách mời chỉ học khóa được tặng — không có ví xu.
  if (profile?.is_guest) redirect("/hoc");
  const sp = await searchParams;
  const c = await getCoinCenter(user.id);
  const s = c.settings;

  const capPct = s.daily_cap > 0 ? Math.min(1, c.earnedCapped / s.daily_cap) : 1;
  const capFull = c.earnedCapped >= s.daily_cap;
  const streakStep = c.streak % 7;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const refLink = c.referralCode
    ? `${appUrl}/dang-ky?ref=${c.referralCode}`
    : "";

  // Nhiệm vụ lặp lại hằng ngày (xu học bài + quiz tính vào trần ngày).
  const tasks = [
    {
      icon: "📖",
      title: "Học xong 1 bài",
      reward: s.reward_lesson,
      done: c.doneToday.has("lesson"),
      capped: true,
    },
    {
      icon: "✅",
      title: "Đạt quiz của bài học",
      reward: s.reward_quiz,
      done: c.doneToday.has("quiz"),
      capped: true,
    },
    {
      icon: "🏅",
      title: "Đạt bài kiểm tra chương",
      reward: s.reward_module_quiz,
      done: c.doneToday.has("module_quiz"),
      capped: true,
    },
  ].filter((t) => t.reward > 0);

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Ví xu</Eyebrow>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">Xu &amp; nhiệm vụ</h1>
        <p className="text-ink/60 mt-2 max-w-xl">
          Học mỗi ngày để nhận xu, dùng xu mở bài học và khóa học. Muốn học
          nhanh hơn thì nạp thêm xu.
        </p>
      </section>

      {sp.loi && (
        <Card className="p-4 border-clay/30 bg-clay-soft text-sm text-clay">
          ⚠ {sp.loi}
        </Card>
      )}

      {/* Số dư */}
      <Card className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-ink/50">Số dư</div>
          <div className="font-mono text-4xl font-semibold tnum mt-1">
            🪙 {c.balance.toLocaleString("vi-VN")}
            <span className="text-base text-amber ml-1.5">xu</span>
          </div>
        </div>
        <Link href="/hoc/khoa-hoc" className={buttonClass("outline")}>
          Dùng xu mở khóa học →
        </Link>
      </Card>

      {/* Nhiệm vụ hôm nay */}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Nhiệm vụ hôm nay</h2>
        <Card className="p-5 space-y-4">
          {s.daily_cap > 0 && (
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink/70">Xu từ học bài &amp; quiz hôm nay</span>
                <span className="font-mono tnum font-semibold">
                  {c.earnedCapped}/{s.daily_cap}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-paper-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${capFull ? "bg-herb" : "bg-amber"}`}
                  style={{ width: `${capPct * 100}%` }}
                />
              </div>
              <p className="text-xs text-ink/50 mt-1.5">
                {capFull
                  ? "Đã nhận đủ xu học tập hôm nay — vẫn học tiếp được, mai nhận tiếp nhé."
                  : `Mỗi ngày nhận tối đa ${s.daily_cap} xu từ học bài và làm quiz.`}
              </p>
            </div>
          )}

          <ul className="divide-y divide-ink/10">
            {s.reward_checkin > 0 && (
              <TaskRow
                icon="📅"
                title="Điểm danh"
                reward={s.reward_checkin}
                right={
                  c.checkedIn ? (
                    <Badge accent="herb">✓ Đã nhận</Badge>
                  ) : (
                    <CheckinButton reward={s.reward_checkin} />
                  )
                }
              />
            )}
            {tasks.map((t) => (
              <TaskRow
                key={t.title}
                icon={t.icon}
                title={t.title}
                reward={t.reward}
                right={
                  t.done ? (
                    <Badge accent="herb">✓ Đã nhận</Badge>
                  ) : capFull ? (
                    <Badge>Hết lượt hôm nay</Badge>
                  ) : (
                    <Link href="/hoc" className="link text-sm">
                      Đi học →
                    </Link>
                  )
                }
              />
            ))}
            {s.reward_streak7 > 0 && (
              <TaskRow
                icon="🔥"
                title="Giữ chuỗi 7 ngày học liên tiếp"
                reward={s.reward_streak7}
                sub={`Chuỗi hiện tại ${c.streak} ngày · còn ${7 - streakStep} ngày tới mốc`}
                right={
                  <span className="font-mono text-sm tnum text-ink/60">
                    {streakStep}/7
                  </span>
                }
              />
            )}
            {s.reward_review > 0 && (
              <TaskRow
                icon="⭐"
                title="Đánh giá khóa học đã học xong"
                reward={s.reward_review}
                sub="Mỗi khóa 1 lần, sau khi học hết bài"
                right={null}
              />
            )}
          </ul>
        </Card>
      </section>

      {/* Giới thiệu bạn bè */}
      {s.signup_enabled && refLink && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Giới thiệu bạn bè</h2>
          <Card className="p-5 space-y-3">
            <p className="text-sm text-ink/70">
              Gửi link này cho bạn bè. Bạn ấy nhận{" "}
              <b>{formatCoins(s.referral_invitee)}</b> khi tạo tài khoản; bạn
              nhận <b>{formatCoins(s.referral_inviter)}</b> khi bạn ấy học xong
              bài đầu tiên.
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-ink/15 bg-paper-2 px-3 py-2.5 min-w-0">
              <span className="font-mono text-sm truncate flex-1 min-w-0">
                {refLink}
              </span>
              <CopyButton value={refLink} label="Chép link" />
            </div>
            <p className="text-xs text-ink/50">
              Mã của bạn:{" "}
              <span className="font-mono font-semibold text-amber">
                {c.referralCode}
              </span>{" "}
              · Đã mời {c.invited} người
              {s.referral_monthly_limit > 0 &&
                ` · Thưởng tối đa ${s.referral_monthly_limit} lượt/tháng`}
            </p>
          </Card>
        </section>
      )}

      {/* Nạp xu */}
      {c.packs.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Nạp xu</h2>
          <p className="text-sm text-ink/60 -mt-1">
            Chuyển khoản một lần, xu vào ví sau khi coach xác nhận.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {c.packs.map((p) => {
              const open = c.openTopups.find((t) => t.pack_id === p.id);
              return (
                <Card key={p.id} className="p-5 flex flex-col gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm text-ink/60 truncate">{p.name}</div>
                    <div className="font-mono text-2xl font-semibold tnum mt-1">
                      🪙 {(p.coins + p.bonus).toLocaleString("vi-VN")}
                    </div>
                    {p.bonus > 0 && (
                      <Badge accent="herb" className="mt-1">
                        Tặng thêm {p.bonus} xu
                      </Badge>
                    )}
                  </div>
                  <div className="mt-auto">
                    {open ? (
                      <Link
                        href={`/hoc/thanh-toan/${open.code}`}
                        className={buttonClass("outline", "w-full")}
                      >
                        {open.status === "matched"
                          ? "⏳ Đã nhận tiền"
                          : "💳 Tiếp tục thanh toán"}
                      </Link>
                    ) : (
                      <form action={startTopup}>
                        <input type="hidden" name="pack_id" value={p.id} />
                        <button className={buttonClass("primary", "w-full")}>
                          {formatVnd(p.price)}
                        </button>
                      </form>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Lịch sử */}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Lịch sử xu</h2>
        {c.ledger.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink/60">
            Chưa có giao dịch nào. Điểm danh để nhận xu đầu tiên!
          </Card>
        ) : (
          <Card className="divide-y divide-ink/10">
            {c.ledger.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {COIN_KIND_LABEL[r.kind] ?? r.kind}
                  </div>
                  <div className="text-xs text-ink/50 truncate">
                    {r.note && `${r.note} · `}
                    {dt(r.created_at)}
                  </div>
                </div>
                <span
                  className={`font-mono tnum text-sm font-semibold shrink-0 ${
                    r.amount > 0 ? "text-herb" : "text-clay"
                  }`}
                >
                  {r.amount > 0 ? "+" : ""}
                  {r.amount.toLocaleString("vi-VN")}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function TaskRow({
  icon,
  title,
  reward,
  sub,
  right,
}: {
  icon: string;
  title: string;
  reward: number;
  sub?: string;
  right: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-ink/50">
          <span className="font-mono text-amber">+{reward} xu</span>
          {sub && <> · {sub}</>}
        </div>
      </div>
      <div className="shrink-0">{right}</div>
    </li>
  );
}
