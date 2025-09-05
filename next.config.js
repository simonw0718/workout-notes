/** @type {import('next').NextConfig} */
const nextConfig = {
  // 給手機在區網開發時存取 /_next/* 用
  allowedDevOrigins: ['http://192.168.31.241:3000'],
};

module.exports = nextConfig;