// Cập nhật chương + bài học của một khóa từ file Excel.
// Dùng chung cho cả route tải file (.xlsx) lẫn server action nhập, để cấu
// trúc cột ở hai nơi luôn khớp nhau.
//
// CHỈ dùng phía server (import "xlsx", không đưa vào client component).
import * as XLSX from "xlsx";

const DATA_SHEET = "Bài học";
const GUIDE_SHEET = "Hướng dẫn";

// Thứ tự cột trong sheet dữ liệu.
const HEADERS = [
  "Chương",
  "Tên bài",
  "Mô tả ngắn",
  "Link video",
  "Link tài liệu",
  "Tên tài liệu",
  "Nội dung",
  "Số phút",
  "Hiện cho học viên (Có/Không)",
  "Mã bài (đừng sửa)",
];

export interface LessonExportRow {
  chapter: string;
  title: string;
  summary: string;
  video_url: string;
  pdf_url: string;
  pdf_name: string;
  content: string;
  est_minutes: number;
  published: boolean;
  slug: string;
}

export interface ParsedLessonRow {
  excelRow: number;
  chapter: string;
  title: string;
  slug: string;
  // null = ô trống → bài đã có thì giữ nguyên giá trị cũ.
  summary: string | null;
  video_url: string | null;
  pdf_url: string | null;
  pdf_name: string | null;
  content: string | null;
  est_minutes: number | null;
  published: boolean | null;
}

export interface LessonParseResult {
  rows: ParsedLessonRow[];
  // Lỗi theo từng dòng (số dòng đúng như trong Excel) — có lỗi thì không nhập gì.
  errors: string[];
}

// ── Tạo file .xlsx ────────────────────────────────────────────
// Sheet "Bài học" điền sẵn bài hiện có của khóa (khóa trống thì chỉ có tiêu
// đề), để coach sửa thẳng trên file rồi tải lên lại.
export function buildLessonWorkbook(current: LessonExportRow[]): Buffer {
  const wb = XLSX.utils.book_new();

  const data = XLSX.utils.aoa_to_sheet([
    HEADERS,
    ...current.map((r) => [
      r.chapter,
      r.title,
      r.summary,
      r.video_url,
      r.pdf_url,
      r.pdf_name,
      r.content,
      r.est_minutes,
      r.published ? "Có" : "Không",
      r.slug,
    ]),
  ]);
  data["!cols"] = [
    { wch: 28 }, // Chương
    { wch: 36 }, // Tên bài
    { wch: 40 }, // Mô tả
    { wch: 32 }, // Video
    { wch: 32 }, // Tài liệu
    { wch: 20 }, // Tên tài liệu
    { wch: 60 }, // Nội dung
    { wch: 9 }, // Số phút
    { wch: 14 }, // Hiện
    { wch: 22 }, // Mã bài
  ];
  XLSX.utils.book_append_sheet(wb, data, DATA_SHEET);

  const guide = XLSX.utils.aoa_to_sheet([
    ["HƯỚNG DẪN CẬP NHẬT BÀI HỌC"],
    [""],
    [`1. Mở sheet "${DATA_SHEET}". Mỗi dòng là MỘT bài học, xếp theo đúng thứ tự muốn hiện.`],
    ['2. Cột bắt buộc: "Tên bài". Cột "Chương" ghi tên chương; bỏ trống = bài không xếp chương.'],
    ["   Các bài cùng chương ghi cùng một tên chương. Chương chưa có sẽ được tạo mới."],
    ["   Thứ tự chương theo lần đầu chương đó xuất hiện trong file."],
    ['3. "Mã bài": file tải về đã điền sẵn cho bài đang có — ĐỪNG sửa, app dùng nó để'],
    ["   nhận ra bài cũ (kể cả khi bạn đổi tên bài). Bài mới thì để trống."],
    ["4. Bài đã có: ô bỏ trống = giữ nguyên nội dung cũ (muốn xóa trắng thì sửa trên app)."],
    ["5. Bài có trên app nhưng không có trong file: KHÔNG bị xóa, xếp sau các bài trong file."],
    ['6. "Nội dung" viết dạng Markdown như ô Nội dung trên app (xuống dòng: Alt+Enter).'],
    ['7. "Số phút": số nguyên (mặc định 5). "Hiện cho học viên": Có / Không (mặc định Có).'],
    ["8. Link video: YouTube / Vimeo / Google Drive. Link tài liệu: link PDF hoặc Google Drive."],
    ["9. Đổi tên chương: sửa trên app (đổi tên trong file sẽ tạo chương mới)."],
    ["10. Giữ nguyên hàng tiêu đề và tên sheet; lưu định dạng .xlsx rồi tải lên."],
    [""],
    ["VÍ DỤ:"],
    HEADERS,
    [
      "Chương 1: Nền tảng",
      "Calo là gì?",
      "Hiểu năng lượng nạp vào và tiêu hao",
      "https://www.youtube.com/watch?v=xxxx",
      "https://drive.google.com/file/d/xxxx/view",
      "Slide bài 1",
      "## Ý chính\n- Calo là đơn vị năng lượng\n- Cân nặng phụ thuộc cân bằng năng lượng",
      8,
      "Có",
      "",
    ],
    ["Chương 1: Nền tảng", "Đạm, tinh bột, chất béo", "", "", "", "", "", 10, "Có", ""],
    ["Chương 2: Thực hành", "Lên thực đơn 1 ngày", "", "", "", "", "", "", "Không", ""],
  ]);
  guide["!cols"] = [
    { wch: 28 }, { wch: 28 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
    { wch: 16 }, { wch: 40 }, { wch: 9 }, { wch: 14 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, guide, GUIDE_SHEET);

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ── Đọc & kiểm tra file tải lên ───────────────────────────────
function cell(s: unknown): string {
  return String(s ?? "").trim();
}

// Ô trống → null (giữ nguyên); có chữ → chuỗi.
function opt(s: unknown): string | null {
  const v = cell(s);
  return v === "" ? null : v;
}

function parseYesNo(raw: string): boolean | null | undefined {
  const s = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim();
  if (s === "") return null;
  if (["co", "c", "x", "yes", "y", "1", "true", "hien"].includes(s)) return true;
  if (["khong", "k", "no", "n", "0", "false", "an"].includes(s)) return false;
  return undefined; // không hiểu
}

function isUrl(s: string) {
  return /^https?:\/\/\S+$/i.test(s);
}

export function parseLessonWorkbook(buffer: Buffer): LessonParseResult {
  const errors: string[] = [];
  const rows: ParsedLessonRow[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { rows: [], errors: ["Không đọc được file. Hãy lưu đúng định dạng Excel (.xlsx)."] };
  }

  const sheetName = wb.SheetNames.includes(DATA_SHEET) ? DATA_SHEET : wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { rows: [], errors: ["File không có dữ liệu."] };

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: "" });
  const seenSlugs = new Set<string>();

  // Bỏ hàng tiêu đề (hàng 1). Dòng dữ liệu bắt đầu từ hàng 2 trong Excel.
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const excelRow = i + 1;
    if (row.every((v) => cell(v) === "")) continue;

    const chapter = cell(row[0]);
    const title = cell(row[1]);
    const slug = cell(row[9]);
    if (!title) {
      errors.push(`Dòng ${excelRow}: thiếu "Tên bài".`);
      continue;
    }

    const video_url = opt(row[3]);
    const pdf_url = opt(row[4]);
    if (video_url && !isUrl(video_url)) {
      errors.push(`Dòng ${excelRow}: "Link video" phải bắt đầu bằng http:// hoặc https://.`);
      continue;
    }
    if (pdf_url && !isUrl(pdf_url)) {
      errors.push(`Dòng ${excelRow}: "Link tài liệu" phải bắt đầu bằng http:// hoặc https://.`);
      continue;
    }

    const rawMinutes = cell(row[7]);
    let est_minutes: number | null = null;
    if (rawMinutes) {
      const n = Number(rawMinutes.replace(",", "."));
      if (!Number.isFinite(n) || n < 1 || n > 600) {
        errors.push(`Dòng ${excelRow}: "Số phút" phải là số từ 1 đến 600.`);
        continue;
      }
      est_minutes = Math.round(n);
    }

    const published = parseYesNo(cell(row[8]));
    if (published === undefined) {
      errors.push(`Dòng ${excelRow}: cột "Hiện cho học viên" chỉ ghi Có hoặc Không.`);
      continue;
    }

    if (slug) {
      if (seenSlugs.has(slug)) {
        errors.push(`Dòng ${excelRow}: "Mã bài" ${slug} bị lặp — mỗi bài chỉ một dòng.`);
        continue;
      }
      seenSlugs.add(slug);
    }

    rows.push({
      excelRow,
      chapter,
      title,
      slug,
      summary: opt(row[2]),
      video_url,
      pdf_url,
      pdf_name: opt(row[5]),
      // Nội dung giữ nguyên xuống dòng; chỉ bỏ khoảng trắng hai đầu.
      content: opt(row[6]),
      est_minutes,
      published,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push(`Sheet "${DATA_SHEET}" chưa có dòng bài học nào.`);
  }
  return { rows, errors };
}
