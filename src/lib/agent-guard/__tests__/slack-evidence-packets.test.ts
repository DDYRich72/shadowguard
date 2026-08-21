import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_SLACK_EVIDENCE_PACKET_COPY,
  agentGuardSlackEvidencePacketRowToApi,
  buildAgentGuardSlackEvidencePacketDraft,
  defaultAgentGuardSlackEvidencePacketTitle,
  isMissingAgentGuardSlackEvidencePacketStorage,
  type AgentGuardSlackEvidenceAttemptInput,
  type AgentGuardSlackEvidencePacketRow,
  type AgentGuardSlackEvidenceTargetInput,
} from "../slack-evidence-packets";

function target(
  overrides: Partial<AgentGuardSlackEvidenceTargetInput> = {}
): AgentGuardSlackEvidenceTargetInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Slack preview smoke test",
    targetType: "incoming_webhook",
    status: "enabled",
    webhookUrlHint: "hooks.slack.com/services/...cret",
    eventTypes: ["agentguard.policy.blocked", "agentguard.review.required"],
    dryRunEnabled: false,
    liveSendEnabled: false,
    ownerName: "Security",
    ownerEmail: "security@example.com",
    customerApprovalStatus: "requested",
    customerApprovalNote: "Pilot owner asked for manual evidence only.",
    customerApprovedAt: null,
    customerApprovedByEmail: null,
    userIdentifierMode: "redacted",
    lastTestedAt: "2026-05-20T18:22:58.822Z",
    lastSuccessfulTestAt: "2026-05-20T18:22:58.822Z",
    lastLiveAttemptAt: null,
    createdAt: "2026-05-20T18:00:00.000Z",
    updatedAt: "2026-05-20T18:23:00.000Z",
    ...overrides,
  };
}

function attempts(): AgentGuardSlackEvidenceAttemptInput[] {
  return [
    {
      id: "attempt-1",
      event_id: "agslack_test_0635887f613778bf566a4a30",
      event_type: "manual_test",
      status: "succeeded",
      delivery_mode: "manual_test",
      http_status: 200,
      duration_ms: 80,
      error_message: null,
      created_by_email: "operator@example.com",
      created_at: "2026-05-20T18:22:58.822Z",
    },
    {
      id: "attempt-2",
      event_id: "agslack_test_dry_run",
      event_type: "manual_test",
      status: "dry_run",
      delivery_mode: "dry_run",
      http_status: null,
      duration_ms: 0,
      error_message: null,
      created_by_email: "operator@example.com",
      created_at: "2026-05-20T18:10:00.000Z",
    },
  ];
}

describe("AgentGuard Slack evidence packets", () => {
  it("builds deterministic Slack evidence titles", () => {
    expect(
      defaultAgentGuardSlackEvidencePacketTitle({
        targetName: "Security Alerts",
        statusLabel: "Manual delivery verified",
        generatedAt: "2026-05-20T18:30:00.000Z",
      })
    ).toBe(
      "AgentGuard Slack evidence - Security Alerts - Manual delivery verified - 2026-05-20 18:30 UTC"
    );
  });

  it("builds URL-hint-only packets for manual delivery evidence", () => {
    const draft = buildAgentGuardSlackEvidencePacketDraft({
      target: target(),
      attempts: attempts(),
      generatedByEmail: "operator@example.com",
      generatedAt: "2026-05-20T18:30:00.000Z",
    });
    const text = JSON.stringify(draft);

    expect(draft.packetType).toBe("slack_preview");
    expect(draft.status).toBe("ready_for_pilot");
    expect(draft.statusLabel).toBe("Manual delivery verified");
    expect(draft.summaryMetrics.hasManualSuccess).toBe(true);
    expect(draft.summaryMetrics.hasDryRunEvidence).toBe(true);
    expect(draft.packetText).toContain("URL hint: hooks.slack.com/services/...cret");
    expect(draft.packetText).toContain("Successful manual delivery recorded: yes");
    expect(text).not.toContain("https://hooks.slack.com/services/");
    expect(text).not.toContain("webhook_url_encrypted");
    expect(text).not.toContain("webhook_url_hash");
    expect(text).not.toContain("Bearer ");
  });

  it("marks live posture as caution even when manual evidence exists", () => {
    const draft = buildAgentGuardSlackEvidencePacketDraft({
      target: target({ liveSendEnabled: true, customerApprovalStatus: "approved" }),
      attempts: attempts(),
      generatedAt: "2026-05-20T18:30:00.000Z",
    });

    expect(draft.status).toBe("live_caution");
    expect(draft.statusLabel).toBe("Live caution");
    expect(draft.packetText).toContain("Automatic live posture: on");
    expect(draft.commandCenter.nextAction).toContain("customer still approves");
  });

  it("maps saved database rows to API shape", () => {
    const draft = buildAgentGuardSlackEvidencePacketDraft({
      target: target(),
      attempts: attempts(),
      generatedByEmail: "operator@example.com",
      title: "Saved Slack packet",
    });
    const row: AgentGuardSlackEvidencePacketRow = {
      id: "packet-1",
      packet_type: "slack_preview",
      title: draft.title,
      status: draft.status,
      status_label: draft.statusLabel,
      summary: draft.summary,
      readiness_report: draft.snapshot,
      command_center: draft.commandCenter,
      summary_metrics: draft.summaryMetrics,
      evidence_counts: draft.evidenceCounts,
      load_warnings: draft.loadWarnings,
      packet_text: draft.packetText,
      generated_by_user_id: "user-1",
      generated_by_email: "operator@example.com",
      generated_at: draft.generatedAt,
      created_at: "2026-05-20T18:31:00.000Z",
    };

    const api = agentGuardSlackEvidencePacketRowToApi(row);

    expect(api.packetType).toBe("slack_preview");
    expect(api.snapshot.target.webhookUrlHint).toBe("hooks.slack.com/services/...cret");
    expect(api.summaryMetrics.totalAttemptCount).toBe(2);
    expect(api.generatedByEmail).toBe("operator@example.com");
  });

  it("detects missing Slack evidence storage errors", () => {
    expect(
      isMissingAgentGuardSlackEvidencePacketStorage({
        code: "23514",
        message: "violates check constraint agent_evidence_packets_packet_type_check",
      })
    ).toBe(true);
    expect(
      isMissingAgentGuardSlackEvidencePacketStorage({
        code: "XX000",
        message: "some other error",
      })
    ).toBe(false);
  });

  it("keeps public copy bounded and non-mutating", () => {
    const text = Object.values(AGENT_GUARD_SLACK_EVIDENCE_PACKET_COPY).join(" ");

    expect(text).toContain("metadata-only");
    expect(text).toContain("URL hints only");
    expect(text).toContain("no plaintext Slack URL");
    expect(text).toContain("does not send Slack messages");
    expect(text).toContain("does not");
    expect(text).toContain("install a Slack app");
    expect(text).toContain("use Slack OAuth");
    expect(text).toContain("discover channels");
    expect(text).toContain("guarantee delivery");
  });
});
