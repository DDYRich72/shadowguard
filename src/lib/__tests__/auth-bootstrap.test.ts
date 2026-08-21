import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  existingUser: null as null | { id: string; org_id: string; role: string },
  orgSequence: 0,
  organizationInserts: [] as Array<Record<string, unknown>>,
  userUpserts: [] as Array<Record<string, unknown>>,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      if (table === "organizations") {
        return {
          insert: (value: Record<string, unknown>) => {
            mocks.organizationInserts.push(value);
            mocks.orgSequence += 1;
            return {
              select: () => ({
                single: async () => ({
                  data: { id: `organization-${mocks.orgSequence}` },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mocks.existingUser }),
            }),
          }),
          upsert: async (value: Record<string, unknown>) => {
            mocks.userUpserts.push(value);
            return { error: null };
          },
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { bootstrapUser } from "../auth-bootstrap";

describe("bootstrapUser", () => {
  beforeEach(() => {
    mocks.existingUser = null;
    mocks.orgSequence = 0;
    mocks.organizationInserts.length = 0;
    mocks.userUpserts.length = 0;
  });

  it("creates isolated admin organizations for users with the same email domain", async () => {
    const first = await bootstrapUser({
      userId: "user-1",
      email: "one@example.com",
      orgName: "First Team",
      authProvider: "email",
    });
    const second = await bootstrapUser({
      userId: "user-2",
      email: "two@example.com",
      orgName: "Second Team",
      authProvider: "google",
    });

    expect(first).toMatchObject({ ok: true, orgId: "organization-1", role: "admin" });
    expect(second).toMatchObject({ ok: true, orgId: "organization-2", role: "admin" });
    expect(mocks.organizationInserts).toEqual([
      expect.objectContaining({ name: "First Team", domain: "example.com", owner_user_id: "user-1" }),
      expect.objectContaining({ name: "Second Team", domain: "example.com", owner_user_id: "user-2" }),
    ]);
    expect(mocks.userUpserts).toEqual([
      expect.objectContaining({ id: "user-1", org_id: "organization-1", role: "admin" }),
      expect.objectContaining({ id: "user-2", org_id: "organization-2", role: "admin" }),
    ]);
  });

  it("keeps an existing bootstrap idempotent", async () => {
    mocks.existingUser = { id: "user-1", org_id: "organization-existing", role: "manager" };

    const result = await bootstrapUser({
      userId: "user-1",
      email: "one@example.com",
      authProvider: "email",
    });

    expect(result).toEqual({
      ok: true,
      orgId: "organization-existing",
      role: "manager",
      alreadyBootstrapped: true,
    });
    expect(mocks.organizationInserts).toHaveLength(0);
    expect(mocks.userUpserts).toHaveLength(0);
  });
});
