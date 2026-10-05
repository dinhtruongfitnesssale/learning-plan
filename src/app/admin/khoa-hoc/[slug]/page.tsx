import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getCoinSettings } from "@/lib/data";
import { daysToEarn, formatDays, autoApproves } from "@/lib/coins";
import { courseVisibility, VISIBILITY, type CourseVisibility } from "@/lib/course-status";
import { cn } from "@/lib/cn";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { Pagination } from "@/components/Pagination";
import { Chapter } from "@/components/Chapter";
import { BulkAssign } from "./BulkAssign";
import { SaveForm } from "@/components/SaveForm";
import { InviteByEmail } from "./InviteByEmail";
import { PricingPresets } from "./PricingPresets";
import {
  updateCourse,
  setCourseVisibility,
  deleteCourse,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
} from "../../actions";
import type { Course, Lesson, Module } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

const MODULES_PER_PAGE = 4;

// YYYY-MM-DD → dd/mm/yyyy (để trống nếu chưa đặt lịch).
function fmtDate(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default async function CourseEditor({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!course) notFound();
  const c = course as Course;
  const vis = courseVisibility(c);

  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase
      .from("modules")
      .select("*")
      .eq("course_id", c.id)
      .order("sort_order")
      .order("id"),
    supabase
      .from("lessons")
      .select("*")
      .eq("course_id", c.id)
      .order("sort_order")
      .order("id"),
  ]);
  const mods = (modules as Module[]) ?? [];
  const lessonList = (lessons as Lesson[]) ?? [];

  // Học viên + trạng thái ghi danh khóa này (để phân khóa hàng loạt).
  const [categories, { data: profiles }, { data: courseEnr }, coinCfg] =
    await Promise.all([
      getCategories(),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "learner")
        .order("full_name", { ascending: true }),
      supabase
        .from("enrollments")
        .select("user_id, status")
        .eq("course_id", c.id),
      getCoinSettings(),
    ]);
  // Ước tính cho coach: người cày (chạm trần mỗi ngày) cần bao lâu.
  const publishedCount = lessonList.filter((l) => l.published).length;
  const paidLessons = Math.max(0, publishedCount - c.free_lessons);
  const daysCourse = daysToEarn(c.course_coin_price, coinCfg);
  const daysAllLessons = daysToEarn(paidLessons * c.lesson_coin_price, coinCfg);
  const statusByUser = new Map(
    (courseEnr ?? []).map((e) => [e.user_id, e.status as "pending" | "approved"]),
  );
  const learnersForAssign = (
    (profiles as { id: string; full_name: string | null; email: string | null }[]) ??
    []
  ).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? "",
    email: p.email ?? "",
    status: statusByUser.get(p.id) ?? ("none" as const),
  }));

  // Gộp bài theo chương (giữ cả chương chưa có bài để coach thấy).
  const moduleGroups = mods.map((m) => ({
    module: m,
    lessons: lessonList.filter((l) => l.module_id === m.id),
  }));
  // Bài chưa xếp chương — hiện thẳng, không gấp.
  const ungrouped = lessonList.filter((l) => !l.module_id);

  // Phân trang: mỗi trang tối đa 4 chương. Bài chưa xếp chương chỉ hiện ở trang 1.
  const totalPages = Math.max(
    1,
    Math.ceil(moduleGroups.length / MODULES_PER_PAGE),
  );
  const page = Math.min(totalPages, Math.max(1, Number(sp.page) || 1));
  const from = (page - 1) * MODULES_PER_PAGE;
  const pageGroups = moduleGroups.slice(from, from + MODULES_PER_PAGE);

  const lessonRow = (l: Lesson, i: number) => (
    <li key={l.id}>
      <Link
        href={`/admin/khoa-hoc/${c.slug}/bai/${l.slug}`}
        className="block"
      >
        <Card className="px-4 py-3 flex items-start gap-3 hover:border-ink/25 transition-colors">
          <span className="font-mono text-sm text-ink/40 w-5 tnum shrink-0">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-medium line-clamp-2">{l.title}</div>
            <div className="text-xs text-ink/45 font-mono">
              {l.xp_reward} XP
              {l.available_on && <span> · 📅 mở {fmtDate(l.available_on)}</span>}
            </div>
          </div>
          {!l.published && (
            <Badge accent="ink" className="shrink-0">
              ẩn
            </Badge>
          )}
        </Card>
      </Link>
    </li>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/khoa-hoc" className="link text-sm">
            ← Tất cả khóa
          </Link>
          <Link href={`/hoc/khoa/${c.slug}`} className="link text-sm">
            {vis === "private" ? "Vào tự học →" : "Xem trước →"}
          </Link>
        </div>
        {/* Trạng thái khóa: căn giữa, tách hẳn khỏi dòng link phía trên. */}
        <div className="flex justify-center pt-1">
          <div
            role="group"
            aria-label="Trạng thái khóa"
            className="flex w-full sm:w-auto items-center justify-between gap-1 rounded-full border border-ink/15 bg-paper p-1"
          >
            {(["draft", "private", "public"] as CourseVisibility[]).map((m) => (
              <form key={m} action={setCourseVisibility} className="flex">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="slug" value={c.slug} />
                <input type="hidden" name="mode" value={m} />
                <button
                  type="submit"
                  title={VISIBILITY[m].hint}
                  aria-pressed={vis === m}
                  className={cn(
                    "flex flex-none items-center justify-center gap-1 rounded-full whitespace-nowrap leading-none transition-colors",
                    // Mỗi ô rộng THEO CHỮ của nó (không chia đều): chỗ trống
                    // dồn vào khoảng giữa các ô, nên ô đen không sát chữ ô
                    // bên cạnh — nhất là "Công khai", chữ dài nhất.
                    "px-3.5 py-2.5 text-[13px] sm:px-4 sm:py-2 sm:text-sm",
                    vis === m
                      ? "bg-ink text-paper font-semibold shadow-sm"
                      : "text-ink/65 hover:bg-paper-2 hover:text-ink",
                  )}
                >
                  {VISIBILITY[m].icon && (
                    // Máy rất hẹp (<360px) bỏ icon cho chữ khỏi chật.
                    <span className="text-[11px] hidden min-[360px]:inline">
                      {VISIBILITY[m].icon}
                    </span>
                  )}
                  {VISIBILITY[m].name}
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>

      <section className="flex items-start gap-3">
        <span className="text-3xl leading-none shrink-0">{c.cover_emoji}</span>
        <div className="min-w-0 flex-1">
          <Eyebrow>Sửa khóa học</Eyebrow>
          <h1 className="font-serif text-2xl sm:text-3xl break-words">
            {c.title}
          </h1>
          <p className="text-xs text-ink/50 mt-1">
            <Badge accent={VISIBILITY[vis].accent} className="mr-1.5">
              {VISIBILITY[vis].label}
            </Badge>
            {VISIBILITY[vis].hint}
          </p>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start [&>*]:min-w-0">
        {/* Bài học */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="font-serif text-2xl">Bài học</h2>
            {lessonList.length === 0 ? (
              <Card className="p-5 text-ink/60 text-sm">
                Chưa có bài học. Thêm bài ở khung bên phải.
              </Card>
            ) : (
              <>
                {/* Bài chưa xếp chương — hiện thẳng, chỉ ở trang 1 */}
                {page === 1 && ungrouped.length > 0 && (
                  <div className="space-y-2">
                    <p className="eyebrow">Chưa xếp chương</p>
                    <ol className="space-y-2">
                      {ungrouped.map((l, i) => lessonRow(l, i))}
                    </ol>
                  </div>
                )}

                {/* Các chương — gấp lại, ấn để mở */}
                {pageGroups.map((g, gi) => (
                  <Chapter
                    key={g.module.id}
                    storageKey={`admin-chapter:${c.slug}:${g.module.id}`}
                    className="group rounded-[var(--radius-card)] border border-ink/10 bg-paper shadow-[var(--shadow-soft)] overflow-hidden"
                    summary={
                      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-start gap-2.5 sm:items-center sm:gap-3 px-4 py-3.5 hover:bg-paper-2 transition-colors">
                        <span className="text-ink/40 transition-transform group-open:rotate-90 shrink-0 mt-0.5 sm:mt-0">
                          ▸
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="eyebrow block sm:inline sm:mr-2">
                            Chương {from + gi + 1}
                          </span>
                          <span className="font-medium line-clamp-2 align-middle">
                            {g.module.title}
                          </span>
                          <span className="block font-mono text-xs text-ink/40 tnum mt-1 sm:hidden">
                            {g.lessons.length} bài
                          </span>
                        </span>
                        <span className="hidden sm:block font-mono text-xs text-ink/40 tnum shrink-0">
                          {g.lessons.length} bài
                        </span>
                      </summary>
                    }
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-ink/10">
                      {g.lessons.length === 0 ? (
                        <p className="text-sm text-ink/50 py-2">
                          Chưa có bài trong chương này.
                        </p>
                      ) : (
                        <ol className="space-y-2">
                          {g.lessons.map((l, i) => lessonRow(l, i))}
                        </ol>
                      )}
                    </div>
                  </Chapter>
                ))}

                <Pagination
                  basePath={`/admin/khoa-hoc/${c.slug}`}
                  page={page}
                  totalPages={totalPages}
                />
              </>
            )}
          </div>

          {/* Thêm bài */}
          <Card className="p-5">
            <h3 className="font-serif text-lg mb-3">Thêm bài học</h3>
            <form action={createLesson} className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="course_id" value={c.id} />
              <input type="hidden" name="course_slug" value={c.slug} />
              <input
                name="title"
                required
                placeholder="Tên bài học"
                className={inputCls}
              />
              <select name="module_id" className={`${inputCls} sm:w-44`}>
                <option value="">Không xếp chương</option>
                {mods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <button className={buttonClass("primary", "shrink-0")}>Thêm</button>
            </form>
          </Card>
        </div>

        {/* Cột phải: phân khóa + thông tin khóa + chương */}
        <div className="space-y-5">
          <BulkAssign
            courseId={c.id}
            courseSlug={c.slug}
            learners={learnersForAssign}
          />

          <InviteByEmail courseId={c.id} courseSlug={c.slug} />

          <Card className="p-5" as="section">
            <h3 className="font-serif text-lg mb-3">Thông tin khóa</h3>
            <SaveForm action={updateCourse} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="slug" value={c.slug} />
              <label className="block">
                <span className="text-sm text-ink/70">Tên khóa</span>
                <input name="title" defaultValue={c.title} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Mô tả</span>
                <textarea
                  name="summary"
                  rows={3}
                  defaultValue={c.summary}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Loại khóa</span>
                <select name="category" defaultValue={c.category} className={inputCls}>
                  {categories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.emoji} {cat.label}
                    </option>
                  ))}
                  {/* Loại cũ đã bị xóa khỏi danh sách vẫn giữ được giá trị hiện tại */}
                  {!categories.some((cat) => cat.slug === c.category) && (
                    <option value={c.category}>{c.category}</option>
                  )}
                </select>
              </label>
              <PricingPresets />
              <label className="block">
                <span className="text-sm text-ink/70">Học phí (VND)</span>
                <input
                  name="price"
                  type="number"
                  min={0}
                  step={1000}
                  defaultValue={c.price}
                  className={inputCls}
                />
                <span className="text-xs text-ink/45">
                  Để 0 = không bán bằng chuyển khoản. Lớn hơn 0 thì học viên
                  chuyển khoản để mở cả khóa.
                </span>
              </label>
              <fieldset className="rounded-lg border border-ink/10 p-3 space-y-3">
                <legend className="px-1 text-sm font-medium">🪙 Học thử &amp; xu</legend>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block min-w-0">
                    <span className="text-xs text-ink/70">Bài học thử</span>
                    <input
                      name="free_lessons"
                      type="number"
                      min={0}
                      defaultValue={c.free_lessons}
                      className={inputCls}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-xs text-ink/70">Xu / bài</span>
                    <input
                      name="lesson_coin_price"
                      type="number"
                      min={0}
                      defaultValue={c.lesson_coin_price}
                      className={inputCls}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-xs text-ink/70">Xu cả khóa</span>
                    <input
                      name="course_coin_price"
                      type="number"
                      min={0}
                      defaultValue={c.course_coin_price}
                      className={inputCls}
                    />
                  </label>
                </div>
                <p className="text-xs text-ink/45">
                  N bài đầu ai cũng học thử được, không cần duyệt. Bài sau mở
                  bằng xu (lẻ từng bài hoặc cả khóa). Để 0 = tắt mục đó. Cả 3 ô
                  và học phí đều 0 = khóa miễn phí.
                </p>
                {(c.course_coin_price > 0 || c.lesson_coin_price > 0) && (
                  <p className="text-xs text-slate bg-slate-soft rounded-md px-2.5 py-2">
                    Người cày chăm (mỗi ngày nhận tối đa xu):{" "}
                    {c.course_coin_price > 0 && (
                      <>
                        đủ xu mở cả khóa sau <b>{formatDays(daysCourse)}</b>
                      </>
                    )}
                    {c.course_coin_price > 0 && c.lesson_coin_price > 0 && "; "}
                    {c.lesson_coin_price > 0 && (
                      <>
                        mở lẻ hết {paidLessons} bài sau <b>{formatDays(daysAllLessons)}</b>
                      </>
                    )}
                    .{" "}
                    <Link href="/admin/xu" className="link">
                      Chỉnh mức thưởng
                    </Link>
                  </p>
                )}
              </fieldset>
              <label className="flex items-start gap-3 rounded-lg border border-ink/10 px-3 py-3 text-sm cursor-pointer hover:bg-paper-2 transition-colors">
                <input
                  type="checkbox"
                  name="auto_approve"
                  defaultChecked={c.auto_approve}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-ink"
                />
                <span>
                  Tự duyệt — học viên bấm là vào học ngay
                  <span className="block text-xs text-ink/45">
                    Chỉ áp dụng khi khóa miễn phí (học phí, xu/bài, xu cả khóa
                    đều 0) và Công khai. Bật lên thì các yêu cầu đang chờ của
                    khóa này được duyệt luôn.
                  </span>
                  {c.auto_approve && !autoApproves(c) && (
                    <span className="block text-xs text-clay mt-0.5">
                      ⚠ Đang bật nhưng chưa có hiệu lực: khóa đang thu phí /
                      bán xu hoặc chưa Công khai.
                    </span>
                  )}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-ink/70">Biểu tượng</span>
                  <input
                    name="cover_emoji"
                    defaultValue={c.cover_emoji}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-ink/70">Màu</span>
                  <select name="accent" defaultValue={c.accent} className={inputCls}>
                    <option value="amber">Amber</option>
                    <option value="herb">Herb</option>
                    <option value="slate">Slate</option>
                    <option value="clay">Clay</option>
                  </select>
                </label>
              </div>
            </SaveForm>
          </Card>

          <Card className="p-5" as="section">
            <h3 className="font-serif text-lg mb-3">Chương</h3>
            {mods.length > 0 && (
              <ul className="text-sm space-y-2 mb-3">
                {mods.map((m, i) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-ink/10 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-ink/70 truncate">
                        {i + 1}. {m.title}
                      </span>
                      <Link
                        href={`/admin/khoa-hoc/${c.slug}/chuong/${m.id}`}
                        className="link text-xs shrink-0"
                      >
                        Quiz chương →
                      </Link>
                    </div>
                    {m.available_on && (
                      <p className="text-xs text-ink/50 mt-0.5">
                        📅 Mở {fmtDate(m.available_on)}
                      </p>
                    )}
                    <details className="group mt-1">
                      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer text-xs text-ink/50 hover:text-ink">
                        Sửa / Xóa chương
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <form action={updateModule} className="flex flex-col gap-2">
                          <input type="hidden" name="id" value={m.id} />
                          <input
                            type="hidden"
                            name="course_slug"
                            value={c.slug}
                          />
                          <input
                            name="title"
                            required
                            defaultValue={m.title}
                            className={inputCls}
                          />
                          <label className="block">
                            <span className="text-xs text-ink/60">
                              📅 Ngày mở chương (trống = mở ngay)
                            </span>
                            <input
                              name="available_on"
                              type="date"
                              defaultValue={m.available_on ?? ""}
                              className={inputCls}
                            />
                          </label>
                          <button
                            className={buttonClass("outline", "shrink-0 self-start")}
                          >
                            Lưu
                          </button>
                        </form>
                        <form action={deleteModule}>
                          <input type="hidden" name="id" value={m.id} />
                          <input
                            type="hidden"
                            name="course_slug"
                            value={c.slug}
                          />
                          <button className="text-xs text-clay hover:underline">
                            Xóa chương (bài học sẽ chuyển về “Chưa xếp chương”)
                          </button>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <form action={createModule} className="flex gap-2">
              <input type="hidden" name="course_id" value={c.id} />
              <input type="hidden" name="course_slug" value={c.slug} />
              <input
                name="title"
                required
                placeholder="Tên chương"
                className={inputCls}
              />
              <button className={buttonClass("ghost", "shrink-0")}>+ Thêm</button>
            </form>
          </Card>

          <form action={deleteCourse}>
            <input type="hidden" name="id" value={c.id} />
            <button className="text-sm text-clay hover:underline">
              Xóa khóa học này
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
