/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose'
  },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: "canvas" }]; // required to make pdfjs work
    return config;
  },
  // Enable static export for GitHub Pages deployment
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Configure base path for GitHub Pages deployment
  basePath: '/cocktail-vision',
};

module.exports = nextConfig;