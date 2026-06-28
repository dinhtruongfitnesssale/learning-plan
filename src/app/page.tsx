import Link from "next/link";
import Image from "next/image";
import { ButtonLink, Eyebrow, Rule, Card } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { getCurrentUser } from "@/lib/auth";

export default async function Landing() {
  const me = await getCurrentUser();
  const dest = me ? (me.profile?.role === "coach" ? "/admin" : "/hoc") : "/login";

  return (
    <>
      <header className="mx-auto max-w-5xl px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={30} height={30} />
          <span className="font-serif text-lg">{APP_NAME}</span>
        </div>
        <ButtonLink href={dest} variant="outline">
          {me ? "Vào học" : "Đăng nhập"}
        </ButtonLink>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-5 pt-16 pb-20 text-center">
          <Eyebrow className="justify-center">
            Học viện dinh dưỡng &amp; tập luyện
          </Eyebrow>
          <h1 className="font-serif text-4xl sm:text-6xl leading-[1.05] mt-4 max-w-3xl mx-auto">
            Học khỏe mỗi ngày, <br className="hidden sm:block" />
            <span className="hl">như dọn một mâm cơm tử tế</span>.
          </h1>
          <p className="mt-6 text-lg text-ink/65 max-w-xl mx-auto leading-relaxed">
            Từng buổi học nhỏ, gọn, dễ làm. Tiến bộ được đo bằng năng lực thật —
            không phải huy hiệu ảo hay áp lực chuỗi ngày.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <ButtonLink href={dest}>Bắt đầu học</ButtonLink>
            <Link href="#cach-hoat-dong" className="link text-sm self-center">
              Cách hoạt động
            </Link>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-5">
          <Rule amber />
        </div>

        {/* Trụ cột thiết kế (theo Cornell notes về gamification) */}
        <section id="cach-hoat-dong" className="mx-auto max-w-5xl px-5 py-20">
          <Eyebrow>Vì sao bạn sẽ theo được</Eyebrow>
          <h2 className="font-serif text-3xl mt-3 mb-10 max-w-lg">
            Game hóa đúng cách — tôn vinh tiến bộ, không gây quá tải.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pillars.map((p) => (
              <Card key={p.title} className="p-6">
                <div className="text-2xl">{p.icon}</div>
                <h3 className="font-serif text-xl mt-3">{p.title}</h3>
                <p className="text-sm text-ink/60 mt-2 leading-relaxed">{p.body}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10">
        <div className="mx-auto max-w-5xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink/50">
          <span>
            © {new Date().getFullYear()} {APP_NAME} · {APP_TAGLINE}
          </span>
          <span className="font-mono text-xs">paper + ink · 90/5/5</span>
        </div>
      </footer>
    </>
  );
}

const pillars = [
  {
    icon: "🎯",
    title: "Vòng tròn cần khép",
    body: "Tiến độ hiện thành vòng tròn đang lấp đầy — não bạn tự muốn hoàn thành nốt phần còn dang dở.",
  },
  {
    icon: "🌿",
    title: "Thi nhỏ, dễ thắng",
    body: "Bảng xếp hạng theo từng khóa, từng tuần — đủ nhỏ để bạn thật sự có cơ hội đứng đầu.",
  },
  {
    icon: "🎁",
    title: "Thưởng bất ngờ",
    body: "Hoàn thành bài là có thêm XP thưởng — biết có quà nhưng không đoán được bao nhiêu.",
  },
  {
    icon: "❄️",
    title: "Chuỗi ngày có lối thoát",
    body: "Lỡ một hôm vẫn được tha nhờ 'đóng băng chuỗi'. Động lực, không phải nghĩa vụ.",
  },
  {
    icon: "📈",
    title: "Đo năng lực thật",
    body: "Quiz chấm theo % đúng, lưu kỷ lục cá nhân. Bạn giỏi lên thật, không chỉ mở app.",
  },
  {
    icon: "📓",
    title: "Bài học cỡ mâm cơm",
    body: "Mỗi buổi 4–6 phút, đủ một ý. Gọn để ngày nào cũng làm được.",
  },
];
