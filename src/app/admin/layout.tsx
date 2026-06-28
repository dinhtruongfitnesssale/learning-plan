import { AppHeader } from "@/components/AppHeader";
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
      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8">{children}</main>
    </>
  );
}
