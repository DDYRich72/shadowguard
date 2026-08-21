import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ limit: query })),
    })),
  })),
}));

import { GET, readHealthConfiguration } from "../route";

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  APP_BASE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-role-key",
};

describe("health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, validEnv);
  });

  it("rejects missing or invalid core configuration", () => {
    expect(readHealthConfiguration({ ...validEnv, APP_BASE_URL: "file:///tmp/app" })).toBeNull();
    expect(
      readHealthConfiguration({ ...validEnv, SUPABASE_SERVICE_ROLE_KEY: "" })
    ).toBeNull();
  });

  it("returns 200 only when the database responds without an error", async () => {
    query.mockResolvedValueOnce({ error: null });

    const result = await GET();

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: "ok" });
    expect(result.headers.get("cache-control")).toContain("no-store");
  });

  it("returns a sanitized 503 for database errors", async () => {
    query.mockResolvedValueOnce({ error: { message: "sensitive database detail" } });

    const result = await GET();

    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ status: "unavailable" });
  });
});
