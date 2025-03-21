/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose'
  },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: "canvas" }]; // required to make pdfjs work
    return config;
  },
  // For Vercel deployment, we don't need static export
  // output: 'export',
  images: {
    unoptimized: true,
  },
  // For Vercel deployment, we don't need a base path
  // basePath: '/cocktail-vision',
};

module.exports = nextConfig;