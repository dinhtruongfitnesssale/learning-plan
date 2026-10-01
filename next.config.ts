import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Ảnh QR chuyển khoản do vietqr.io sinh theo số tiền + mã đơn.
    remotePatterns: [{ protocol: "https", hostname: "img.vietqr.io" }],
  },
  // nodemailer dùng API Node thuần → không bundle, require thẳng ở server.
  serverExternalPackages: ["nodemailer"],
  experimental: {
    // Gửi mail có đính kèm ảnh → nâng giới hạn body của Server Action (mặc định 1MB).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
