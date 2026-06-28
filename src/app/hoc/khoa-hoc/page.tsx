import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCatalog } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { CourseFilter } from "@/components/CourseFilter";
import { Pagination } from "@/components/Pagination";
import { CATEGORIES } from "@/lib/brand";
import { requestEnroll } from "./actions";

export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; page?: string }>;
}) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const cat = sp.cat ?? "";
  const page = Number(sp.page) || 1;
  const { items, page: cur, totalPages, total } = await getCatalog(user.id, {
    q,
    cat,
    page,
  });

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Khóa học</Eyebrow>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">
          Chọn khóa bạn muốn học
        </h1>
        <p className="text-ink/60 mt-2 max-w-lg">
          Gửi yêu cầu học, coach duyệt là bạn vào học được ngay.
        </p>
      </section>

      <CourseFilter basePath="/hoc/khoa-hoc" q={q} cat={cat} />

      {items.length === 0 ? (
        <Card className="p-8 text-center text-ink/60">
          Không có khóa nào khớp bộ lọc.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ course, status }) => (
            <Card key={course.id} className="p-6 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="text-3xl">{course.cover_emoji}</div>
                <Badge accent={course.category === "tap_luyen" ? "herb" : "amber"}>
                  {CATEGORIES[course.category]?.label ?? "Khóa học"}
                </Badge>
              </div>
              <h3 className="font-serif text-xl mt-3">{course.title}</h3>
              <p className="text-sm text-ink/60 mt-1.5 flex-1 leading-relaxed">
                {course.summary}
              </p>
              <div className="mt-5">
                {status === "approved" ? (
                  <Link
                    href={`/hoc/khoa/${course.slug}`}
                    className={buttonClass("primary", "w-full")}
                  >
                    Vào học
                  </Link>
                ) : status === "pending" ? (
                  <button
                    disabled
                    className={buttonClass("outline", "w-full")}
                    title="Đang chờ coach duyệt"
                  >
                    ⏳ Đang chờ duyệt
                  </button>
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
          ))}
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
