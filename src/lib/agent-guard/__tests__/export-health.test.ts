import { describe, expect, it } from "vitest";
import { agentExportDestinationHealth } from "../export-health";

const enabledDestination = {
  status: "enabled" as const,
  automatic_delivery_enabled: false,
  dry_run_enabled: true,
  last_tested_at: null,
};

describe("AgentGuard export destination health", () => {
  it("marks disabled destinations first", () => {
    const health = agentExportDestinationHealth({
      ...enabledDestination,
      status: "disabled",
    });

    expect(health.status).toBe("disabled");
    expect(health.label).toBe("Disabled");
  });

  it("marks failed latest attempts as failing", () => {
    const health = agentExportDestinationHealth(enabledDestination, {
      status: "failed",
      delivery_mode: "automatic",
      http_status: 500,
    });

    expect(health.status).toBe("failing");
    expect(health.summary).toContain("failed");
  });

  it("marks automatic dry-run posture before ready posture", () => {
    const health = agentExportDestinationHealth(
      {
        ...enabledDestination,
        automatic_delivery_enabled: true,
        dry_run_enabled: true,
        last_tested_at: "2026-05-16T12:00:00.000Z",
      },
      {
        status: "succeeded",
        delivery_mode: "manual_test",
        http_status: 200,
      }
    );

    expect(health.status).toBe("dry_run");
  });

  it("marks live automatic posture when dry-run is off", () => {
    const health = agentExportDestinationHealth({
      ...enabledDestination,
      automatic_delivery_enabled: true,
      dry_run_enabled: false,
    });

    expect(health.status).toBe("live");
    expect(health.label).toBe("Live sends");
  });

  it("marks successful tested destinations as ready when automatic export is off", () => {
    const health = agentExportDestinationHealth(enabledDestination, {
      status: "succeeded",
      delivery_mode: "manual_replay",
      http_status: 200,
    });

    expect(health.status).toBe("ready");
  });

  it("marks untouched enabled destinations as not tested", () => {
    const health = agentExportDestinationHealth(enabledDestination);

    expect(health.status).toBe("not_tested");
  });
});
