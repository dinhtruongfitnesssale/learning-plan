import { AppHeader } from "@/components/AppHeader";
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
      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8">{children}</main>
    </>
  );
}
