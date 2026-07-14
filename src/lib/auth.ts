import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./supabase/types";

// Lấy user + profile hiện tại (null nếu chưa đăng nhập).
// Bọc React cache(): trong CÙNG một lần render, layout và page đều gọi hàm này
// (qua requireUser/requireCoach) nhưng chỉ xác thực token + query profile MỘT
// lần thay vì hai — bớt round-trip mạng tới Supabase mỗi khi chuyển trang.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: profile as Profile | null };
});

// Bắt buộc đăng nhập; nếu chưa thì về /login.
export async function requireUser() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return me;
}

// Bắt buộc là coach; học viên bị đẩy về /hoc.
export async function requireCoach() {
  const me = await requireUser();
  if (me.profile?.role !== "coach") redirect("/hoc");
  return me;
}
