import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { requireUser } from "@/lib/auth";

export default async function LearnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUser();
  return (
    <>
      <AppHeader profile={profile} variant="learner" />
      <main className="safe-x pb-bottom-nav flex-1 mx-auto w-full max-w-5xl pt-6 sm:pt-8">
        {children}
      </main>
      <BottomNav variant="learner" isCoach={profile?.role === "coach"} />
    </>
  );
}
