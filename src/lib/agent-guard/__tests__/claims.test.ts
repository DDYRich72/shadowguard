import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSourceTree(relativeDirectory: string): string {
  const root = path.join(process.cwd(), relativeDirectory);
  const files = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => {
      const pathSegments = file.replace(/\\/g, "/").split("/");
      return /\.(?:ts|tsx)$/.test(file) && !pathSegments.includes("__tests__");
    })
    .map((file) => path.join(root, file));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function claimSurface(): string {
  return [
    readSourceTree("src/lib/agent-guard"),
    readSourceTree("src/app/dashboard/agent-guard"),
  ].join("\n");
}

describe("AgentGuard open-source claim surface", () => {
  it("does not restore commercial or owner-operated semantics", () => {
    const text = claimSurface();

    for (const prohibited of [
      "plan_upgrade_required",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_",
      "ASSESSMENT_ORDER_OPERATOR_EMAILS",
      "support@shadowguard",
      "security@shadowguard",
      "https://shadowguard.example",
      "/dashboard/upgrade/agent-guard",
    ]) {
      expect(text).not.toContain(prohibited);
    }
  });

  it("anchors behavior to submitted activity and scoped source keys", () => {
    const text = claimSurface().toLowerCase();
    expect(text).toContain("submitted activity");
    expect(text).toContain("source key");
    expect(text).toContain("allowed tool");
    expect(text).toContain("metadata-only");
  });

  it("keeps non-automation and customer-owned integration boundaries", () => {
    const text = claimSurface().toLowerCase();
    expect(text).toContain("not a browser collector");
    expect(text).toContain("not a managed connector");
    expect(text).toContain("customer-controlled");
    expect(text).toContain("not legal advice");
    expect(text).toContain("not a compliance determination");
    expect(text).toContain("not a security warranty");
  });

  it("keeps integration examples free of live source and export secrets", () => {
    const text = claimSurface();
    expect(text).toContain("AGENTGUARD_INGEST_TOKEN");
    expect(text).toContain("SHADOWGUARD_APP_URL");
    expect(text).not.toMatch(/sgag_[A-Za-z0-9_-]{20,}/);
    expect(text).not.toMatch(/sgae_[A-Za-z0-9_-]{20,}/);
    expect(text).not.toContain("localStorage.setItem");
    expect(text).not.toContain("document.cookie =");
  });
});
