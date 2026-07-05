// Các tiêu chí (chủ đề) đánh giá khóa học — dùng chung cho giao diện
// học viên (form chấm sao) và giao diện quản trị (đọc đánh giá).
// Mỗi tiêu chí chấm theo thang 1–5 sao.

export const REVIEW_TOPICS = [
  {
    key: "r_content",
    label: "Nội dung khóa học",
    hint: "Bài học rõ ràng, dễ hiểu, hữu ích",
  },
  {
    key: "r_coach",
    label: "Hướng dẫn của HLV",
    hint: "Cách giảng dạy & hỗ trợ tận tình",
  },
  {
    key: "r_difficulty",
    label: "Độ khó phù hợp",
    hint: "Vừa sức, không quá dễ hay quá khó",
  },
  {
    key: "r_applicability",
    label: "Áp dụng thực tế",
    hint: "Áp dụng được vào ăn uống / tập luyện",
  },
  {
    key: "r_overall",
    label: "Hài lòng chung",
    hint: "Mức độ hài lòng tổng thể với khóa học",
  },
] as const;

export type ReviewTopicKey = (typeof REVIEW_TOPICS)[number]["key"];

// Điểm trung bình của một đánh giá trên cả 5 tiêu chí.
export function reviewAverage(r: Record<ReviewTopicKey, number>): number {
  const sum = REVIEW_TOPICS.reduce((a, t) => a + (r[t.key] ?? 0), 0);
  return sum / REVIEW_TOPICS.length;
}
