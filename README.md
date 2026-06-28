# Bếp Học — LMS + Gamification

Học viện dinh dưỡng & tập luyện. Next.js 16 (App Router) + Supabase + Tailwind v4,
deploy trên Vercel. Thiết kế theo brand "mâm cơm Việt": paper + ink, quy tắc 90/5/5.

## Tính năng

- **Học viên**: bảng học (XP, cấp độ, chuỗi ngày), khóa học → bài học (Markdown),
  đánh dấu hoàn thành, quiz năng lực, bảng xếp hạng tuần theo từng khóa.
- **Coach (admin)**: tạo/sửa khóa, chương, bài học, quiz; tạo tài khoản học viên;
  xem tiến độ.
- **Gamification đúng cách** (theo ghi chú Cornell):
  - Vòng tròn tiến độ (completion drive — Gestalt).
  - Bảng xếp hạng cục bộ theo khóa & theo tuần (micro-competition, dễ thắng).
  - Thưởng XP biến đổi khi hoàn thành bài/quiz (variable reward).
  - Streak có "đóng băng" — tha 1 ngày lỡ, tránh áp lực nghĩa vụ.
  - XP cộng theo **năng lực thật** (% quiz đúng), chấm ở server, không phải huy hiệu ảo.

## Cài đặt Supabase

1. Tạo **một project Supabase mới** (đừng dùng chung với training-plan).
2. Vào **SQL Editor**, chạy lần lượt:
   - `supabase/migrations/0001_init.sql` (bảng, RLS, RPC, trigger)
   - `supabase/migrations/0002_media.sql` (cột video/PDF cho bài học)
   - `supabase/seed.sql` (dữ liệu mẫu — tùy chọn)
3. Vào **Project Settings → API**, copy các key vào `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
4. **Tài khoản coach**: trigger tự gán quyền `coach` cho email
   `ladysfit.mastertrainer@gmail.com`. Tạo user này trong
   **Authentication → Users → Add user** (đặt mật khẩu, tick *Auto Confirm*),
   rồi đăng nhập — sẽ vào thẳng `/admin`.
   (Muốn đổi email coach: sửa trong hàm `handle_new_user()` ở migration.)

## Chạy local

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy Vercel

1. Push repo lên GitHub.
2. Vercel → New Project → import repo.
3. Thêm 3 biến môi trường Supabase ở **Environment Variables**
   (cả `SUPABASE_SERVICE_ROLE_KEY` — chỉ dùng phía server).
4. Deploy. Không cần cấu hình build đặc biệt.

## Cấu trúc

- `src/lib/brand.ts` — tên app, màu, cấp độ. Đổi tên app ở đây.
- `src/lib/supabase/` — client (browser/server/admin) + proxy refresh phiên.
- `src/lib/data.ts` — truy vấn dữ liệu phía server.
- `src/app/hoc/` — khu vực học viên.
- `src/app/admin/` — khu vực coach.
- `supabase/` — migration & seed SQL.

## Ghi chú

- Hiện đăng nhập bằng email + mật khẩu; coach tạo tài khoản và gửi thông tin tay
  (chưa có tên miền/email tự động). Khi có domain, có thể bật magic link.
- Quiz giấu đáp án khỏi học viên: câu hỏi lấy qua RPC `get_quiz`, chấm qua
  `submit_quiz` — đáp án không bao giờ gửi xuống client trước khi nộp.
- Tài liệu PDF & video đều **nhúng theo link** (Google Drive / YouTube...), không
  upload file lên Supabase — tiết kiệm dữ liệu. Nhớ đặt quyền chia sẻ "Bất kỳ ai
  có đường liên kết" cho file Drive/video để học viên xem được.
