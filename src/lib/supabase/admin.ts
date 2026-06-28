import { createClient } from "@supabase/supabase-js";

// Client SERVICE ROLE — bỏ qua RLS. CHỉ import trong server actions / route handlers.
// Dùng để coach tạo tài khoản học viên. Không bao giờ import ở Client Component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
