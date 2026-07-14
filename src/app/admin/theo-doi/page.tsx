import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getLearningTracking, INACTIVE_DAYS, type TrackingRow } from "@/lib/data";
import { Card, Eyebrow, Badge, Stat } from "@/components/ui";
import { Pagination } from "@/components/Pagination";
import { cn } from "@/lib/cn";

// Bộ lọc danh sách cần nhắc: tất cả / chưa bắt đầu / đã nghỉ lâu.
type ReminderFilter = "all" | "new" | "inactive";
const REMINDER_PER_PAGE = 4;

export default async function AdminTracking({
  searchParams,
}: {
  searchParams: Promise<{ rf?: string; rPage?: string }>;
}) {
  await requireCoach();
  const { rows, reminders, onTrack } = await getLearningTracking();

  const studiedToday = rows.filter((r) => r.daysSince === 0).length;

  // Lọc + phân trang danh sách cần nhắc (4 người/trang).
  const sp = await searchParams;
  const rf: ReminderFilter =
    sp.rf === "new" || sp.rf === "inactive" ? sp.rf : "all";
  const neverStarted = reminders.filter((r) => r.daysSince === null);
  const inactive = reminders.filter((r) => r.daysSince !== null);
  const filtered =
    rf === "new" ? neverStarted : rf === "inactive" ? inactive : reminders;

  const totalPages = Math.max(1, Math.ceil(filtered.length / REMINDER_PER_PAGE));
  const rPage = Math.min(Math.max(1, Number(sp.rPage) || 1), totalPages);
  const pagedReminders = filtered.slice(
    (rPage - 1) * REMINDER_PER_PAGE,
    rPage * REMINDER_PER_PAGE,
  );

  const filters: { key: ReminderFilter; label: string; count: number }[] = [
    { key: "all", label: "Tất cả", count: reminders.length },
    { key: "new", label: "Chưa bắt đầu", count: neverStarted.length },
    { key: "inactive", label: "Đã nghỉ lâu", count: inactive.length },
  ];

  return (
    <div className="space-y-8">
      <section>
        <Eyebrow>Quản trị · Theo dõi</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Theo dõi học tập</h1>
        <p className="text-ink/60 mt-2">
          Ai đang học đều, ai đã nghỉ lâu — nhắc nhở khi học viên nghỉ từ{" "}
          {INACTIVE_DAYS} ngày trở lên.
        </p>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <Stat value={rows.length} label="Học viên" accent="slate" />
        </Card>
        <Card className="p-5">
          <Stat value={studiedToday} label="Học hôm nay" accent="herb" />
        </Card>
        <Card className="p-5">
          <Stat value={onTrack.length} label="Đang học đều" accent="amber" />
        </Card>
        <Card className="p-5">
          <Stat value={reminders.length} label="Cần nhắc nhở" accent="clay" />
        </Card>
      </div>

      {/* Cần nhắc nhở */}
      <section>
        <h2 className="font-serif text-2xl mb-3">
          Cần nhắc nhở{" "}
          {reminders.length > 0 && (
            <span className="font-mono text-base text-clay tnum">
              ({reminders.length})
            </span>
          )}
        </h2>
        {reminders.length === 0 ? (
          <Card className="p-6 text-ink/60 text-sm">
            Tuyệt vời — không có học viên nào nghỉ quá {INACTIVE_DAYS} ngày. 🎉
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Bộ lọc để theo dõi cho dễ */}
            <div className="flex flex-wrap gap-1.5">
              {filters.map((f) => (
                <Link
                  key={f.key}
                  href={
                    f.key === "all"
                      ? "/admin/theo-doi"
                      : `/admin/theo-doi?rf=${f.key}`
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                    f.key === rf
                      ? "bg-ink text-paper"
                      : "border border-ink/15 text-ink/70 hover:border-ink/35 hover:bg-paper-2",
                  )}
                >
                  {f.label}
                  <span className="font-mono text-xs tnum opacity-70">
                    {f.count}
                  </span>
                </Link>
              ))}
            </div>

            {pagedReminders.length === 0 ? (
              <Card className="p-6 text-ink/60 text-sm">
                Không có ai trong nhóm này. 🎉
              </Card>
            ) : (
              pagedReminders.map((r) => (
                <LearnerRow key={r.id} row={r} highlight />
              ))
            )}

            <Pagination
              basePath="/admin/theo-doi"
              page={rPage}
              totalPages={totalPages}
              pageParam="rPage"
              params={{ rf: rf === "all" ? "" : rf }}
            />
          </div>
        )}
      </section>

      {/* Đang học đều */}
      <section>
        <h2 className="font-serif text-2xl mb-3">Đang học đều</h2>
        {onTrack.length === 0 ? (
          <Card className="p-6 text-ink/60 text-sm">
            Chưa có học viên nào học trong {INACTIVE_DAYS} ngày gần đây.
          </Card>
        ) : (
          <div className="space-y-3">
            {onTrack.map((r) => (
              <LearnerRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function lastActiveLabel(row: TrackingRow) {
  if (row.daysSince === null) return "Chưa học buổi nào";
  if (row.daysSince === 0) return "Đã học hôm nay";
  if (row.daysSince === 1) return "Học hôm qua";
  return `Học gần nhất: ${formatDate(row.lastActive!)}`;
}

function LearnerRow({ row, highlight = false }: { row: TrackingRow; highlight?: boolean }) {
  return (
    <Link href={`/admin/hoc-vien/${row.id}`}>
      <Card
        className={`p-4 flex items-center gap-4 transition-colors hover:border-ink/25 ${
          highlight ? "border-clay/30 bg-clay-soft/30" : ""
        }`}
      >
        <div className="grid place-items-center w-10 h-10 rounded-full bg-paper-2 font-serif text-lg shrink-0">
          {(row.fullName || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {row.fullName || "(chưa đặt tên)"}
          </div>
          <div className="text-xs text-ink/50 truncate">{row.email}</div>
          <div className="text-xs text-ink/40 mt-0.5">{lastActiveLabel(row)}</div>
        </div>

        <div className="text-right shrink-0">
          {row.daysSince === null ? (
            <Badge accent="clay">Chưa bắt đầu</Badge>
          ) : row.needsReminder ? (
            <Badge accent="clay">Đã nghỉ {row.daysSince} ngày</Badge>
          ) : (
            <Badge accent="herb">🔥 {row.currentStreak} ngày</Badge>
          )}
          <div className="text-xs text-ink/40 font-mono tnum mt-1">
            Kỷ lục: {row.longestStreak}
          </div>
        </div>
      </Card>
    </Link>
  );
}
