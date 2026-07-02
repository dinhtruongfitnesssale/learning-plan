import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer dùng API Node thuần → không bundle, require thẳng ở server.
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
