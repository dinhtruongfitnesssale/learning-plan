import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCourseLanding, getCategories } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { LockedCourseButton } from "@/components/LockedCourse";
import { requestEnroll, requestRelearn, startPayment } from "../actions";
import { isMonetized, formatCoins, autoApproves } from "@/lib/coins";
import { formatVnd } from "@/lib/payment";
import { coursePrice, discountActive, discountBadge, discountEndsText } from "@/lib/discount";
import type { Lesson } from "@/lib/supabase/types";

// Ô nhiều dòng do coach soạn → danh sách ý (bỏ gạch đầu dòng tự gõ).
function lines(s: string | undefined) {
  return (s ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*+✓✔]\s*/, "").trim())
    .filter(Boolean);
}

function formatDuration(min: number) {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

// Trang giới thiệu khóa học (kiểu Coursera): đọc kỹ khóa — học được gì,
// nội dung từng chương, giảng viên, đánh giá — rồi mới đăng ký / thanh toán.
export default async function CourseLanding({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, profile } = await requireUser();
  const isGuest = profile?.is_guest ?? false;
  const isCoach = profile?.role === "coach";
  const data = await getCourseLanding(slug, user.id, isGuest, isCoach);
  if (!data) notFound();

  const {
    course,
    modules,
    lessons,
    enrollStatus,
    approved,
    unlockCost,
    openPayment,
    learners,
    reviewCount,
    avgRating,
    reviews,
  } = data;
  const categories = await getCategories();
  const ct = categories.find((c) => c.slug === course.category);
  const coursePath = `/hoc/khoa/${course.slug}`;

  const sold = isMonetized(course);
  const sellsCash = course.price > 0;
  const sellsCoin = course.course_coin_price > 0;
  const cashPrice = coursePrice(course);
  const onSale = sellsCash && discountActive(course);
  const freeCount = lessons.filter((it) => it.free).length;
  const totalMinutes = lessons.reduce((s, it) => s + (it.lesson.est_minutes || 0), 0);

  // Nội dung theo chương: bài chưa xếp chương lên đầu.
  const groups: { title: string; items: typeof lessons }[] = [];
  const ungrouped = lessons.filter((it) => !it.lesson.module_id);
  if (ungrouped.length) groups.push({ title: "Mở đầu", items: ungrouped });
  for (const m of modules) {
    const items = lessons.filter((it) => it.lesson.module_id === m.id);
    if (items.length) groups.push({ title: m.title, items });
  }
  const chapterCount = groups.length;

  // "Bạn sẽ học được gì": coach chưa soạn thì dùng tên các chương.
  const outcomes = lines(course.outcomes);
  const learnList = outcomes.length ? outcomes : modules.map((m) => m.title).slice(0, 8);
  const audience = lines(course.audience);
  const intro = (course.intro ?? "").trim();
  const instructor = (course.instructor_name ?? "").trim();
  const instructorBio = (course.instructor_bio ?? "").trim();

  // ── Nút hành động: nút chính + nút phụ (mobile mỗi nút một dòng) ──
  const primaryCls = buttonClass("primary", "sm:min-w-52");
  const secondaryCls = buttonClass("outline");
  const tryLabel =
    freeCount > 0 ? `🎁 Học thử ${freeCount} bài miễn phí` : "Xem các bài học";

  let primary: React.ReactNode;
  let secondary: React.ReactNode = null;
  if (approved) {
    primary = (
      <Link href={coursePath} className={primaryCls}>
        Vào học
      </Link>
    );
  } else if (isGuest) {
    primary = <LockedCourseButton />;
  } else if (enrollStatus === "pending") {
    primary = (
      <button disabled className={buttonClass("outline", "sm:min-w-52")}>
        ⏳ Đang chờ duyệt
      </button>
    );
  } else if (enrollStatus === "failed") {
    primary = (
      <form action={requestRelearn}>
        <input type="hidden" name="course_id" value={course.id} />
        <input type="hidden" name="slug" value={course.slug} />
        <button type="submit" className={primaryCls}>
          🔒 Yêu cầu học lại
        </button>
      </form>
    );
  } else if (sellsCash && openPayment) {
    primary = (
      <Link href={`/hoc/thanh-toan/${openPayment.code}`} className={primaryCls}>
        {openPayment.status === "matched" ? "⏳ Đã nhận tiền" : "💳 Tiếp tục thanh toán"}
      </Link>
    );
    secondary = (
      <Link href={coursePath} className={secondaryCls}>
        {tryLabel}
      </Link>
    );
  } else if (sellsCash) {
    primary = (
      <form action={startPayment}>
        <input type="hidden" name="course_id" value={course.id} />
        <button type="submit" className={primaryCls}>
          💳 Đăng ký · {formatVnd(cashPrice)}
        </button>
      </form>
    );
    secondary = (
      <Link href={coursePath} className={secondaryCls}>
        {tryLabel}
      </Link>
    );
  } else if (sold) {
    // Chỉ bán bằng xu / học thử → mở ở trang khóa (có ví xu).
    primary = (
      <Link href={coursePath} className={primaryCls}>
        {sellsCoin ? `🪙 Mở khóa · ${formatCoins(unlockCost)}` : tryLabel}
      </Link>
    );
    if (sellsCoin && freeCount > 0)
      secondary = (
        <Link href={coursePath} className={secondaryCls}>
          {tryLabel}
        </Link>
      );
  } else {
    primary = (
      <form action={requestEnroll}>
        <input type="hidden" name="course_id" value={course.id} />
        <input type="hidden" name="slug" value={course.slug} />
        <button type="submit" className={primaryCls}>
          {autoApproves(course) ? "Vào học ngay · Miễn phí" : "Yêu cầu học · Miễn phí"}
        </button>
      </form>
    );
  }

  const actions = (
    <div className="btn-row">
      {primary}
      {secondary}
    </div>
  );

  const priceLine = !approved && sellsCash && (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-mono tnum text-2xl font-semibold">{formatVnd(cashPrice)}</span>
      {onSale && (
        <>
          <s className="font-mono tnum text-sm opacity-60">{formatVnd(course.price)}</s>
          <Badge accent="herb">{discountBadge(course)}</Badge>
        </>
      )}
    </div>
  );

  const stats = [
    avgRating != null && {
      value: `★ ${avgRating.toLocaleString("vi-VN")}`,
      label: `${reviewCount} đánh giá`,
    },
    {
      value: `${chapterCount} chương`,
      label: `${lessons.length} bài học`,
    },
    totalMinutes > 0 && {
      value: formatDuration(totalMinutes),
      label: "Tổng thời lượng",
    },
    freeCount > 0 && !approved
      ? { value: `${freeCount} bài`, label: "Học thử miễn phí" }
      : { value: "Tự học", label: "Theo tiến độ của bạn" },
  ].filter(Boolean) as { value: string; label: string }[];

  const nav = [
    learnList.length > 0 && { id: "hoc-duoc-gi", label: "Học được gì" },
    { id: "gioi-thieu", label: "Giới thiệu" },
    { id: "noi-dung", label: "Nội dung" },
    instructor && { id: "giang-vien", label: "Giảng viên" },
    reviews.length > 0 && { id: "danh-gia", label: "Đánh giá" },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <div className="space-y-8 pb-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-ink/55 flex flex-wrap items-center gap-1.5 min-w-0">
        <Link href="/hoc/khoa-hoc" className="link">
          Khóa học
        </Link>
        <span>›</span>
        <span className="truncate">{ct?.label ?? "Khóa học"}</span>
      </nav>

      {/* Hero */}
      <section className="rounded-[var(--radius-card)] border border-ink/10 bg-gradient-to-br from-amber-soft/70 via-paper-2 to-paper p-6 sm:p-10 space-y-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-4xl leading-none">{course.cover_emoji}</span>
          <Badge accent={ct?.accent ?? "amber"}>{ct?.label ?? "Khóa học"}</Badge>
          {course.private && <Badge accent="slate">🔒 Riêng tư</Badge>}
        </div>
        <h1 className="font-serif text-3xl sm:text-5xl leading-tight break-words max-w-3xl">
          {course.title}
        </h1>
        {course.summary && (
          <p className="text-ink/70 text-base sm:text-lg max-w-2xl leading-relaxed">
            {course.summary}
          </p>
        )}
        {instructor && (
          <p className="text-sm text-ink/65">
            Giảng viên: <span className="font-semibold text-ink">{instructor}</span>
          </p>
        )}
        {priceLine}
        {onSale && course.discount_ends_at && (
          <p className="text-xs text-ink/55 -mt-3">
            🏷️ {course.discount_label || "Ưu đãi"} · áp dụng {discountEndsText(course)}
          </p>
        )}
        {actions}
        {learners > 0 && (
          <p className="text-sm text-ink/55">
            <b className="text-ink font-mono tnum">{learners.toLocaleString("vi-VN")}</b>{" "}
            học viên đã đăng ký
          </p>
        )}
      </section>

      {/* Dải số liệu */}
      <Card className="grid grid-cols-2 sm:grid-cols-4 divide-ink/10 [&>*]:p-4 sm:[&>*]:p-5 [&>*:nth-child(odd)]:border-r [&>*:nth-child(n+3)]:border-t sm:[&>*]:border-t-0 sm:[&>*]:border-r sm:[&>*:last-child]:border-r-0 [&>*]:border-ink/10">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className="font-serif text-xl sm:text-2xl truncate">{s.value}</div>
            <div className="text-xs text-ink/55 mt-0.5">{s.label}</div>
          </div>
        ))}
      </Card>

      {/* Mục lục */}
      <nav className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 bg-paper/95 backdrop-blur border-b border-ink/10 flex gap-5 overflow-x-auto text-sm font-medium [scrollbar-width:none]">
        {nav.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className="py-3 whitespace-nowrap text-ink/60 hover:text-ink border-b-2 border-transparent hover:border-amber"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start [&>*]:min-w-0">
        <div className="space-y-10">
          {learnList.length > 0 && (
            <section id="hoc-duoc-gi" className="scroll-mt-32">
              <Card className="p-5 sm:p-6">
                <h2 className="font-serif text-2xl">Bạn sẽ học được gì</h2>
                <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {learnList.map((o, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                      <span className="text-amber shrink-0">✓</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          <section id="gioi-thieu" className="scroll-mt-32 space-y-4">
            <h2 className="font-serif text-2xl">Giới thiệu khóa học</h2>
            {intro ? (
              <Markdown>{intro}</Markdown>
            ) : (
              <p className="text-ink/75 leading-relaxed">
                {course.summary || "Khóa học đang được cập nhật phần giới thiệu."}
              </p>
            )}
            {audience.length > 0 && (
              <div className="rounded-lg bg-paper-2 p-5">
                <h3 className="font-serif text-lg">Khóa học này dành cho</h3>
                <ul className="mt-3 space-y-2">
                  {audience.map((a, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                      <span className="text-herb shrink-0">●</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section id="noi-dung" className="scroll-mt-32 space-y-4">
            <div>
              <h2 className="font-serif text-2xl">Nội dung khóa học</h2>
              <p className="text-sm text-ink/55 mt-1">
                {chapterCount} chương · {lessons.length} bài
                {totalMinutes > 0 && ` · ${formatDuration(totalMinutes)}`}
              </p>
            </div>
            {groups.length === 0 ? (
              <Card className="p-5 text-sm text-ink/60">Nội dung đang được cập nhật.</Card>
            ) : (
              <Card className="divide-y divide-ink/10 overflow-hidden">
                {groups.map((g, gi) => {
                  const min = g.items.reduce((s, it) => s + (it.lesson.est_minutes || 0), 0);
                  return (
                    <details key={gi} open={gi === 0} className="group">
                      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-start gap-3 px-4 sm:px-5 py-4 hover:bg-paper-2 transition-colors">
                        <span className="text-ink/40 transition-transform group-open:rotate-90 shrink-0 mt-0.5">
                          ▸
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="font-medium block break-words">{g.title}</span>
                          <span className="text-xs text-ink/50 font-mono tnum">
                            {g.items.length} bài{min > 0 && ` · ${formatDuration(min)}`}
                          </span>
                        </span>
                      </summary>
                      <ol className="px-4 sm:px-5 pb-4 space-y-1">
                        {g.items.map(({ lesson, free }: { lesson: Lesson; free: boolean }) => (
                          <li
                            key={lesson.id}
                            className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm"
                          >
                            <span className="shrink-0 mt-0.5 text-ink/40">
                              {lesson.video_url ? "▶" : "📄"}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block break-words">{lesson.title}</span>
                              {lesson.summary && (
                                <span className="block text-xs text-ink/50 line-clamp-2 mt-0.5">
                                  {lesson.summary}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 flex flex-col items-end gap-1">
                              {free && <Badge accent="herb">Học thử</Badge>}
                              {lesson.est_minutes > 0 && (
                                <span className="text-xs text-ink/45 font-mono tnum">
                                  {lesson.est_minutes}′
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  );
                })}
              </Card>
            )}
          </section>

          {instructor && (
            <section id="giang-vien" className="scroll-mt-32 space-y-4">
              <h2 className="font-serif text-2xl">Giảng viên</h2>
              <Card className="p-5 sm:p-6 flex flex-col sm:flex-row gap-4">
                <div className="w-14 h-14 rounded-full bg-amber-soft text-amber grid place-items-center font-serif text-2xl shrink-0">
                  {instructor.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-serif text-xl">{instructor}</div>
                  {instructorBio && (
                    <p className="text-sm text-ink/70 mt-2 leading-relaxed whitespace-pre-line">
                      {instructorBio}
                    </p>
                  )}
                </div>
              </Card>
            </section>
          )}

          {reviews.length > 0 && (
            <section id="danh-gia" className="scroll-mt-32 space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-serif text-2xl">Học viên nói gì</h2>
                {avgRating != null && (
                  <span className="text-sm text-ink/60">
                    <span className="text-amber">★</span> {avgRating.toLocaleString("vi-VN")} ·{" "}
                    {reviewCount} đánh giá
                  </span>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {reviews.map((r, i) => (
                  <Card key={i} className="p-5 space-y-2">
                    <div className="text-amber text-sm tracking-wider">
                      {"★".repeat(r.rating)}
                      <span className="text-ink/20">{"★".repeat(5 - r.rating)}</span>
                    </div>
                    <p className="text-sm text-ink/80 leading-relaxed line-clamp-6">
                      “{r.comment}”
                    </p>
                    <p className="text-xs text-ink/50 font-medium">— {r.first_name}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* CTA cuối trang */}
          <Card className="p-6 sm:p-8 space-y-4 bg-amber-soft/40">
            <h2 className="font-serif text-2xl">
              {approved ? "Tiếp tục hành trình của bạn" : "Sẵn sàng bắt đầu?"}
            </h2>
            {priceLine}
            {actions}
          </Card>
        </div>

        {/* Khung đăng ký bám theo khi cuộn (máy tính) */}
        <aside className="hidden lg:block sticky top-32">
          <Card className="p-5 space-y-4">
            <div className="text-4xl">{course.cover_emoji}</div>
            {priceLine}
            <div className="flex flex-col gap-2 [&>*]:w-full [&_button]:w-full [&_a]:w-full [&_form]:w-full">
              {primary}
              {secondary}
            </div>
            <ul className="text-sm text-ink/70 space-y-1.5">
              <li>📚 {chapterCount} chương · {lessons.length} bài</li>
              {totalMinutes > 0 && <li>⏱ {formatDuration(totalMinutes)}</li>}
              {freeCount > 0 && !approved && <li>🎁 {freeCount} bài học thử</li>}
              <li>📱 Học trên điện thoại & máy tính</li>
              {sellsCoin && !approved && <li>🪙 Mở bằng xu: {formatCoins(unlockCost)}</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
