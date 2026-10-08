/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdf.js (used for the in-app document preview) optionally requires the
    // Node-only "canvas" package. The browser build never needs it.
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
