/**
 * Next.js 16 "proxy" (formerly middleware.ts).
 *
 * Runs on every request matched below. Three jobs:
 *   1. Reject cross-site browser-originated API mutations.
 *   2. Keep the Supabase session cookie fresh.
 *   3. Redirect unauthenticated traffic on /dashboard/** to /login.
 *
 * Auth checks for Route Handlers / Server Actions live inside those
 * handlers too (see the warning in next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md): proxy matchers can silently skip paths
 * after refactors, so don't rely on it alone.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { evaluateApiMutationOrigin } from "@/lib/security";

// Pure UUID-ish generator without pulling node:crypto into the edge
// runtime. 8 hex chars from Web Crypto is enough collision-resistance
// for per-request tracing.
function shortRequestId(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function proxy(request: NextRequest) {
  // Inject a correlation id into the request + response headers.
  // If the caller already supplied one (mobile client, internal
  // service), respect it so traces span the whole call chain.
  const incomingId = request.headers.get("x-request-id");
  const reqId = incomingId && /^[\w-]{4,64}$/.test(incomingId)
    ? incomingId
    : `req_${shortRequestId()}`;
  request.headers.set("x-request-id", reqId);

  const path = request.nextUrl.pathname;

  // The health route must be able to report missing or invalid application
  // configuration itself instead of failing while Proxy constructs a client.
  if (path === "/api/health") {
    const healthResponse = NextResponse.next({ request });
    healthResponse.headers.set("x-request-id", reqId);
    return healthResponse;
  }

  if (path.startsWith("/api/")) {
    const decision = evaluateApiMutationOrigin({
      method: request.method,
      url: request.url,
      headers: request.headers,
    });

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: "invalid_request_origin",
          message: "Cross-site browser API mutations are not allowed.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
            "x-request-id": reqId,
          },
        }
      );
    }
  }

  let response = NextResponse.next({ request });
  response.headers.set("x-request-id", reqId);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          response.headers.set("x-request-id", reqId);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = path.startsWith("/dashboard");

  if (isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("x-request-id", reqId);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets, images, and favicon.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
