import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCatalog } from "@/lib/data";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { enroll } from "./actions";

export default async function Catalog() {
  const { user } = await requireUser();
  const items = await getCatalog(user.id);

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Khóa học</Eyebrow>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">
          Chọn mâm cơm bạn muốn học
        </h1>
        <p className="text-ink/60 mt-2 max-w-lg">
          Mỗi khóa là một chủ đề. Ghi danh để mở khóa bài học và tham gia bảng
          xếp hạng tuần của khóa.
        </p>
      </section>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-ink/60">
          Chưa có khóa nào được mở. Quay lại sau nhé.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map(({ course, enrolled }) => (
            <Card key={course.id} className="p-6 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="text-3xl">{course.cover_emoji}</div>
                <Badge accent={course.accent}>
                  {enrolled ? "Đã ghi danh" : "Mở"}
                </Badge>
              </div>
              <h3 className="font-serif text-xl mt-3">{course.title}</h3>
              <p className="text-sm text-ink/60 mt-1.5 flex-1 leading-relaxed">
                {course.summary}
              </p>
              <div className="mt-5">
                {enrolled ? (
                  <Link
                    href={`/hoc/khoa/${course.slug}`}
                    className={buttonClass("outline", "w-full")}
                  >
                    Vào học
                  </Link>
                ) : (
                  <form action={enroll}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="slug" value={course.slug} />
                    <button type="submit" className={buttonClass("primary", "w-full")}>
                      Ghi danh học
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
