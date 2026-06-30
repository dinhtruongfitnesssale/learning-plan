import { requireCoach } from "@/lib/auth";
import { buildTemplateBuffer } from "@/lib/quiz-import";

// GET /admin/quiz-template → tải file Excel mẫu để điền câu hỏi quiz.
export async function GET() {
  await requireCoach(); // học viên / khách bị đẩy đi nơi khác

  const buffer = buildTemplateBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mau-quiz.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
