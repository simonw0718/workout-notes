// /next.config.ts
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig: any = {
  // ✅ 純靜態輸出（Cloudflare Pages 用 out/）
  output: "export",

  // ✅ 靜態環境關掉影像優化
  images: { unoptimized: true },

  // URL 格式維持現況
  trailingSlash: false,

  // 🔕 建置不擋：型別 / ESLint
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // 🧹 正式環境的小最佳化（不影響功能）
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  // 在正式環境才移除 console（保留 error/warn）
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

  // ✅ 只有在「沒有」設定 NEXT_PUBLIC_API_BASE 時，才啟用 dev 代理
  if (!process.env.NEXT_PUBLIC_API_BASE) {
    nextConfig.rewrites = async () => [
      {
        source: "/api/hiit/:path*",
        destination: "http://localhost:8000/api/hiit/:path*", // 你的 FastAPI/uvicorn
      },
      // 如需其他既有 API 一起代理，可在這裡繼續加
    ];
  }
}

export default nextConfig;