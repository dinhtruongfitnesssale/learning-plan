import { requireCoach } from "@/lib/auth";
import { getPendingRequests } from "@/lib/data";
import { Card, Eyebrow, buttonClass } from "@/components/ui";
import { approveEnrollment, denyEnrollment } from "../actions";

export default async function Requests() {
  await requireCoach();
  const requests = await getPendingRequests();

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Quản trị · Yêu cầu học</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Yêu cầu học</h1>
        <p className="text-ink/60 mt-2">
          Học viên gửi yêu cầu vào khóa. Duyệt thì họ mới học được.
        </p>
      </section>

      {requests.length === 0 ? (
        <Card className="p-8 text-center text-ink/60">
          Chưa có yêu cầu nào đang chờ. 🎉
        </Card>
      ) : (
        <div className="space-y-2.5">
          {requests.map((r) => (
            <Card
              key={r.id}
              className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="text-2xl leading-none shrink-0">
                  {r.course.cover_emoji}
                </span>
                <div className="min-w-0">
                  <div className="font-medium line-clamp-2">
                    {r.learner?.full_name || "(chưa đặt tên)"}
                  </div>
                  <div className="text-xs text-ink/45 truncate">
                    {r.learner?.email}
                  </div>
                  <div className="text-sm text-ink/60 mt-0.5 line-clamp-2">
                    xin học: <span className="text-ink">{r.course.title}</span>
                  </div>
                </div>
              </div>
              <div className="btn-row sm:shrink-0">
                <form action={approveEnrollment}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={buttonClass("primary")}>Duyệt</button>
                </form>
                <form action={denyEnrollment}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={buttonClass("ghost")}>Từ chối</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
