/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["googleapis", "pdf-parse", "pdfjs-dist"],
  },
};

module.exports = nextConfig;
