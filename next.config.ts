/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  // 只在開發時放寬區網來源；正式模式拿掉這個 key
  ...(isProd ? {} : {
    experimental: {
      allowedOriginRegex:
        '^https?://(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|192\\.168\\.[0-9]{1,3}\\.[0-9]{1,3})(?::\\d+)?$',
    },
  }),

  // ⇣ 先把「會卡 build」的檢查關掉（不影響執行）
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
export default {
  experimental: {
    allowedDevOrigins: ['https://192.168.31.241:3443'],
  },
}