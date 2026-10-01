import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCatalog, getCategories } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { CourseFilter } from "@/components/CourseFilter";
import { LockedCourseButton } from "@/components/LockedCourse";
import { Pagination } from "@/components/Pagination";
import { formatVnd } from "@/lib/payment";
import { isMonetized } from "@/lib/coins";
import { requestEnroll, requestRelearn } from "./actions";

export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; page?: string; loi?: string }>;
}) {
  const { user, profile } = await requireUser();
  // Khách mời (được tặng khóa): thấy đủ danh mục nhưng không tự yêu cầu học.
  const isGuest = profile?.is_guest ?? false;
  const isCoach = profile?.role === "coach";
  const sp = await searchParams;
  const q = sp.q ?? "";
  const cat = sp.cat ?? "";
  const page = Number(sp.page) || 1;
  const [{ items, page: cur, totalPages, total }, categories] =
    await Promise.all([getCatalog(user.id, { q, cat, page }), getCategories()]);
  const catMap = new Map(categories.map((c) => [c.slug, c]));

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Khóa học</Eyebrow>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">
          Chọn khóa bạn muốn học
        </h1>
        <p className="text-ink/60 mt-2 max-w-lg">
          {isGuest
            ? "Bạn học được những khóa admin đã mở cho bạn. Muốn học thêm khóa khác, nhắn admin để được mở."
            : "Gửi yêu cầu học, coach duyệt là bạn vào học được ngay."}
        </p>
      </section>

      {/* startPayment không tạo được đơn thì chuyển về đây kèm lý do. */}
      {sp.loi && (
        <Card className="p-4 border-clay/30 bg-clay-soft text-sm text-clay">
          ⚠ {sp.loi}
        </Card>
      )}

      <CourseFilter
        basePath="/hoc/khoa-hoc"
        q={q}
        cat={cat}
        categories={categories}
      />

      {items.length === 0 ? (
        <Card className="p-8 text-center text-ink/60">
          Không có khóa nào khớp bộ lọc.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ course, status: enrolled, payment }) => {
            // Coach tự học khóa riêng tư: vào thẳng, không cần ghi danh.
            const status =
              isCoach && course.private ? ("approved" as const) : enrolled;
            const ct = catMap.get(course.category);
            // Khóa có bán / cho học thử → vào trang khóa để học thử và chọn
            // cách mở (xu hoặc chuyển khoản), thay vì "Yêu cầu học".
            const sold = isMonetized(course);
            return (
            <Card key={course.id} className="p-6 flex flex-col min-w-0">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="text-3xl leading-none shrink-0">
                  {course.cover_emoji}
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 min-w-0">
                  {course.private && (
                    <Badge accent="slate" className="shrink-0">
                      🔒 Riêng tư
                    </Badge>
                  )}
                  <Badge accent={ct?.accent ?? "amber"} className="min-w-0">
                    {ct?.label ?? "Khóa học"}
                  </Badge>
                </div>
              </div>
              <h3
                className="font-serif text-xl mt-3 line-clamp-2 break-words"
                title={course.title}
              >
                {course.title}
              </h3>
              <p className="text-sm text-ink/60 mt-1.5 flex-1 leading-relaxed">
                {course.summary}
              </p>
              {sold && status !== "approved" && !isGuest && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {course.free_lessons > 0 && (
                    <Badge accent="herb">🎁 {course.free_lessons} bài học thử</Badge>
                  )}
                  {course.course_coin_price > 0 && (
                    <Badge accent="amber">🪙 {course.course_coin_price} xu</Badge>
                  )}
                  {course.price > 0 && (
                    <span className="font-mono tnum text-sm font-semibold text-ink">
                      {formatVnd(course.price)}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-5">
                {status === "approved" ? (
                  <Link
                    href={`/hoc/khoa/${course.slug}`}
                    className={buttonClass("primary", "w-full")}
                  >
                    Vào học
                  </Link>
                ) : isGuest ? (
                  <LockedCourseButton />
                ) : status === "pending" ? (
                  <button
                    disabled
                    className={buttonClass("outline", "w-full")}
                    title="Đang chờ coach duyệt"
                  >
                    ⏳ Đang chờ duyệt
                  </button>
                ) : status === "failed" ? (
                  <form action={requestRelearn}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="slug" value={course.slug} />
                    <button type="submit" className={buttonClass("primary", "w-full")}>
                      🔒 Yêu cầu học lại
                    </button>
                  </form>
                ) : payment ? (
                  // Đã có đơn đang mở → quay lại đúng đơn đó, không sinh mã mới.
                  <Link
                    href={`/hoc/thanh-toan/${payment.code}`}
                    className={buttonClass("outline", "w-full")}
                  >
                    {payment.status === "matched"
                      ? "⏳ Đã nhận tiền"
                      : "💳 Tiếp tục thanh toán"}
                  </Link>
                ) : sold ? (
                  <Link
                    href={`/hoc/khoa/${course.slug}`}
                    className={buttonClass("primary", "w-full")}
                  >
                    {course.free_lessons > 0 ? "🎁 Học thử miễn phí" : "Xem & đăng ký"}
                  </Link>
                ) : (
                  <form action={requestEnroll}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="slug" value={course.slug} />
                    <button type="submit" className={buttonClass("primary", "w-full")}>
                      Yêu cầu học
                    </button>
                  </form>
                )}
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <Pagination
        basePath="/hoc/khoa-hoc"
        page={cur}
        totalPages={totalPages}
        params={{ q, cat }}
      />
      <p className="text-center text-xs text-ink/40 font-mono tnum">
        {total} khóa
      </p>
    </div>
  );
}
