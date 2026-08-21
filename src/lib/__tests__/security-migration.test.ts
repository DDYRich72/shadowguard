import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(migrationDirectory).filter((file) => file.endsWith(".sql"));
const schema = readFileSync(
  path.join(migrationDirectory, migrations[0]),
  "utf8"
).replace(/\r\n/g, "\n");

describe("fresh-install schema security", () => {
  it("ships one initial migration without commercial schema", () => {
    expect(migrations).toEqual(["20260820183952_initial_schema.sql"]);
    expect(schema).not.toMatch(/stripe|billing_events|plan_tier|plan_product|assessment_orders/i);
  });

  it("enables RLS on every public application table", () => {
    const tables = [...schema.matchAll(/^CREATE TABLE IF NOT EXISTS ([a-z_]+)/gm)].map(
      ([, table]) => table
    );
    const rlsTables = new Set(
      [...schema.matchAll(/^ALTER TABLE\s+([a-z_]+)\s+ENABLE ROW LEVEL SECURITY;/gm)].map(
        ([, table]) => table
      )
    );

    expect(tables.length).toBeGreaterThan(20);
    expect(tables.filter((table) => !rlsTables.has(table))).toEqual([]);
  });

  it("keeps role and AAL2-aware organization mutation policies", () => {
    expect(schema.indexOf("CREATE OR REPLACE FUNCTION current_org_id()"))
      .toBeLessThan(schema.indexOf("USING (org_id = current_org_id())"));
    expect(schema).toContain("current_user_can_mutate_org()");
    expect(schema).toContain("current_user_has_aal2()");
    expect(schema).toContain("(auth.jwt() ->> 'aal') = 'aal2'");
    expect(schema).toContain("'agent_activities'");
    expect(schema).toContain("'scan_app_results'");
    expect(schema).toContain("'mcp_servers'");
    expect(schema).toContain("'mcp_tools'");
    expect(schema).toContain("'mcp_tool_events'");
    expect(schema).toContain("'org managers mutate ' || table_name");
  });

  it("keeps explicit membership assignment database-operator-only", () => {
    expect(schema).toContain(
      "private.assign_organization_member(\n  target_user_id UUID,\n  target_org_id UUID,\n  target_role TEXT,\n  expected_current_org_id UUID"
    );
    expect(schema).toContain(
      "REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role"
    );
    expect(schema).toContain("target_role NOT IN ('viewer', 'manager', 'admin')");
    expect(schema).toContain("expected_current_org_id IS NULL");
    expect(schema).toContain(
      "current_member_org_id IS DISTINCT FROM expected_current_org_id"
    );
    expect(schema).toContain("email_confirmed_at IS NOT NULL");
    expect(schema).toContain("FOR UPDATE OF member");
    expect(schema).not.toContain("ON CONFLICT (id) DO UPDATE");
    expect(schema).toContain("'organization.member.assign'");
    expect(schema).toContain(
      "REVOKE ALL ON FUNCTION private.assign_organization_member(UUID, UUID, TEXT, UUID)\n  FROM PUBLIC, anon, authenticated, service_role"
    );
    expect(schema).not.toMatch(
      /GRANT EXECUTE ON FUNCTION (?:[a-z_]+\.)?assign_organization_member/
    );
  });

  it("explicitly exposes authenticated data access while denying anonymous table access", () => {
    expect(schema).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
    expect(schema).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated"
    );
    expect(schema).toContain(
      "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role"
    );
    expect(schema).toContain(
      "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role"
    );
    expect(schema).not.toContain("auth.role()");
    expect(schema).not.toContain("raw_user_meta_data");
  });
});
