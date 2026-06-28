import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLearnerDashboard } from "@/lib/data";
import { Card, Eyebrow, ButtonLink, Badge } from "@/components/ui";
import { ProgressRing } from "@/components/ProgressRing";

export default async function Dashboard() {
  const { user, profile } = await requireUser();
  const data = await getLearnerDashboard(user.id);
  const name = profile?.full_name || "bạn";
  const { level, totalXp, streak } = data;

  return (
    <div className="space-y-8">
      {/* Lời chào + cấp độ */}
      <section>
        <Eyebrow>Bảng học của bạn</Eyebrow>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">
          Chào {name.split(" ").slice(-1)[0]}, sẵn sàng vào bếp chưa?
        </h1>
      </section>

      {/* Thẻ chỉ số: XP / cấp độ / streak */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <ProgressRing value={level.progress} accent="amber" size={68} />
          <div>
            <div className="text-xs text-ink/50">Cấp độ {level.level}</div>
            <div className="font-serif text-xl">{level.name}</div>
            <div className="text-xs text-ink/50 mt-0.5 font-mono tnum">
              {level.next ? `còn ${level.toNext} XP lên hạng` : "đỉnh bếp!"}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink/50">Tổng điểm kinh nghiệm</div>
          <div className="font-mono text-3xl font-semibold tnum mt-1">
            {totalXp.toLocaleString("vi-VN")}
            <span className="text-base text-amber ml-1">XP</span>
          </div>
          <div className="text-xs text-ink/50 mt-2">
            Tích từ bài học &amp; quiz đã làm
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-ink/50">Chuỗi ngày học</div>
            <Badge accent="slate">❄️ {streak.freezes} đóng băng</Badge>
          </div>
          <div className="font-mono text-3xl font-semibold tnum mt-1 flex items-baseline gap-1">
            {streak.current_streak}
            <span className="text-base text-ink/50">
              {streak.current_streak > 0 ? "🔥 ngày" : "ngày"}
            </span>
          </div>
          <div className="text-xs text-ink/50 mt-2">
            Dài nhất: {streak.longest_streak} ngày · lỡ 1 hôm vẫn được tha
          </div>
        </Card>
      </div>

      {/* Tiếp tục học */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-2xl">Tiếp tục học</h2>
          <Link href="/hoc/khoa-hoc" className="link text-sm">
            Xem tất cả khóa
          </Link>
        </div>

        {data.courses.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-ink/60 mb-4">
              Bạn chưa ghi danh khóa nào. Chọn một khóa để bắt đầu mâm cơm đầu
              tiên.
            </p>
            <ButtonLink href="/hoc/khoa-hoc">Khám phá khóa học</ButtonLink>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {data.courses.map(({ course, done, total, percent }) => (
              <Link key={course.id} href={`/hoc/khoa/${course.slug}`}>
                <Card className="p-5 h-full hover:border-ink/25 transition-colors flex items-center gap-4">
                  <ProgressRing
                    value={percent}
                    accent={course.accent}
                    label={
                      <span className="font-mono text-xs tnum">
                        {done}/{total}
                      </span>
                    }
                  />
                  <div className="min-w-0">
                    <div className="text-2xl">{course.cover_emoji}</div>
                    <h3 className="font-serif text-lg mt-1 truncate">
                      {course.title}
                    </h3>
                    <p className="text-sm text-ink/55 line-clamp-2">
                      {percent >= 1
                        ? "Hoàn thành — ôn lại bất cứ lúc nào."
                        : total
                          ? `Còn ${total - done} bài để khép vòng tròn.`
                          : "Khóa đang được soạn bài."}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
