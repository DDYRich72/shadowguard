import { describe, expect, it } from "vitest";
import {
  buildScanDelta,
  hasChanges,
  recordFromRow,
  toScanDeltaSection,
  SIGNIFICANT_RISK_CHANGE,
  type ScanAppRecord,
} from "../scan-delta";

function app(overrides: Partial<ScanAppRecord> = {}): ScanAppRecord {
  return {
    canonicalName: "chatgpt",
    appName: "ChatGPT",
    isAiTool: true,
    riskScore: 50,
    riskLevel: "medium",
    scopes: ["openid", "email"],
    userCount: 5,
    sourcePlatforms: ["google"],
    ...overrides,
  };
}

describe("buildScanDelta", () => {
  it("detects a new app", () => {
    const delta = buildScanDelta([], [app()]);
    expect(delta.newApps).toHaveLength(1);
    expect(delta.summary.newApps).toBe(1);
    expect(delta.summary.newAiTools).toBe(1);
    expect(delta.removedApps).toHaveLength(0);
  });

  it("counts non-AI new apps separately from new AI tools", () => {
    const delta = buildScanDelta(
      [],
      [app(), app({ canonicalName: "zoom", appName: "Zoom", isAiTool: false })]
    );
    expect(delta.summary.newApps).toBe(2);
    expect(delta.summary.newAiTools).toBe(1);
  });

  it("detects a removed app", () => {
    const delta = buildScanDelta([app()], []);
    expect(delta.removedApps).toHaveLength(1);
    expect(delta.summary.removedApps).toBe(1);
    expect(delta.newApps).toHaveLength(0);
  });

  it("detects risk increases and flags significant ones", () => {
    const delta = buildScanDelta(
      [app({ riskScore: 40 })],
      [app({ riskScore: 40 + SIGNIFICANT_RISK_CHANGE })]
    );
    expect(delta.riskIncreases).toHaveLength(1);
    expect(delta.riskIncreases[0].previousScore).toBe(40);
    expect(delta.riskIncreases[0].change).toBe(SIGNIFICANT_RISK_CHANGE);
    expect(delta.riskIncreases[0].significant).toBe(true);
    expect(delta.summary.riskIncreased).toBe(1);
  });

  it("detects small risk decreases without the significant flag", () => {
    const delta = buildScanDelta(
      [app({ riskScore: 40 })],
      [app({ riskScore: 37 })]
    );
    expect(delta.riskDecreases).toHaveLength(1);
    expect(delta.riskDecreases[0].change).toBe(-3);
    expect(delta.riskDecreases[0].significant).toBe(false);
    expect(delta.summary.riskDecreased).toBe(1);
  });

  it("detects scope additions but not removals", () => {
    const delta = buildScanDelta(
      [app({ scopes: ["openid"] })],
      [app({ scopes: ["openid", "mail.read"] })]
    );
    expect(delta.scopeAdditions).toHaveLength(1);
    expect(delta.scopeAdditions[0].addedScopes).toEqual(["mail.read"]);

    const shrunk = buildScanDelta(
      [app({ scopes: ["openid", "mail.read"] })],
      [app({ scopes: ["openid"] })]
    );
    expect(shrunk.scopeAdditions).toHaveLength(0);
  });

  it("detects adoption growth and shrink with net user change", () => {
    const delta = buildScanDelta(
      [app({ userCount: 5 }), app({ canonicalName: "claude", appName: "Claude", userCount: 4 })],
      [app({ userCount: 9 }), app({ canonicalName: "claude", appName: "Claude", userCount: 2 })]
    );
    expect(delta.adoptionChanges).toHaveLength(2);
    // Sorted by absolute change: +4 first, -2 second.
    expect(delta.adoptionChanges[0].change).toBe(4);
    expect(delta.adoptionChanges[1].change).toBe(-2);
    expect(delta.summary.netUserChange).toBe(2);
  });

  it("returns a zero delta for identical scans", () => {
    const records = [app(), app({ canonicalName: "claude", appName: "Claude" })];
    const delta = buildScanDelta(records, records);
    expect(hasChanges(delta)).toBe(false);
    expect(delta.summary).toEqual({
      newApps: 0,
      newAiTools: 0,
      removedApps: 0,
      riskIncreased: 0,
      riskDecreased: 0,
      scopeExpansions: 0,
      netUserChange: 0,
    });
  });

  it("matches canonical names case-insensitively", () => {
    const delta = buildScanDelta(
      [app({ canonicalName: "ChatGPT " })],
      [app({ canonicalName: "chatgpt" })]
    );
    expect(delta.newApps).toHaveLength(0);
    expect(delta.removedApps).toHaveLength(0);
  });

  it("sorts new apps by risk score descending", () => {
    const delta = buildScanDelta(
      [],
      [
        app({ canonicalName: "low", appName: "Low", riskScore: 10 }),
        app({ canonicalName: "high", appName: "High", riskScore: 90 }),
      ]
    );
    expect(delta.newApps[0].appName).toBe("High");
  });
});

describe("toScanDeltaSection", () => {
  it("caps lists and keeps only serializable fields", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      app({ canonicalName: `tool-${i}`, appName: `Tool ${i}`, riskScore: i })
    );
    const delta = buildScanDelta([], many);
    const section = toScanDeltaSection(delta, "2026-03-01T00:00:00Z", "2026-06-01T00:00:00Z");
    expect(section.newApps).toHaveLength(10);
    expect(section.summary.newApps).toBe(15);
    expect(section.fromScannedAt).toBe("2026-03-01T00:00:00Z");
    expect(section.newApps[0]).toEqual({
      appName: "Tool 14",
      isAiTool: true,
      riskLevel: "medium",
      userCount: 5,
    });
  });
});

describe("recordFromRow", () => {
  it("maps a DB row with nulls to safe defaults", () => {
    const rec = recordFromRow({
      canonical_name: "chatgpt",
      app_name: "ChatGPT",
      is_ai_tool: null,
      risk_score: null,
      risk_level: "bogus",
      scopes: null,
      user_count: null,
      source_platforms: null,
    });
    expect(rec).toEqual({
      canonicalName: "chatgpt",
      appName: "ChatGPT",
      isAiTool: false,
      riskScore: 0,
      riskLevel: "low",
      scopes: [],
      userCount: 0,
      sourcePlatforms: [],
    });
  });
});
