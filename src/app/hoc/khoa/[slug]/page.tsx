import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCourseDetail, getCategories } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { Pagination } from "@/components/Pagination";
import { Chapter } from "@/components/Chapter";
import { CourseReview } from "@/components/CourseReview";
import { LockedCourseButton } from "@/components/LockedCourse";
import { requestEnroll, requestRelearn, startPayment } from "../../khoa-hoc/actions";
import { unlockCourse, unlockLesson } from "../../xu/actions";
import { isMonetized, formatCoins, autoApproves } from "@/lib/coins";
import { formatVnd } from "@/lib/payment";
import type { Lesson } from "@/lib/supabase/types";

const MODULES_PER_PAGE = 4;

type LessonItem = {
  lesson: Lesson;
  done: boolean;
  hasQuiz: boolean;
  locked: boolean;
  paywalled: boolean; // chưa mua (ngoài phần học thử, chưa mở bằng xu)
  unlockable: boolean; // chưa mua nhưng đã tới lượt → hiện nút mở bằng xu
  free: boolean; // thuộc phần học thử miễn phí
  availableOn: string | null; // ngày mở nếu đang khóa theo lịch
};

// YYYY-MM-DD → dd/mm/yyyy.
function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; loi?: string; mo?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { user, profile } = await requireUser();
  // Khách mời không tự yêu cầu học — khóa nào chưa được mở thì hiện ổ khóa.
  const isGuest = profile?.is_guest ?? false;
  const isCoach = profile?.role === "coach";
  const data = await getCourseDetail(slug, user.id, isGuest, isCoach);
  if (!data) notFound();

  const {
    course,
    lessons,
    enrollStatus,
    approved,
    canLearn,
    done,
    total,
    leaderboard,
    balance,
    unlockCost,
    openPayment,
  } = data;
  // Khóa có bán / cho học thử → học viên chưa ghi danh thấy khung mua
  // (xu hoặc chuyển khoản) thay vì chỉ nút "Yêu cầu học".
  const monetized = isMonetized(course);
  const sellsLessons = course.lesson_coin_price > 0;
  // Khóa tự duyệt: nút "Vào học ngay" thay cho "Yêu cầu học".
  const instant = autoApproves(course);
  const freeCount = lessons.filter((it) => it.free).length;
  const percent = total ? done / total : 0;
  // Học xong toàn bộ khóa → mời đánh giá.
  const courseCompleted = approved && total > 0 && done === total;
  const modInfo = new Map(data.moduleInfo.map((mi) => [mi.id, mi]));
  const categories = await getCategories();
  const ct = categories.find((c) => c.slug === course.category);

  // Gộp bài theo chương (giữ thứ tự chương). Học viên chỉ thấy chương có bài;
  // riêng coach ở bản Xem trước thấy cả chương rỗng để soi khung nội dung.
  const moduleGroups = data.modules
    .map((m) => ({
      module: m,
      lessons: lessons.filter((it) => it.lesson.module_id === m.id),
    }))
    .filter((g) => isCoach || g.lessons.length > 0);
  // Bài không thuộc chương nào — hiện thẳng, không gấp trong accordion.
  const ungrouped = lessons.filter((it) => !it.lesson.module_id);

  // Phân trang: mỗi trang tối đa 4 chương. Bài lẻ chỉ hiện ở trang 1.
  const totalPages = Math.max(
    1,
    Math.ceil(moduleGroups.length / MODULES_PER_PAGE),
  );
  const page = Math.min(totalPages, Math.max(1, Number(sp.page) || 1));
  const from = (page - 1) * MODULES_PER_PAGE;
  const pageGroups = moduleGroups.slice(from, from + MODULES_PER_PAGE);

  // Ô số thứ tự / trạng thái ở đầu mỗi dòng bài.
  const renderLesson = (item: LessonItem, i: number) => {
    const { lesson, done: ldone, hasQuiz, locked, availableOn } = item;
    const lessonLocked = locked;
    // Bài kế tiếp chưa mua → nút mở bằng xu ngay trên dòng bài.
    const showUnlock =
      !isGuest && !approved && sellsLessons && item.unlockable;
    const short = balance < course.lesson_coin_price;
    const row = (
      <Card
        className={`px-4 py-3.5 flex items-start gap-3 sm:items-center sm:gap-4 ${
          lessonLocked ? "opacity-70" : "hover:border-ink/25 transition-colors"
        }`}
      >
        <span
          className={`grid place-items-center w-8 h-8 rounded-full text-sm font-mono shrink-0 ${
            ldone ? "bg-herb text-paper" : "bg-paper-2 text-ink/50"
          }`}
        >
          {lessonLocked ? "🔒" : ldone ? "✓" : i + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium line-clamp-2">{lesson.title}</div>
          {availableOn ? (
            <div className="text-xs text-amber mt-0.5">
              🔒 Mở ngày {fmtDate(availableOn)}
            </div>
          ) : item.free && !ldone ? (
            <div className="text-xs text-herb mt-0.5">🎁 Học thử miễn phí</div>
          ) : (
            <div className="text-xs text-ink/50 mt-0.5 line-clamp-2">
              {lesson.summary}
            </div>
          )}
          {/* Điện thoại: thông tin phụ nằm dưới tiêu đề cho khỏi bóp chữ */}
          <div className="flex items-center gap-2 mt-1.5 sm:hidden">
            {lesson.video_url && <span title="Có video">🎥</span>}
            {lesson.pdf_url && <span title="Có tài liệu PDF">📄</span>}
            {hasQuiz && <Badge accent="slate">quiz</Badge>}
            <span className="font-mono text-xs text-ink/40 tnum">
              {lesson.est_minutes}′
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {lesson.video_url && <span title="Có video">🎥</span>}
          {lesson.pdf_url && <span title="Có tài liệu PDF">📄</span>}
          {hasQuiz && <Badge accent="slate">quiz</Badge>}
          <span className="font-mono text-xs text-ink/40 tnum">
            {lesson.est_minutes}′
          </span>
        </div>
        {showUnlock && (
          <form action={unlockLesson} className="shrink-0 self-center">
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <input type="hidden" name="course_slug" value={course.slug} />
            <input type="hidden" name="lesson_slug" value={lesson.slug} />
            <button
              type="submit"
              disabled={short}
              title={
                short
                  ? "Chưa đủ xu — làm nhiệm vụ hoặc nạp thêm ở trang Xu"
                  : undefined
              }
              className={buttonClass("primary", "!px-3 !py-1.5 text-xs")}
            >
              🪙 Mở · {course.lesson_coin_price}
            </button>
          </form>
        )}
      </Card>
    );
    return (
      <li key={lesson.id}>
        {!lessonLocked ? (
          <Link
            href={`/hoc/khoa/${course.slug}/${lesson.slug}`}
            className="block"
          >
            {row}
          </Link>
        ) : (
          row
        )}
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <Link href="/hoc/khoa-hoc" className="link text-sm">
        ← Tất cả khóa
      </Link>

      {/* Header khóa */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-5">
        <ProgressRing value={percent} accent={course.accent} size={88} stroke={8} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{course.cover_emoji}</span>
            <Badge accent={ct?.accent ?? "amber"}>
              {ct?.label ?? "Khóa học"}
            </Badge>
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl mt-1 break-words">
            {course.title}
          </h1>
          <p className="text-ink/60 mt-2 max-w-xl">{course.summary}</p>
          {approved && (
            <p className="font-mono text-xs text-ink/50 mt-2 tnum">
              {done}/{total} bài · {Math.round(percent * 100)}% hoàn thành
            </p>
          )}
        </div>
        {isGuest && !approved ? (
          <LockedCourseButton full={false} label="Chưa mở" />
        ) : enrollStatus === "pending" ? (
          <Badge accent="slate">⏳ Đang chờ duyệt</Badge>
        ) : enrollStatus === "failed" ? (
          <form action={requestRelearn}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="slug" value={course.slug} />
            <button className={buttonClass("primary", "w-full sm:w-auto")}>
              Yêu cầu học lại
            </button>
          </form>
        ) : !approved && !monetized ? (
          <form action={requestEnroll}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="slug" value={course.slug} />
            <button className={buttonClass("primary", "w-full sm:w-auto")}>
              {instant ? "Vào học ngay" : "Yêu cầu học"}
            </button>
          </form>
        ) : null}
      </header>

      {/* Khóa riêng tư: coach đang tự học */}
      {isCoach && course.private && (
        <Card className="p-4 bg-slate-soft flex items-start gap-3">
          <span className="text-lg shrink-0">🔒</span>
          <p className="text-sm text-ink/70">
            <span className="font-medium">Khóa riêng tư — bạn đang tự học.</span>{" "}
            Học viên không thấy khóa này trong danh mục; chỉ ai bạn phân khóa
            mới vào được.
          </p>
        </Card>
      )}

      {/* Bản xem trước của coach — giải thích vì sao coach thấy toàn bộ */}
      {isCoach && !course.private && (
        <Card className="p-4 bg-slate-soft flex items-start gap-3">
          <span className="text-lg shrink-0">🔍</span>
          <p className="text-sm text-ink/70">
            <span className="font-medium">Bản xem trước (coach).</span> Bạn đang
            thấy <b>toàn bộ</b> nội dung khóa. Học viên được phân công riêng sẽ
            chỉ thấy những chương/bài bạn mở cho họ ở mục{" "}
            <b>“Phân chương / bài học”</b> trong trang học viên.
          </p>
        </Card>
      )}

      {/* Học viên đang bị giới hạn nội dung — giải thích vì sao thấy ít chương */}
      {!isCoach && data.restricted && data.totalChapters > 0 && (
        <Card className="p-4 bg-amber-soft flex items-start gap-3">
          <span className="text-lg shrink-0">📌</span>
          <p className="text-sm text-ink/70">
            Coach đang mở riêng một phần khóa cho bạn — bạn thấy{" "}
            <b>
              {data.visibleChapters}/{data.totalChapters} chương
            </b>
            {data.hiddenLessonCount > 0 && (
              <> ({data.hiddenLessonCount} bài chưa mở)</>
            )}
            . Các phần còn lại sẽ hiện khi coach phân công thêm.
          </p>
        </Card>
      )}

      {sp.loi && (
        <Card className="p-4 border-clay/30 bg-clay-soft text-sm text-clay">
          ⚠ {sp.loi}
        </Card>
      )}
      {sp.mo && approved && (
        <Card className="p-4 bg-herb-soft text-sm text-herb font-medium">
          🎉 Đã mở cả khóa — học thôi!
        </Card>
      )}

      {/* Khung mua: học thử + mở bằng xu + chuyển khoản */}
      {!approved && !isGuest && monetized && enrollStatus !== "failed" && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl">Mở khóa học</h2>
            <Link href="/hoc/xu" className="text-sm font-mono tnum link">
              🪙 Bạn có {balance.toLocaleString("vi-VN")} xu
            </Link>
          </div>
          {freeCount > 0 && (
            <p className="text-sm text-ink/70">
              🎁 <b>{freeCount} bài đầu</b> học thử miễn phí — bắt đầu ngay ở
              danh sách bên dưới.
            </p>
          )}
          {sellsLessons && (
            <p className="text-sm text-ink/70">
              🔓 Mở lẻ từng bài: <b>{formatCoins(course.lesson_coin_price)}</b>{" "}
              / bài. Bấm “Mở” ở bài tiếp theo.
            </p>
          )}
          {/* Chỉ MỘT nút chính: việc học viên làm được ngay. Đủ xu → mở bằng
              xu; chưa đủ (hoặc khóa không bán bằng xu) → chuyển khoản. Cách
              còn lại thu về một dòng chữ nhỏ bên dưới. */}
          {(() => {
            const sellsCoin = course.course_coin_price > 0;
            const sellsCash = course.price > 0;
            const coinPrimary =
              sellsCoin && (!sellsCash || balance >= unlockCost);

            const coinForm = (
              <form action={unlockCourse}>
                <input type="hidden" name="course_id" value={course.id} />
                <input type="hidden" name="course_slug" value={course.slug} />
                <button
                  type="submit"
                  disabled={balance < unlockCost}
                  className={buttonClass("primary", "w-full")}
                >
                  🪙 Mở cả khóa · {formatCoins(unlockCost)}
                </button>
              </form>
            );

            const cashAction = (primary: boolean) => {
              const cls = primary ? buttonClass("primary", "w-full") : "link";
              if (openPayment)
                return (
                  <Link
                    href={`/hoc/thanh-toan/${openPayment.code}`}
                    className={cls}
                  >
                    {openPayment.status === "matched"
                      ? "⏳ Đã nhận tiền · chờ xác nhận"
                      : primary
                        ? "💳 Tiếp tục thanh toán"
                        : "tiếp tục thanh toán chuyển khoản"}
                  </Link>
                );
              return (
                <form
                  action={startPayment}
                  className={primary ? undefined : "inline"}
                >
                  <input type="hidden" name="course_id" value={course.id} />
                  <button type="submit" className={cls}>
                    {primary
                      ? `💳 Chuyển khoản · ${formatVnd(course.price)}`
                      : `chuyển khoản ${formatVnd(course.price)}`}
                  </button>
                </form>
              );
            };

            if (!sellsCoin && !sellsCash)
              return enrollStatus !== "pending" ? (
                <form action={requestEnroll}>
                  <input type="hidden" name="course_id" value={course.id} />
                  <input type="hidden" name="slug" value={course.slug} />
                  <button className={buttonClass("outline", "w-full")}>
                    {instant ? "Vào học cả khóa" : "Yêu cầu học cả khóa"}
                  </button>
                </form>
              ) : null;

            return (
              <div className="space-y-2">
                {coinPrimary ? coinForm : cashAction(true)}
                {sellsCoin && unlockCost < course.course_coin_price && (
                  <p className="text-xs text-herb">
                    Giá xu đã trừ {course.course_coin_price - unlockCost} xu bạn
                    mở lẻ trước đó.
                  </p>
                )}
                {coinPrimary && sellsCash && (
                  <p className="text-sm text-ink/60">
                    Hoặc {cashAction(false)}.
                  </p>
                )}
                {!coinPrimary && sellsCoin && (
                  <p className="text-sm text-ink/60">
                    Hoặc mở bằng {formatCoins(unlockCost)} — bạn còn thiếu{" "}
                    {unlockCost - balance} xu,{" "}
                    <Link href="/hoc/xu" className="link">
                      làm nhiệm vụ hoặc nạp xu
                    </Link>
                    .
                  </p>
                )}
                {coinPrimary && !sellsCash && balance < unlockCost && (
                  <p className="text-xs text-ink/50">
                    Còn thiếu {unlockCost - balance} xu —{" "}
                    <Link href="/hoc/xu" className="link">
                      làm nhiệm vụ hoặc nạp xu
                    </Link>
                    .
                  </p>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Banner trạng thái khi chưa được học. Khóa có bán mà chưa ghi danh
          thì khung "Mở khóa học" phía trên đã nói đủ. */}
      {!approved && !(monetized && !isGuest && enrollStatus === null) && (
        <Card
          className={`p-5 ${
            enrollStatus === "failed" ? "bg-clay-soft" : "bg-paper-2"
          }`}
        >
          <p className="text-sm text-ink/70">
            {enrollStatus === "pending"
              ? "🔒 Yêu cầu của bạn đang chờ coach duyệt. Khi được duyệt, bạn sẽ vào học được ngay."
              : enrollStatus === "failed"
                ? "🔒 Bạn đã làm sai quiz quá 2 lần nên khóa học này bị khóa. Bấm “Yêu cầu học lại” để coach mở lại — bạn sẽ có 2 lượt làm mới."
                : instant
                  ? "Khóa này miễn phí — bấm “Vào học ngay” để bắt đầu."
                  : "🔒 Bạn chưa được ghi danh. Bấm “Yêu cầu học” để coach duyệt."}
          </p>
        </Card>
      )}

      {/* Học xong khóa → xin ý kiến đánh giá */}
      {courseCompleted && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-herb">
            <span className="text-xl">🎉</span>
            <p className="font-medium">
              Bạn đã hoàn thành toàn bộ khóa học — tuyệt vời!
            </p>
          </div>
          <CourseReview
            courseId={course.id}
            courseSlug={course.slug}
            initial={data.myReview}
          />
        </section>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start [&>*]:min-w-0">
        {/* Danh sách bài học */}
        <div className="space-y-5">
          {total === 0 && (
            <Card className="p-6 text-ink/60">Khóa đang được soạn bài.</Card>
          )}

          {/* Bài lẻ (không thuộc chương) — hiện thẳng, chỉ ở trang 1 */}
          {page === 1 && ungrouped.length > 0 && (
            <ol className="space-y-2.5">
              {ungrouped.map((item, i) => renderLesson(item, i))}
            </ol>
          )}

          {/* Các chương — gấp lại, ấn để mở */}
          {pageGroups.map((g, gi) => {
            const info = modInfo.get(g.module.id);
            const chapterDateLocked = info?.dateLocked ?? false;
            const chapterLocked = (info?.locked ?? false) || chapterDateLocked;
            const chapterUnlockOn = info?.availableOn ?? null;
            const number = from + gi + 1;
            const lessonsDone = g.lessons.filter((it) => it.done).length;
            // Chương rỗng: chỉ coach thấy (bản Xem trước) để soi khung nội dung.
            const isEmpty = g.lessons.length === 0;
            const chapterMeta = (
              <>
                {canLearn &&
                  chapterLocked &&
                  (chapterUnlockOn ? (
                    <span className="text-xs text-amber whitespace-nowrap">
                      🔒 Mở {fmtDate(chapterUnlockOn)}
                    </span>
                  ) : (
                    <span title="Đang khóa">🔒</span>
                  ))}
                {isEmpty ? (
                  <Badge accent="slate">Chưa có bài · xem trước</Badge>
                ) : (
                  <span className="font-mono text-xs text-ink/40 tnum whitespace-nowrap">
                    {lessonsDone}/{g.lessons.length} bài
                  </span>
                )}
              </>
            );
            return (
              <Chapter
                key={g.module.id}
                storageKey={`chapter:${course.slug}:${g.module.id}`}
                className="group rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)] overflow-hidden"
                summary={
                  <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-start gap-2.5 sm:items-center sm:gap-3 px-4 py-3.5 hover:bg-paper-2 transition-colors">
                    <span className="text-ink/40 transition-transform group-open:rotate-90 shrink-0 mt-0.5 sm:mt-0">
                      ▸
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="eyebrow block sm:inline sm:mr-2">
                        Chương {number}
                      </span>
                      <span className="font-medium line-clamp-2 align-middle">
                        {g.module.title}
                      </span>
                      {/* Điện thoại: trạng thái chương nằm dưới tên chương */}
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 sm:hidden">
                        {chapterMeta}
                      </span>
                    </span>
                    <span className="hidden sm:flex items-center gap-3 shrink-0">
                      {chapterMeta}
                    </span>
                  </summary>
                }
              >
                <div className="px-4 pb-4 pt-1 border-t border-ink/10">
                  {isEmpty ? (
                    <p className="text-sm text-ink/50 py-2">
                      Chương này chưa có bài học nào — học viên sẽ không thấy
                      chương cho tới khi bạn thêm bài (ở trang sửa khóa). Chỉ coach
                      thấy chương này trong bản xem trước.
                    </p>
                  ) : (
                    <ol className="space-y-2.5">
                      {g.lessons.map((item, i) => renderLesson(item, i))}
                    </ol>
                  )}

                  {/* Bài kiểm tra chương */}
                  {canLearn && info?.hasQuiz && (
                    <div className="mt-3">
                      {info.quizPassed ? (
                        <Card className="px-4 py-3.5 flex items-center gap-3 bg-herb-soft">
                          <span className="text-xl shrink-0">🏅</span>
                          <span className="font-medium flex-1">
                            Bài kiểm tra chương
                          </span>
                          <Badge accent="herb">✓ Đã đạt</Badge>
                        </Card>
                      ) : info.quizAvailable ? (
                        <Link
                          href={`/hoc/khoa/${course.slug}/chuong/${g.module.id}`}
                          className="block"
                        >
                          <Card className="px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 bg-amber-soft hover:border-ink/25 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="text-xl shrink-0">📝</span>
                              <div className="min-w-0">
                                <div className="font-medium">
                                  Bài kiểm tra chương
                                </div>
                                <div className="text-xs text-ink/55">
                                  Đạt để mở khóa chương kế tiếp
                                </div>
                              </div>
                            </div>
                            <span
                              className={buttonClass(
                                "primary",
                                "w-full sm:w-auto shrink-0",
                              )}
                            >
                              Làm bài →
                            </span>
                          </Card>
                        </Link>
                      ) : (
                        <Card className="px-4 py-3.5 flex items-center gap-3 opacity-70">
                          <span className="text-xl shrink-0">🔒</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">Bài kiểm tra chương</div>
                            <div className="text-xs text-ink/55">
                              {chapterDateLocked
                                ? `Mở ngày ${fmtDate(chapterUnlockOn)}.`
                                : chapterLocked
                                  ? "Hoàn thành chương trước để mở."
                                  : `Học hết các bài trong chương (${info.lessonsDone}/${info.lessonsTotal}) để mở.`}
                            </div>
                          </div>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </Chapter>
            );
          })}

          <Pagination
            basePath={`/hoc/khoa/${course.slug}`}
            page={page}
            totalPages={totalPages}
          />
        </div>

        {/* Bảng xếp hạng tuần (chỉ khi đã được học) */}
        {approved && (
          <aside>
            <Card className="p-5 sticky top-20">
              <div className="flex items-center justify-between">
                <Eyebrow>Đua tuần này</Eyebrow>
                <Badge accent="amber">XP/tuần</Badge>
              </div>
              <p className="text-xs text-ink/50 mt-1 mb-3">
                Chỉ trong khóa này — đủ nhỏ để bạn thắng.
              </p>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-ink/50">
                  Chưa có ai. Học bài để dẫn đầu!
                </p>
              ) : (
                <ol className="space-y-1">
                  {leaderboard.slice(0, 8).map((row) => {
                    const me = row.user_id === user.id;
                    return (
                      <li
                        key={row.user_id}
                        className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 ${
                          me ? "bg-amber-soft" : ""
                        }`}
                      >
                        <span className="font-mono text-xs text-ink/50 w-5 tnum shrink-0">
                          {row.rnk}
                        </span>
                        <span className="flex-1 text-sm truncate">
                          {row.full_name || "Học viên"}
                          {me && <span className="text-amber"> · bạn</span>}
                        </span>
                        <span className="font-mono text-sm font-semibold tnum">
                          {row.xp_week}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}
