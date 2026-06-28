"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function enroll(formData: FormData) {
  const courseId = String(formData.get("course_id"));
  const slug = String(formData.get("slug"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("enrollments")
    .insert({ user_id: user.id, course_id: courseId });

  revalidatePath("/hoc");
  redirect(`/hoc/khoa/${slug}`);
}
