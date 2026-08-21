export const UNSAFE_API_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type ApiMutationOriginDecision =
  | { allowed: true; reason: "safe_method" | "same_origin" | "server_to_server" }
  | {
      allowed: false;
      reason: "cross_site_fetch" | "invalid_origin" | "origin_mismatch";
    };

export function evaluateApiMutationOrigin(input: {
  method: string;
  url: string;
  headers: Headers;
}): ApiMutationOriginDecision {
  const method = input.method.toUpperCase();
  if (!UNSAFE_API_METHODS.has(method)) {
    return { allowed: true, reason: "safe_method" };
  }

  const fetchSite = input.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return { allowed: false, reason: "cross_site_fetch" };
  }

  const origin = input.headers.get("origin");
  if (!origin) {
    return { allowed: true, reason: "server_to_server" };
  }
  if (origin.toLowerCase() === "null") {
    return { allowed: false, reason: "invalid_origin" };
  }

  try {
    const requestOrigin = new URL(input.url).origin;
    const suppliedOrigin = new URL(origin).origin;
    if (suppliedOrigin !== requestOrigin) {
      return { allowed: false, reason: "origin_mismatch" };
    }
  } catch {
    return { allowed: false, reason: "invalid_origin" };
  }

  return { allowed: true, reason: "same_origin" };
}
