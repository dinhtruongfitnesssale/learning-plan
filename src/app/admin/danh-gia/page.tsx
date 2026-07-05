import { requireCoach } from "@/lib/auth";
import { getCourseReviews, type ReviewRow } from "@/lib/data";
import { REVIEW_TOPICS, reviewAverage } from "@/lib/reviews";
import { Card, Eyebrow, Badge, Stat } from "@/components/ui";

// Sao tĩnh + số điểm cạnh bên.
function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-sm leading-none">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= rounded ? "text-amber" : "text-ink/20"}>
            ★
          </span>
        ))}
      </span>
      <span className="font-mono text-xs text-ink/50 tnum">
        {value.toFixed(1)}
      </span>
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function ReviewsPage() {
  await requireCoach();
  const reviews = await getCourseReviews();

  // Gộp theo khóa (giữ thứ tự khóa xuất hiện — reviews đã sắp mới nhất trước).
  const groups = new Map<string, { course: ReviewRow["course"]; items: ReviewRow[] }>();
  for (const r of reviews) {
    const key = r.course?.slug ?? r.id;
    const g = groups.get(key) ?? { course: r.course, items: [] };
    g.items.push(r);
    groups.set(key, g);
  }

  const totalReviews = reviews.length;
  const overallAvg = totalReviews
    ? reviews.reduce((a, r) => a + reviewAverage(r.ratings), 0) / totalReviews
    : 0;

  return (
    <div className="space-y-6">
      <section>
        <Eyebrow>Quản trị · Đánh giá</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Đánh giá khóa học</h1>
        <p className="text-ink/60 mt-2">
          Ý kiến học viên gửi sau khi học xong khóa. Đọc để biết điều gì đang tốt
          và điều gì cần cải thiện.
        </p>
      </section>

      {totalReviews === 0 ? (
        <Card className="p-8 text-center text-ink/60">
          Chưa có đánh giá nào. Khi học viên học xong một khóa, đánh giá của họ sẽ
          hiện ở đây. ✨
        </Card>
      ) : (
        <>
          <Card className="p-5 flex flex-wrap items-center gap-8">
            <Stat value={totalReviews} label="Lượt đánh giá" />
            <Stat value={groups.size} label="Khóa có đánh giá" />
            <div>
              <div className="flex items-center gap-2">
                <Stars value={overallAvg} />
              </div>
              <div className="text-xs text-ink/50 mt-0.5">Điểm trung bình chung</div>
            </div>
          </Card>

          {[...groups.values()].map((g) => {
            const avg =
              g.items.reduce((a, r) => a + reviewAverage(r.ratings), 0) /
              g.items.length;
            return (
              <section key={g.course?.slug ?? g.items[0].id} className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0">
                    {g.course?.cover_emoji ?? "📘"}
                  </span>
                  <h2 className="font-serif text-xl flex-1 min-w-0 truncate">
                    {g.course?.title ?? "Khóa học"}
                  </h2>
                  <Stars value={avg} />
                  <Badge accent="slate">{g.items.length} đánh giá</Badge>
                </div>

                {g.items.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {r.learner?.full_name || "(chưa đặt tên)"}
                          <span className="text-ink/45 font-normal">
                            {" "}
                            · {r.learner?.email}
                          </span>
                        </div>
                        <div className="text-xs text-ink/45 mt-0.5">
                          {fmtDate(r.createdAt)}
                        </div>
                      </div>
                      <Stars value={reviewAverage(r.ratings)} />
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {REVIEW_TOPICS.map((t) => (
                        <div
                          key={t.key}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-ink/70">{t.label}</span>
                          <span className="text-sm leading-none shrink-0">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span
                                key={n}
                                className={
                                  n <= r.ratings[t.key]
                                    ? "text-amber"
                                    : "text-ink/20"
                                }
                              >
                                ★
                              </span>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {r.comment && (
                      <p className="mt-3 text-sm text-ink/75 border-t border-ink/10 pt-3 whitespace-pre-wrap">
                        “{r.comment}”
                      </p>
                    )}
                  </Card>
                ))}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
