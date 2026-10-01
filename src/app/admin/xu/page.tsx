import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getCoinAdmin } from "@/lib/data";
import { Card, Eyebrow, Badge, Stat, buttonClass } from "@/components/ui";
import { daysToEarn, formatDays, isMonetized, maxDailyEarn } from "@/lib/coins";
import { formatVnd } from "@/lib/payment";
import { CoinSettingsForm, AdjustCoinsForm } from "./CoinForms";
import { createCoinPack } from "../actions";
import { CoinPackRow } from "./CoinPackRow";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export default async function CoinAdmin() {
  await requireCoach();
  const { settings: s, packs, courses, stats } = await getCoinAdmin();
  const perDay = Math.floor(maxDailyEarn(s));
  const sold = courses.filter(({ course }) => isMonetized(course));

  return (
    <div className="space-y-8">
      <section>
        <Eyebrow>Quản trị · Xu</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Xu &amp; nhiệm vụ</h1>
        <p className="text-ink/60 mt-2 max-w-2xl">
          Học viên cày xu bằng cách học, dùng xu mở bài/khóa. Ai muốn nhanh thì
          nạp. Chỉnh mức thưởng ở đây; giá xu và số bài học thử chỉnh trong
          từng khóa.
        </p>
      </section>

      {/* Số liệu 30 ngày */}
      <Card className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat value={stats.circulation.toLocaleString("vi-VN")} label="Xu đang nằm trong ví" />
        <Stat value={stats.earned30.toLocaleString("vi-VN")} label="Xu cày được · 30 ngày" accent="herb" />
        <Stat value={stats.topup30.toLocaleString("vi-VN")} label="Xu nạp · 30 ngày" accent="amber" />
        <Stat value={stats.spent30.toLocaleString("vi-VN")} label="Xu đã tiêu · 30 ngày" />
      </Card>

      {/* Ước tính theo khóa */}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Cày bao lâu thì mở được khóa?</h2>
        <p className="text-sm text-ink/60 -mt-1">
          Với cấu hình hiện tại, người chăm nhất nhận tối đa khoảng{" "}
          <b>{perDay} xu/ngày</b> (trần học tập {s.daily_cap} + điểm danh{" "}
          {s.reward_checkin} + chuỗi 7 ngày chia đều). Số ngày dưới đây là
          nhanh nhất; người học bình thường sẽ lâu hơn.
        </p>
        {sold.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink/60">
            Chưa khóa nào bật học thử / giá xu. Vào{" "}
            <Link href="/admin/khoa-hoc" className="link">
              trang khóa học
            </Link>{" "}
            → mục “Học thử &amp; xu”.
          </Card>
        ) : (
          <Card className="divide-y divide-ink/10">
            {sold.map(({ course: c, lessons }) => {
              const paid = Math.max(0, lessons - c.free_lessons);
              return (
                <Link
                  key={c.id}
                  href={`/admin/khoa-hoc/${c.slug}`}
                  className="flex flex-col gap-2 px-4 py-3.5 hover:bg-paper-2 transition-colors sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl shrink-0">{c.cover_emoji}</span>
                    <div className="min-w-0">
                      <div className="font-medium line-clamp-1">{c.title}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge accent="herb">{c.free_lessons}/{lessons} bài thử</Badge>
                        {c.lesson_coin_price > 0 && (
                          <Badge accent="amber">{c.lesson_coin_price} xu/bài</Badge>
                        )}
                        {c.course_coin_price > 0 && (
                          <Badge accent="amber">{c.course_coin_price} xu cả khóa</Badge>
                        )}
                        {c.price > 0 && <Badge>{formatVnd(c.price)}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-ink/60 sm:text-right sm:shrink-0 space-y-0.5">
                    {c.course_coin_price > 0 && (
                      <div>
                        Cả khóa:{" "}
                        <b className="text-ink">
                          {formatDays(daysToEarn(c.course_coin_price, s))}
                        </b>
                      </div>
                    )}
                    {c.lesson_coin_price > 0 && (
                      <div>
                        Lẻ {paid} bài:{" "}
                        <b className="text-ink">
                          {formatDays(daysToEarn(paid * c.lesson_coin_price, s))}
                        </b>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </section>

      {/* Cấu hình thưởng */}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Mức thưởng</h2>
        <Card className="p-5">
          <CoinSettingsForm s={s} />
        </Card>
      </section>

      {/* Gói nạp */}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Gói nạp xu</h2>
        <p className="text-sm text-ink/60 -mt-1">
          Học viên chuyển khoản như mua khóa; bạn chốt ở{" "}
          <Link href="/admin/thanh-toan" className="link">
            Thanh toán
          </Link>{" "}
          là xu vào ví.
        </p>
        {packs.length > 0 && (
          <Card className="divide-y divide-ink/10">
            {packs.map((p) => (
              <CoinPackRow key={p.id} pack={p} />
            ))}
          </Card>
        )}
        <Card className="p-5">
          <form action={createCoinPack} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
            <label className="block col-span-2 min-w-0">
              <span className="text-sm text-ink/70">Tên gói</span>
              <input name="name" required placeholder="Gói cơ bản" className={inputCls} />
            </label>
            <label className="block min-w-0">
              <span className="text-sm text-ink/70">Giá (VND)</span>
              <input name="price" type="number" min={1000} step={1000} required className={inputCls} />
            </label>
            <label className="block min-w-0">
              <span className="text-sm text-ink/70">Xu</span>
              <input name="coins" type="number" min={1} required className={inputCls} />
            </label>
            <label className="block min-w-0">
              <span className="text-sm text-ink/70">Tặng thêm</span>
              <input name="bonus" type="number" min={0} defaultValue={0} className={inputCls} />
            </label>
            <input type="hidden" name="sort_order" value={packs.length} />
            <button className={buttonClass("primary", "col-span-2 sm:col-span-5 sm:justify-self-start")}>
              Thêm gói
            </button>
          </form>
        </Card>
      </section>

      {/* Điều chỉnh tay */}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Tặng / trừ xu</h2>
        <Card className="p-5">
          <AdjustCoinsForm />
        </Card>
        <p className="text-xs text-ink/45">
          {stats.wallets} học viên đã có ví · {stats.referred} tài khoản đến từ
          link giới thiệu.
        </p>
      </section>
    </div>
  );
}
