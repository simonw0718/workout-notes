// /next.config.ts
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig: any = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  compiler: isProd ? { removeConsole: { exclude: ["error", "warn"] } } : {},
};

// ⚠️ dev 區網白名單（只在非 prod 生效）
if (!isProd) {
  // @ts-ignore - allow Next internal dev options
  nextConfig.experimental = {
    allowedOriginRegex:
      "^https?://(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|192\\.168\\.[0-9]{1,3}\\.[0-9]{1,3})(?::\\d+)?$",
    allowedDevOrigins: ["https://192.168.31.241:3443"],
  };

  // ✅ 只有在「沒有」設定 NEXT_PUBLIC_HIIT_API_BASE 時，才啟用 dev 代理
  if (!process.env.NEXT_PUBLIC_HIIT_API_BASE) {
    nextConfig.rewrites = async () => [
      {
        source: "/api/hiit/:path*",
        destination: "http://localhost:8000/api/hiit/:path*",
      },
    ];
  }
}

export default nextConfig;