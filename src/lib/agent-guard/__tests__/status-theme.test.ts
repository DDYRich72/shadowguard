import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_CONCERN_SEVERITY_TONES,
  AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES,
  AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES,
  AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES,
  AGENT_GUARD_PILOT_STATUS_TONES,
  AGENT_GUARD_STATUS_BADGE_CLASSES,
  AGENT_GUARD_STATUS_LABEL_CLASSES,
  AGENT_GUARD_STATUS_SURFACE_CLASSES,
  AGENT_GUARD_STATUS_TONES,
} from "../status-theme";

describe("AgentGuard status theme", () => {
  it("defines reusable classes for every semantic tone", () => {
    for (const tone of AGENT_GUARD_STATUS_TONES) {
      expect(AGENT_GUARD_STATUS_SURFACE_CLASSES[tone]).toContain(
        `sg-status-surface-${tone}`
      );
      expect(AGENT_GUARD_STATUS_BADGE_CLASSES[tone]).toContain(
        `sg-status-badge-${tone}`
      );
      expect(AGENT_GUARD_STATUS_LABEL_CLASSES[tone]).toContain(
        `sg-status-accent-${tone}`
      );
    }
  });

  it("keeps red and amber card bodies off legacy matching tint utilities", () => {
    for (const tone of ["red", "amber"] as const) {
      const surfaceClass = AGENT_GUARD_STATUS_SURFACE_CLASSES[tone];

      expect(surfaceClass).toContain("sg-status-surface");
      expect(surfaceClass).not.toMatch(/\bbg-(red|amber)-50\b/);
      expect(surfaceClass).not.toMatch(/\btext-(red|amber)-[0-9]+/);
    }
  });

  it("maps AgentGuard warning and danger states to semantic tones", () => {
    expect(AGENT_GUARD_PILOT_STATUS_TONES.needs_review).toBe("amber");
    expect(AGENT_GUARD_PILOT_STATUS_TONES.live_caution).toBe("red");
    expect(AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES.needs_review).toBe(
      "amber"
    );
    expect(AGENT_GUARD_ENTERPRISE_SETUP_STATUS_TONES.live_caution).toBe("red");
    expect(AGENT_GUARD_ENTERPRISE_STEP_STATUS_TONES.attention).toBe("amber");
    expect(AGENT_GUARD_HANDOFF_ARTIFACT_STATUS_TONES.gap).toBe("red");
    expect(AGENT_GUARD_CONCERN_SEVERITY_TONES.blocked).toBe("red");
    expect(AGENT_GUARD_CONCERN_SEVERITY_TONES.live_caution).toBe("red");
  });

  it("keeps legacy dark-mode red and amber text readable", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/app/globals.css"),
      "utf8"
    );

    expect(css).toContain(".dark .text-red-800");
    expect(css).toContain(".dark .text-amber-800");
  });
});
