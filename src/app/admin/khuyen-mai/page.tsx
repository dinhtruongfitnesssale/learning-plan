import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getPromoAdmin } from "@/lib/data";
import { Card, Eyebrow } from "@/components/ui";
import { PromoForm } from "./PromoForm";
import { PromoRow } from "./PromoRow";

export default async function PromoAdmin() {
  await requireCoach();
  const { promos, courses } = await getPromoAdmin();

  return (
    <div className="space-y-8">
      <section>
        <Eyebrow>Quản trị · Khuyến mãi</Eyebrow>
        <h1 className="font-serif text-3xl mt-2">Mã khuyến mãi</h1>
        <p className="text-ink/60 mt-2 max-w-2xl">
          Học viên nhập mã ở trang thanh toán học phí, số tiền chuyển khoản tự
          giảm theo. Mỗi học viên dùng mỗi mã 1 lần. Mã giảm hết học phí thì
          khóa mở luôn, không cần chuyển khoản. Ưu đãi giá gạch ngang của từng
          khóa vẫn chỉnh trong{" "}
          <Link href="/admin/khoa-hoc" className="link">
            trang khóa học
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Tạo mã mới</h2>
        <Card className="p-5">
          <PromoForm courses={courses} />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Các mã ({promos.length})</h2>
        {promos.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink/60">
            Chưa có mã nào.
          </Card>
        ) : (
          <Card className="divide-y divide-ink/10">
            {promos.map(({ courseIds, uses, ...p }) => (
              <PromoRow
                key={p.id}
                promo={p}
                courseIds={courseIds}
                uses={uses}
                courses={courses}
              />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
