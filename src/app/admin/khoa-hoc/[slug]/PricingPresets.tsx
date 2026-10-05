"use client";

import { useState } from "react";

// Mẫu giá gợi ý, mốc 1 xu ≈ 100đ. Học viên chăm cày ~1.100 xu/tháng.
//   • Nhập môn: bán cả xu lẫn tiền. 1.200 xu ≈ 1 tháng cày ≈ 100k ở gói xu
//     rẻ nhất, nên chuyển khoản 99k luôn rẻ hơn hoặc bằng → không ai bị hớ.
//     Mở lẻ 150 xu/bài đắt hơn mở cả khóa để khuyến khích mở cả khóa.
//   • Chủ lực: chỉ bán bằng tiền (xu = 0); học phí giữ nguyên coach tự đặt.
// `undefined` = giữ nguyên ô đó.
const PRESETS = [
  {
    key: "intro",
    label: "🌱 Khóa nhập môn",
    hint: "Học phí 99k · 1.200 xu cả khóa · 150 xu/bài · 2 bài học thử",
    values: { price: 99000, free_lessons: 2, lesson_coin_price: 150, course_coin_price: 1200 },
  },
  {
    key: "flagship",
    label: "⭐ Khóa chủ lực",
    hint: "Chỉ bán bằng chuyển khoản (tắt xu) · 3 bài học thử · học phí bạn tự đặt",
    values: { price: undefined, free_lessons: 3, lesson_coin_price: 0, course_coin_price: 0 },
  },
] as const;

// Bấm mẫu → điền sẵn các ô giá trong form đang chứa nó. Chưa lưu gì cả;
// coach xem lại rồi bấm Lưu như bình thường.
export function PricingPresets() {
  const [picked, setPicked] = useState<string | null>(null);

  function apply(e: React.MouseEvent<HTMLButtonElement>, preset: (typeof PRESETS)[number]) {
    const form = e.currentTarget.form;
    if (!form) return;
    for (const [name, value] of Object.entries(preset.values)) {
      const input = form.elements.namedItem(name);
      if (!(input instanceof HTMLInputElement)) continue;
      if (value === undefined) {
        // Chủ lực mà chưa có học phí → nhắc nhập.
        if (!Number(input.value)) input.focus();
        continue;
      }
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setPicked(preset.key);
  }

  const current = PRESETS.find((p) => p.key === picked);

  return (
    <div className="space-y-2">
      <span className="text-xs text-ink/70">Điền nhanh theo mẫu gợi ý:</span>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.hint}
            onClick={(e) => apply(e, p)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
              picked === p.key
                ? "border-ink bg-ink text-paper"
                : "border-ink/15 hover:bg-paper-2"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {current && (
        <p className="text-xs text-amber">
          Đã điền: {current.hint}. Bấm <b>Lưu</b> để áp dụng.
        </p>
      )}
    </div>
  );
}
