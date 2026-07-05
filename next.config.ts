import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer dùng API Node thuần → không bundle, require thẳng ở server.
  serverExternalPackages: ["nodemailer"],
  experimental: {
    // Gửi mail có đính kèm ảnh → nâng giới hạn body của Server Action (mặc định 1MB).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
