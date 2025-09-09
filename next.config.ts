const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  // ⚙️ 靜態輸出：產物會在 out/
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,

  // 🧯 build 檢查先關掉（不影響執行）
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // 🧪 開發環境：允許區網存取
  ...(isProd
    ? {}
    : {
        experimental: {
          allowedOriginRegex:
            "^https?://(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|192\\.168\\.[0-9]{1,3}\\.[0-9]{1,3})(?::\\d+)?$",
          allowedDevOrigins: ["https://192.168.31.241:3443"],
        },
      }),
};

export default nextConfig;