import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { levelForXp } from "@/lib/brand";
import { Card, Eyebrow, Badge, buttonClass } from "@/components/ui";
import { CreateLearnerForm } from "./CreateLearnerForm";
import type { Profile } from "@/lib/supabase/types";

const inputCls =
  "rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20";

export default async function AdminLearners({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireCoach();
  const q = (await searchParams).q ?? "";
  const supabase = await createClient();

  let pq = supabase.from("profiles").select("*").eq("role", "learner");
  if (q) pq = pq.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);

  const [{ data: profiles }, { data: xp }, { data: enr }] = await Promise.all([
    pq.order("created_at", { ascending: false }),
    supabase.from("xp_events").select("user_id, amount"),
    supabase.from("enrollments").select("user_id").eq("status", "approved"),
  ]);

  const learners = (profiles as Profile[]) ?? [];
  const xpByUser = new Map<string, number>();
  (xp ?? []).forEach((e) =>
    xpByUser.set(e.user_id, (xpByUser.get(e.user_id) ?? 0) + (e.amount ?? 0)),
  );
  const enrByUser = new Map<string, number>();
  (enr ?? []).forEach((e) =>
    enrByUser.set(e.user_id, (enrByUser.get(e.user_id) ?? 0) + 1),
  );

  return (
    <div className="space-y-8">
      <section>
        <Eyebrow>Quản trị · Học viên</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Học viên</h1>
        <p className="text-ink/60 mt-2">
          Tạo tài khoản và theo dõi tiến bộ của từng người.
        </p>
      </section>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* Danh sách */}
        <div className="space-y-3">
          <form action="/admin/hoc-vien" method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Tìm theo tên hoặc email…"
              className={`${inputCls} flex-1`}
            />
            <button className={buttonClass("outline")}>Tìm</button>
          </form>

          {learners.length === 0 ? (
            <Card className="p-6 text-ink/60 text-sm">
              {q ? "Không tìm thấy học viên khớp." : "Chưa có học viên nào. Tạo tài khoản ở bên phải."}
            </Card>
          ) : (
            learners.map((p) => {
              const totalXp = xpByUser.get(p.id) ?? 0;
              const lv = levelForXp(totalXp);
              return (
                <Link key={p.id} href={`/admin/hoc-vien/${p.id}`}>
                  <Card className="p-4 flex items-center gap-4 hover:border-ink/25 transition-colors">
                    <div className="grid place-items-center w-10 h-10 rounded-full bg-paper-2 font-serif text-lg shrink-0">
                      {(p.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {p.full_name || "(chưa đặt tên)"}
                      </div>
                      <div className="text-xs text-ink/50 truncate">{p.email}</div>
                      <div className="text-xs text-ink/40 font-mono tnum">
                        {enrByUser.get(p.id) ?? 0} khóa · {totalXp} XP
                      </div>
                    </div>
                    <Badge accent="amber">
                      Lv{lv.level} · {lv.name}
                    </Badge>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        {/* Tạo học viên */}
        <Card className="p-6 sticky top-20">
          <h2 className="font-serif text-xl mb-4">Tạo tài khoản học viên</h2>
          <CreateLearnerForm />
        </Card>
      </div>
    </div>
  );
}
