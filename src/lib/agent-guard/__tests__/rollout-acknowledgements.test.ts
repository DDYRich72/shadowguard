import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY,
  isMissingRolloutAcknowledgementsTable,
  latestRolloutAcknowledgementBySource,
  rolloutAcknowledgementRowToApi,
  type AgentGuardRolloutAcknowledgementRow,
} from "../rollout-acknowledgements";

function row(
  overrides: Partial<AgentGuardRolloutAcknowledgementRow> = {}
): AgentGuardRolloutAcknowledgementRow {
  return {
    id: "ack-1",
    source_id: "550e8400-e29b-41d4-a716-446655440000",
    source_name: "Production wrapper",
    source_environment: "production",
    source_status: "active",
    source_rollout_status: "ready_for_pilot",
    source_rollout_label: "Ready for pilot",
    source_next_step: "Ready for a controlled pilot.",
    overall_rollout_status: "ready_for_pilot",
    overall_rollout_label: "Ready for pilot",
    export_posture_label: "Dry-run export",
    export_warning: null,
    checklist_snapshot: [
      {
        id: "policy_coverage",
        label: "Policy coverage",
        status: "pass",
        summary: "Production source activity has recent policy outcomes.",
      },
    ],
    metrics_snapshot: {
      activeSourceCount: 1,
      activeProductionSourceCount: 1,
      recentActivitySourceCount: 1,
      policyOutcomeSourceCount: 1,
      needsReviewSourceCount: 0,
      needsActionReviewCount: 0,
      liveExportDestinationCount: 0,
      failingExportDestinationCount: 0,
    },
    note: "Reviewed with dry-run receiver still on.",
    acknowledged_by_user_id: "660e8400-e29b-41d4-a716-446655440000",
    acknowledged_by_email: "operator@example.com",
    created_at: "2026-05-16T18:00:00.000Z",
    ...overrides,
  };
}

describe("AgentGuard rollout acknowledgements", () => {
  it("maps database rows to API fields without losing snapshot detail", () => {
    const acknowledgement = rolloutAcknowledgementRowToApi(row());

    expect(acknowledgement).toMatchObject({
      id: "ack-1",
      sourceId: "550e8400-e29b-41d4-a716-446655440000",
      sourceName: "Production wrapper",
      sourceRolloutStatus: "ready_for_pilot",
      overallRolloutStatus: "ready_for_pilot",
      exportPostureLabel: "Dry-run export",
      note: "Reviewed with dry-run receiver still on.",
      acknowledgedByEmail: "operator@example.com",
    });
    expect(acknowledgement.checklistSnapshot[0]?.id).toBe("policy_coverage");
    expect(acknowledgement.metricsSnapshot.policyOutcomeSourceCount).toBe(1);
  });

  it("defaults nullable snapshots to empty safe values", () => {
    const acknowledgement = rolloutAcknowledgementRowToApi(
      row({
        checklist_snapshot: null,
        metrics_snapshot: null,
        note: null,
      })
    );

    expect(acknowledgement.checklistSnapshot).toEqual([]);
    expect(acknowledgement.metricsSnapshot.activeSourceCount).toBe(0);
    expect(acknowledgement.note).toBe("");
  });

  it("selects the newest acknowledgement per source", () => {
    const older = rolloutAcknowledgementRowToApi(
      row({ id: "old", created_at: "2026-05-16T18:00:00.000Z" })
    );
    const newer = rolloutAcknowledgementRowToApi(
      row({ id: "new", created_at: "2026-05-16T19:00:00.000Z" })
    );

    const latest = latestRolloutAcknowledgementBySource([older, newer]);

    expect(latest.get("550e8400-e29b-41d4-a716-446655440000")?.id).toBe("new");
  });

  it("detects missing-table Supabase errors", () => {
    expect(
      isMissingRolloutAcknowledgementsTable({
        code: "PGRST205",
        message: "Could not find agent_rollout_acknowledgements",
      })
    ).toBe(true);
    expect(isMissingRolloutAcknowledgementsTable({ code: "23505" })).toBe(false);
  });

  it("keeps copy advisory and non-mutating", () => {
    const text = Object.values(AGENT_GUARD_ROLLOUT_ACKNOWLEDGEMENT_COPY).join(" ");

    expect(text).toContain("advisory evidence");
    expect(text).toContain("does not promote it");
    expect(text).toContain("change policies");
    expect(text).toContain("switch export modes");
  });
});
