import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";

// Dùng chung cho các file action của admin. Không có "use server" để hai hàm
// này không bị lộ thành Server Action gọi được từ trình duyệt.

// Ô số do coach nhập → số nguyên không âm (ô trống / chữ = 0).
export function nonNeg(v: FormDataEntryValue | null) {
  return Math.max(0, Math.round(Number(v) || 0));
}

// Mọi action đều kiểm tra coach (RLS cũng chặn, đây là lớp phòng vệ thứ hai).
export async function guard() {
  await requireCoach();
  return createClient();
}
