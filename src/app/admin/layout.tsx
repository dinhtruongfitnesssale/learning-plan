import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { requireCoach } from "@/lib/auth";
import { getPendingCount, getMatchedPaymentCount } from "@/lib/data";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireCoach();
  const [pendingCount, payCount] = await Promise.all([
    getPendingCount(),
    getMatchedPaymentCount(),
  ]);
  return (
    <>
      <AppHeader
        profile={profile}
        variant="coach"
        pendingCount={pendingCount}
        payCount={payCount}
      />
      <main className="safe-x pb-bottom-nav flex-1 mx-auto w-full max-w-5xl pt-6 sm:pt-8">
        {children}
      </main>
      <BottomNav
        variant="coach"
        isCoach
        pendingCount={pendingCount}
        payCount={payCount}
      />
    </>
  );
}
