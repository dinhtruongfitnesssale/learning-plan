import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { requireCoach } from "@/lib/auth";
import { getPendingCount } from "@/lib/data";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireCoach();
  const pendingCount = await getPendingCount();
  return (
    <>
      <AppHeader profile={profile} variant="coach" pendingCount={pendingCount} />
      <main className="safe-x pb-bottom-nav flex-1 mx-auto w-full max-w-5xl pt-6 sm:pt-8">
        {children}
      </main>
      <BottomNav variant="coach" isCoach pendingCount={pendingCount} />
    </>
  );
}
