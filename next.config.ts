import type { NextConfig } from "next";

// Port Vercel — remplace netlify.toml :
// - rewrites : le client PWA (public/js/app.js) appelle /.netlify/functions/<nom>
//   sans modification -> reecrit vers les routes API /api/fn/<nom>
// - headers  : reprend les en-tetes de securite et de cache de netlify.toml
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: '.'
  },
  async rewrites() {
    return [
      {
        source: "/.netlify/functions/:name",
        destination: "/api/fn/:name",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/OneSignalSDKWorker.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
