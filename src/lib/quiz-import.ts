// Nhập câu hỏi quiz từ file Excel.
// Dùng chung cho cả route tải mẫu (.xlsx) lẫn server action nhập câu hỏi,
// để cấu trúc cột ở hai nơi luôn khớp nhau.
//
// CHỈ dùng phía server (import "xlsx", không đưa vào client component).
import * as XLSX from "xlsx";

// Tên sheet chứa dữ liệu câu hỏi (app sẽ đọc đúng sheet này).
const DATA_SHEET = "Câu hỏi";
const GUIDE_SHEET = "Hướng dẫn";

// Thứ tự cột trong sheet dữ liệu.
const HEADERS = [
  "Câu hỏi",
  "Đáp án A",
  "Đáp án B",
  "Đáp án C",
  "Đáp án D",
  "Đáp án đúng (A/B/C/D)",
  "Giải thích (không bắt buộc)",
];

export interface ParsedQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface ParseResult {
  rows: ParsedQuestion[];
  // Lỗi theo từng dòng (kèm số dòng đúng như trong Excel) — nếu có thì không nhập gì cả.
  errors: string[];
}

// ── Tạo file mẫu .xlsx ────────────────────────────────────────
// Sheet "Câu hỏi": chỉ có hàng tiêu đề để coach điền.
// Sheet "Hướng dẫn": giải thích cách điền + ví dụ minh họa.
export function buildTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet dữ liệu — chỉ tiêu đề.
  const data = XLSX.utils.aoa_to_sheet([HEADERS]);
  data["!cols"] = [
    { wch: 48 }, // Câu hỏi
    { wch: 22 }, // A
    { wch: 22 }, // B
    { wch: 22 }, // C
    { wch: 22 }, // D
    { wch: 22 }, // đúng
    { wch: 40 }, // giải thích
  ];
  XLSX.utils.book_append_sheet(wb, data, DATA_SHEET);

  // Sheet hướng dẫn — văn bản + ví dụ.
  const guide = XLSX.utils.aoa_to_sheet([
    ["HƯỚNG DẪN ĐIỀN CÂU HỎI QUIZ"],
    [""],
    [`1. Mở sheet "${DATA_SHEET}" và điền mỗi câu hỏi vào MỘT dòng.`],
    ["2. Cột bắt buộc: Câu hỏi, Đáp án A, Đáp án B và Đáp án đúng."],
    ["3. Đáp án C, D có thể bỏ trống (mỗi câu từ 2 đến 4 đáp án)."],
    ["   Lưu ý: không bỏ trống ở giữa (vd điền A, B, D mà bỏ C là không hợp lệ)."],
    ['4. Cột "Đáp án đúng": ghi chữ cái A, B, C hoặc D (cũng chấp nhận số 1-4).'],
    ["5. Cột Giải thích không bắt buộc — hiện cho học viên sau khi nộp bài."],
    ["6. Giữ nguyên hàng tiêu đề; không đổi tên shet; lưu lại định dạng .xlsx rồi tải lên."],
    [""],
    ["VÍ DỤ:"],
    HEADERS,
    [
      "Một bữa ăn cân đối gồm mấy nhóm chất chính?",
      "2",
      "3",
      "4",
      "5",
      "C",
      "Đạm, tinh bột, chất béo, vitamin & khoáng.",
    ],
    [
      "Trung bình nên uống bao nhiêu lít nước mỗi ngày?",
      "1 lít",
      "1.5 lít",
      "2 lít",
      "4 lít",
      "C",
      "Khoảng 2 lít, thay đổi tùy thể trạng và vận động.",
    ],
  ]);
  guide["!cols"] = [{ wch: 48 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, guide, GUIDE_SHEET);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ── Đọc & kiểm tra file tải lên ───────────────────────────────
function normalize(s: unknown): string {
  return String(s ?? "").trim();
}

// "A".."D" / "a".."d" / "1".."4" → chỉ số 0..3; không hợp lệ → -1.
function correctToIndex(raw: string): number {
  const s = raw.trim().toUpperCase();
  if (/^[A-D]$/.test(s)) return s.charCodeAt(0) - 65;
  if (/^[1-4]$/.test(s)) return Number(s) - 1;
  // Tha thứ kiểu "A. ..." hoặc "A)".
  const first = s.charAt(0);
  if (/^[A-D]$/.test(first)) return first.charCodeAt(0) - 65;
  return -1;
}

export function parseQuizWorkbook(buffer: Buffer): ParseResult {
  const errors: string[] = [];
  const rows: ParsedQuestion[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { rows: [], errors: ["Không đọc được file. Hãy lưu đúng định dạng Excel (.xlsx)."] };
  }

  // Ưu tiên sheet "Câu hỏi"; nếu không có thì lấy sheet đầu tiên.
  const sheetName = wb.SheetNames.includes(DATA_SHEET) ? DATA_SHEET : wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { rows: [], errors: ["File không có dữ liệu."] };

  // header:1 → mảng các hàng, mỗi hàng là mảng ô.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  if (grid.length < 2) {
    return { rows: [], errors: ['Sheet "Câu hỏi" chưa có dòng câu hỏi nào.'] };
  }

  // Bỏ hàng tiêu đề (hàng 1). Dòng dữ liệu bắt đầu từ hàng 2 trong Excel.
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const excelRow = i + 1; // số dòng hiển thị trong Excel (1-based, đã tính hàng tiêu đề)

    const prompt = normalize(row[0]);
    const rawCorrect = normalize(row[5]);
    const explanation = normalize(row[6]);
    const raw = [normalize(row[1]), normalize(row[2]), normalize(row[3]), normalize(row[4])];

    // Bỏ qua dòng hoàn toàn trống.
    if (!prompt && raw.every((o) => o === "") && !rawCorrect) continue;

    if (!prompt) {
      errors.push(`Dòng ${excelRow}: thiếu nội dung câu hỏi.`);
      continue;
    }

    // Vị trí đáp án cuối cùng được điền — không cho phép bỏ trống ở giữa.
    let lastFilled = -1;
    for (let k = 0; k < raw.length; k++) if (raw[k] !== "") lastFilled = k;
    let gap = false;
    for (let k = 0; k <= lastFilled; k++) if (raw[k] === "") gap = true;
    if (gap) {
      errors.push(`Dòng ${excelRow}: đáp án bị bỏ trống ở giữa (điền liên tục A, B, C, D).`);
      continue;
    }

    const options = raw.slice(0, lastFilled + 1);
    if (options.length < 2) {
      errors.push(`Dòng ${excelRow}: cần ít nhất 2 đáp án (A và B).`);
      continue;
    }

    if (!rawCorrect) {
      errors.push(`Dòng ${excelRow}: thiếu đáp án đúng (ghi A, B, C hoặc D).`);
      continue;
    }
    const correct = correctToIndex(rawCorrect);
    if (correct < 0) {
      errors.push(`Dòng ${excelRow}: "đáp án đúng" không hợp lệ — chỉ ghi A, B, C hoặc D.`);
      continue;
    }
    if (correct >= options.length) {
      errors.push(
        `Dòng ${excelRow}: đáp án đúng là ${"ABCD"[correct]} nhưng câu này không có đáp án đó.`,
      );
      continue;
    }

    rows.push({ prompt, options, correct_index: correct, explanation });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('Sheet "Câu hỏi" chưa có dòng câu hỏi nào.');
  }

  return { rows, errors };
}
