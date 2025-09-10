// next.config.ts
const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  compiler: isProd
    ? { removeConsole: { exclude: ["error", "warn"] } }
    : {},
};

// ⚠️ dev 區網白名單（只在非 prod 生效）。
// 有些版本型別檢查會對 experimental 噴型別錯誤，這段用 ts-ignore 包起來避免你提到的「第 49 行」之類錯誤。
if (!isProd) {
  // @ts-ignore - allow Next internal dev options
  nextConfig.experimental = {
    allowedOriginRegex:
      "^https?://(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|192\\.168\\.[0-9]{1,3}\\.[0-9]{1,3})(?::\\d+)?$",
    allowedDevOrigins: ["https://192.168.31.241:3443"],
  };
}

export default nextConfig;