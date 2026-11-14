/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, webpack }) => {
    // pdf.js (used for the in-app document preview) optionally requires the
    // Node-only "canvas" package. The browser build never needs it.
    config.resolve.alias.canvas = false;

    if (!isServer) {
      // pptxgenjs (used to save the year in review as a PowerPoint) reaches for Node's
      // "node:fs" / "node:https" in code that only runs on a server. In the browser those
      // are not needed, so point them at an empty module instead of failing the build.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        os: false,
        path: false,
        "image-size": false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
