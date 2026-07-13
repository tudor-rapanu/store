import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

function getHostname(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

const isDev = process.env.NODE_ENV !== "production";
const r2PublicHost = getHostname(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : null,
  "https://cdn.sameday.ro",
  "https://v.toddsthreads.com",
  "https://eu-assets.i.posthog.com",
  "https://static.cloudflareinsights.com",
].filter(Boolean);
const connectSrc = [
  "'self'",
  "https://v.toddsthreads.com",
  "https://eu.i.posthog.com",
  "https://eu-assets.i.posthog.com",
  "https://cloudflareinsights.com",
  "https://*.sameday.ro",
  "wss:",
  isDev ? "http:" : null,
  isDev ? "https:" : null,
].filter(Boolean);
const imgSrc = [
  "'self'",
  "data:",
  "blob:",
  "https://mny.ro",
  "https://kitamaru.ro",
  "https://pub-144713e90af247dbb1cb8d0e06c37159.r2.dev",
  r2PublicHost ? `https://${r2PublicHost}` : null,
].filter(Boolean);
const styleSrc = [
  "'self'",
  "'unsafe-inline'",
  "https://cdn.sameday.ro",
].filter(Boolean);
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  `style-src ${styleSrc.join(" ")}`,
  `img-src ${imgSrc.join(" ")}`,
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(" ")}`,
  "frame-src 'self' https://lockerplugin.sameday.ro https://*.sameday.ro",
  "child-src 'self' https://lockerplugin.sameday.ro https://*.sameday.ro",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://secure.mobilpay.ro https://secure.sandbox.netopia-payments.com",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "dev.toddsthreads.com",
    "https://dev.toddsthreads.com",
    "https://todds-threads-service-926730476454.europe-west4.run.app",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self "https://lockerplugin.sameday.ro")',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/:locale(en|ro)/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/:locale(en|ro)/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/:locale(en|ro)/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-144713e90af247dbb1cb8d0e06c37159.r2.dev",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
});

export default withNextIntl(nextConfig);
