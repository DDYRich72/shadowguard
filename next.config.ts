import type { NextConfig } from "next";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

function configuredSupabaseOrigins(): { http: string[]; websocket: string[] } {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) return { http: [], websocket: [] };

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { http: [], websocket: [] };
    }

    const websocket = new URL(url.origin);
    websocket.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return { http: [url.origin], websocket: [websocket.origin] };
  } catch {
    return { http: [], websocket: [] };
  }
}

const SUPABASE_ORIGINS = configuredSupabaseOrigins();
const cspSources = (...sources: string[]) => sources.filter(Boolean).join(" ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${IS_DEVELOPMENT ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      cspSources("img-src 'self' data: blob:", ...SUPABASE_ORIGINS.http),
      "font-src 'self' data:",
      cspSources(
        "connect-src 'self'",
        ...SUPABASE_ORIGINS.http,
        ...SUPABASE_ORIGINS.websocket,
        "https://challenges.cloudflare.com"
      ),
      "frame-src https://challenges.cloudflare.com",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      { source: "/pricing", destination: "/", permanent: true },
      {
        source: "/dashboard/upgrade/agent-guard",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
