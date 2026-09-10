import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

// Thêm vào màn hình chính điện thoại thì mở như một app riêng
// (không có thanh địa chỉ trình duyệt), nền/thanh trạng thái màu giấy.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description:
      "Học viện dinh dưỡng & tập luyện — học từng buổi, tiến bộ thật.",
    start_url: "/hoc",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f2ea",
    theme_color: "#f6f2ea",
    lang: "vi",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/logo.png", sizes: "200x200", type: "image/png" },
    ],
  };
}
