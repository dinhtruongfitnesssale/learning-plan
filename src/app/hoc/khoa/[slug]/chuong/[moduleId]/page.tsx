import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getModuleQuizView } from "@/lib/data";
import { Quiz } from "@/components/Quiz";
import { Eyebrow } from "@/components/ui";

export default async function ModuleQuizPage({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string }>;
}) {
  const { slug, moduleId } = await params;
  const { user } = await requireUser();
  const data = await getModuleQuizView(slug, moduleId, user.id);
  if (!data) notFound();
  // Chưa đủ điều kiện (chưa duyệt / chương bị khóa / chưa học hết bài / chưa có quiz)
  // → quay về trang khóa học.
  if (data.locked) redirect(`/hoc/khoa/${slug}`);

  const { course, module: mod, bestPercent } = data;

  return (
    <article className="max-w-2xl mx-auto space-y-7">
      <Link href={`/hoc/khoa/${course.slug}`} className="link text-sm">
        ← {course.title}
      </Link>

      <header>
        <Eyebrow>Kiểm tra chương</Eyebrow>
        <h1 className="font-serif text-3xl sm:text-4xl mt-2">{mod.title}</h1>
        <p className="text-ink/60 mt-2">
          Đạt bài kiểm tra này để mở khóa chương kế tiếp.
        </p>
      </header>

      <Quiz kind="module" targetId={mod.id} bestPercent={bestPercent} />
    </article>
  );
}
