import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { createCourse } from "../actions";
import type { Course } from "@/lib/supabase/types";

const inputCls =
  "w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export default async function AdminCourses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .order("sort_order");
  const courses = (data as Course[]) ?? [];

  return (
    <div className="space-y-8">
      <section>
        <Eyebrow>Quản trị · Khóa học</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Khóa học</h1>
      </section>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Danh sách */}
        <div className="space-y-3">
          {courses.length === 0 && (
            <Card className="p-6 text-ink/60">
              Chưa có khóa nào. Tạo khóa đầu tiên ở bên phải.
            </Card>
          )}
          {courses.map((c) => (
            <Link key={c.id} href={`/admin/khoa-hoc/${c.id}`}>
              <Card className="p-4 flex items-center gap-4 hover:border-ink/25 transition-colors">
                <span className="text-2xl">{c.cover_emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-ink/50 font-mono">/{c.slug}</div>
                </div>
                <Badge accent={c.published ? "herb" : "ink"}>
                  {c.published ? "Đã xuất bản" : "Nháp"}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>

        {/* Tạo khóa */}
        <Card className="p-6 sticky top-20" as="section">
          <h2 className="font-serif text-xl mb-4">Tạo khóa mới</h2>
          <form action={createCourse} className="space-y-3">
            <label className="block">
              <span className="text-sm text-ink/70">Tên khóa</span>
              <input name="title" required className={inputCls} placeholder="VD: Dinh dưỡng nền tảng" />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Mô tả ngắn</span>
              <textarea name="summary" rows={2} className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-ink/70">Biểu tượng</span>
                <input name="cover_emoji" defaultValue="🍲" className={inputCls} />
              </label>
              <label className="block">
                <span className="text-sm text-ink/70">Màu</span>
                <select name="accent" className={inputCls} defaultValue="amber">
                  <option value="amber">Amber</option>
                  <option value="herb">Herb (xanh rau)</option>
                  <option value="slate">Slate (xanh xám)</option>
                  <option value="clay">Clay (đỏ đất)</option>
                </select>
              </label>
            </div>
            <button className={buttonClass("primary", "w-full")}>Tạo khóa</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
