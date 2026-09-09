// Chuyển tiếng Việt có dấu → slug ascii (cho URL).
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ dấu thanh
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Sinh mật khẩu tạm dễ đọc cho học viên.
export function tempPassword(): string {
  const words = ["bep", "com", "rau", "ca", "trung", "dau", "khoe", "tuoi"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}-${n}`;
}

// Mật khẩu ngẫu nhiên "thật" cho tài khoản khách mời (10 ký tự, có
// chữ hoa/thường/số). Bỏ các ký tự dễ nhìn nhầm (O/0, I/l/1) để học
// viên chép tay từ email không bị sai.
export function randomPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Suy tên hiển thị từ email: "nguyen.van.a@gmail.com" → "Nguyen Van A".
// Bỏ phần sau @, tách theo . _ - + và số, rồi viết hoa đầu mỗi từ.
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[._+-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return local;
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Tách một mớ email dán vào ô nhập (xuống dòng / dấu phẩy / chấm phẩy /
// khoảng trắng) thành danh sách hợp lệ + danh sách sai định dạng.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseEmails(raw: string): { emails: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const t = token.trim().toLowerCase();
    if (!t) continue;
    if (!EMAIL_RE.test(t)) {
      if (!invalid.includes(t)) invalid.push(t);
      continue;
    }
    if (seen.has(t)) continue;
    seen.add(t);
    emails.push(t);
  }
  return { emails, invalid };
}
