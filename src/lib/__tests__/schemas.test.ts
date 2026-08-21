import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import {
  parseBody,
  alertPatchSchema,
  activityIngestSchema,
  agentExportDestinationCreateSchema,
  agentExportDestinationPatchSchema,
  agentIntegrationEvidenceCreateSchema,
  agentIntegrationEvidencePatchSchema,
  agentRolloutAcknowledgementCreateSchema,
  agentPolicyReviewPatchSchema,
  agentIngestSourceCreateSchema,
  agentIngestSourcePatchSchema,
  policyBodySchema,
  policyPatchSchema,
  oauthRevokeSchema,
  aiSystemCreateSchema,
  aiSystemPatchSchema,
  aiSystemImportSchema,
  aiRiskAssessmentSchema,
  aiSystemControlPatchSchema,
  aiSystemEvidenceCreateSchema,
  aiSystemEvidencePatchSchema,
  governanceReportSnapshotCreateSchema,
  governanceReportSnapshotDeliveryPatchSchema,
  governanceReportSnapshotReviewSubmitSchema,
  governanceReportSnapshotReviewDecisionSchema,
  governanceReportSnapshotRemediationCreateSchema,
  governanceReportSnapshotRemediationPatchSchema,
  governanceReportDeliveryLinkCreateSchema,
  governanceReportDeliveryLinkPatchSchema,
  mcpServerCreateSchema,
  mcpServerPatchSchema,
  mcpToolCreateSchema,
  mcpToolPatchSchema,
  mcpEventIngestSchema,
} from "../api/schemas";

function jsonRequest(body: unknown): Request {
  return new Request("https://example.com/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("parseBody", () => {
  it("returns the parsed value on success", async () => {
    const req = jsonRequest({
      id: "550e8400-e29b-41d4-a716-446655440000",
      acknowledged: false,
    });
    const out = await parseBody(req, alertPatchSchema);
    expect(out).not.toBeInstanceOf(NextResponse);
    if (!(out instanceof NextResponse)) {
      expect(out.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(out.acknowledged).toBe(false);
    }
  });

  it("applies schema defaults", async () => {
    const req = jsonRequest({ id: "550e8400-e29b-41d4-a716-446655440000" });
    const out = await parseBody(req, alertPatchSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.acknowledged).toBe(true); // default
    }
  });

  it("returns 400 NextResponse with issues on validation failure", async () => {
    const req = jsonRequest({ id: "not-a-uuid" });
    const out = await parseBody(req, alertPatchSchema);
    expect(out).toBeInstanceOf(NextResponse);
    if (out instanceof NextResponse) {
      expect(out.status).toBe(400);
      const body = (await out.json()) as { error: string; issues: { path: string; message: string }[] };
      expect(body.error).toBe("validation_failed");
      expect(body.issues.some((i) => i.path === "id")).toBe(true);
    }
  });

  it("returns 400 invalid_json for unparseable bodies", async () => {
    const req = new Request("https://example.com/test", {
      method: "POST",
      body: "not json",
    });
    const out = await parseBody(req, alertPatchSchema);
    expect(out).toBeInstanceOf(NextResponse);
    if (out instanceof NextResponse) {
      expect(out.status).toBe(400);
      const body = (await out.json()) as { error: string };
      expect(body.error).toBe("invalid_json");
    }
  });
});

describe("oauthRevokeSchema", () => {
  it("accepts supported OAuth revocation providers only", async () => {
    const google = await parseBody(
      jsonRequest({ provider: "google" }),
      oauthRevokeSchema
    );
    if (!(google instanceof NextResponse)) {
      expect(google.provider).toBe("google");
    }

    const bad = await parseBody(
      jsonRequest({ provider: "dropbox" }),
      oauthRevokeSchema
    );
    expect(bad).toBeInstanceOf(NextResponse);
  });
});

describe("activityIngestSchema", () => {
  it("requires toolName, userEmail, activityType", async () => {
    const req = jsonRequest({});
    const out = await parseBody(req, activityIngestSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("trims and lowercases email", async () => {
    const req = jsonRequest({
      toolName: "ChatGPT",
      userEmail: "  Alice@Example.COM  ",
      activityType: "prompt_sent",
    });
    const out = await parseBody(req, activityIngestSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.userEmail).toBe("alice@example.com");
    }
  });

  it("rejects unknown activityType", async () => {
    const req = jsonRequest({
      toolName: "ChatGPT",
      userEmail: "x@y.z",
      activityType: "definitely_not_a_real_type",
    });
    const out = await parseBody(req, activityIngestSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("clips content at the byte limit (rejects oversize)", async () => {
    const req = jsonRequest({
      toolName: "ChatGPT",
      userEmail: "x@y.z",
      activityType: "prompt_sent",
      content: "a".repeat(200_000), // way over the 100k cap
    });
    const out = await parseBody(req, activityIngestSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });
});

describe("MCPGuard schemas", () => {
  it("accepts MCP server create and patch payloads", async () => {
    const create = await parseBody(
      jsonRequest({
        name: "Local Dev MCP",
        transport: "stdio",
        environment: "development",
        ownerEmail: "Owner@Example.com",
      }),
      mcpServerCreateSchema
    );
    expect(create).not.toBeInstanceOf(NextResponse);
    if (!(create instanceof NextResponse)) {
      expect(create.ownerEmail).toBe("owner@example.com");
      expect(create.approvalStatus).toBe("pending_review");
    }

    const patch = await parseBody(
      jsonRequest({ approvalStatus: "approved" }),
      mcpServerPatchSchema
    );
    expect(patch).not.toBeInstanceOf(NextResponse);
  });

  it("accepts MCP tool payloads and rejects unknown capability categories", async () => {
    const valid = await parseBody(
      jsonRequest({
        name: "database.query",
        capabilityCategories: ["read", "database_access"],
        dataSensitivity: "confidential",
        externalAccess: false,
        writeAccess: false,
        credentialAccess: true,
      }),
      mcpToolCreateSchema
    );
    expect(valid).not.toBeInstanceOf(NextResponse);

    const patch = await parseBody(
      jsonRequest({ capabilityCategories: ["write"], approvalStatus: "blocked" }),
      mcpToolPatchSchema
    );
    expect(patch).not.toBeInstanceOf(NextResponse);

    const invalid = await parseBody(
      jsonRequest({ name: "bad", capabilityCategories: ["root_shell"] }),
      mcpToolCreateSchema
    );
    expect(invalid).toBeInstanceOf(NextResponse);
  });

  it("validates MCP event intake without accepting oversized raw content", async () => {
    const valid = await parseBody(
      jsonRequest({
        toolName: "repo.read",
        userEmail: "analyst@example.com",
        activityType: "tool_invocation",
        inputContent: "read package.json",
        metadata: { resourceName: "package.json" },
      }),
      mcpEventIngestSchema
    );
    expect(valid).not.toBeInstanceOf(NextResponse);

    const invalid = await parseBody(
      jsonRequest({
        toolName: "repo.read",
        userEmail: "analyst@example.com",
        inputContent: "x".repeat(200_000),
      }),
      mcpEventIngestSchema
    );
    expect(invalid).toBeInstanceOf(NextResponse);
  });
});

describe("agentIngestSource schemas", () => {
  it("accepts source creation with defaults", async () => {
    const req = jsonRequest({
      name: "Production wrapper",
    });
    const out = await parseBody(req, agentIngestSourceCreateSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.environment).toBe("production");
      expect(out.allowedToolNames).toEqual([]);
    }
  });

  it("validates source creation scope fields", async () => {
    const req = jsonRequest({
      name: "Scoped wrapper",
      environment: "staging",
      allowedToolNames: ["ChatGPT", "GitHub Copilot"],
    });
    const out = await parseBody(req, agentIngestSourceCreateSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.environment).toBe("staging");
      expect(out.allowedToolNames).toEqual(["ChatGPT", "GitHub Copilot"]);
    }
  });

  it("rejects invalid source creation environments", async () => {
    const out = await parseBody(
      jsonRequest({ name: "Bad wrapper", environment: "prod" }),
      agentIngestSourceCreateSchema
    );
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("accepts source revocation patches and rejects empty patches", async () => {
    const valid = await parseBody(
      jsonRequest({ status: "revoked" }),
      agentIngestSourcePatchSchema
    );
    expect(valid).not.toBeInstanceOf(NextResponse);

    const empty = await parseBody(jsonRequest({}), agentIngestSourcePatchSchema);
    expect(empty).toBeInstanceOf(NextResponse);
  });
});

describe("agentExportDestination schemas", () => {
  it("accepts destination creation with disabled-by-default API fields", async () => {
    const out = await parseBody(
      jsonRequest({
        name: "Security webhook",
        endpointUrl: "https://example.com/agentguard",
      }),
      agentExportDestinationCreateSchema
    );

    if (!(out instanceof NextResponse)) {
      expect(out.destinationType).toBe("webhook");
      expect(out.endpointUrl).toBe("https://example.com/agentguard");
      expect(out.automaticDeliveryEnabled).toBe(false);
      expect(out.dryRunEnabled).toBe(true);
      expect(out.eventTypes).toEqual([
        "agentguard.activity.evaluated",
        "agentguard.policy.blocked",
        "agentguard.review.required",
      ]);
    }
  });

  it("validates destination type and rejects oversized URLs", async () => {
    const badType = await parseBody(
      jsonRequest({
        name: "Bad destination",
        destinationType: "email",
        endpointUrl: "https://example.com/hook",
      }),
      agentExportDestinationCreateSchema
    );
    expect(badType).toBeInstanceOf(NextResponse);

    const tooLong = await parseBody(
      jsonRequest({
        name: "Bad destination",
        endpointUrl: `https://example.com/${"a".repeat(2200)}`,
      }),
      agentExportDestinationCreateSchema
    );
    expect(tooLong).toBeInstanceOf(NextResponse);
  });

  it("accepts destination updates and rejects empty patches", async () => {
    const valid = await parseBody(
      jsonRequest({
        status: "enabled",
        endpointUrl: "https://example.com/updated",
        automaticDeliveryEnabled: true,
        dryRunEnabled: false,
        eventTypes: ["agentguard.policy.blocked"],
        ownerName: "Security operations",
        ownerEmail: "security@example.com",
        escalationPath: "Pager rotation handles receiver failures.",
        receiverAcknowledgementStatus: "confirmed",
        receiverAcknowledgementNote: "Receiver owner confirmed HMAC checks.",
      }),
      agentExportDestinationPatchSchema
    );
    expect(valid).not.toBeInstanceOf(NextResponse);

    const empty = await parseBody(jsonRequest({}), agentExportDestinationPatchSchema);
    expect(empty).toBeInstanceOf(NextResponse);
  });

  it("rejects invalid destination event type selections", async () => {
    const invalid = await parseBody(
      jsonRequest({
        eventTypes: ["not-real"],
      }),
      agentExportDestinationPatchSchema
    );

    expect(invalid).toBeInstanceOf(NextResponse);
  });

  it("rejects secret-like export hardening metadata", async () => {
    const invalid = await parseBody(
      jsonRequest({
        escalationPath: "authorization: bearer sgag_real_secret_value",
      }),
      agentExportDestinationPatchSchema
    );

    expect(invalid).toBeInstanceOf(NextResponse);
  });
});

describe("agentRolloutAcknowledgementCreateSchema", () => {
  const validBody = {
    sourceId: "550e8400-e29b-41d4-a716-446655440000",
    sourceName: "Production wrapper",
    sourceEnvironment: "production",
    sourceStatus: "active",
    sourceRolloutStatus: "ready_for_pilot",
    sourceRolloutLabel: "Ready for pilot",
    sourceNextStep: "Ready for a controlled pilot.",
    overallRolloutStatus: "ready_for_pilot",
    overallRolloutLabel: "Ready for pilot",
    exportPostureLabel: "Dry-run export",
    exportWarning: null,
    checklistSnapshot: [
      {
        id: "policy_coverage",
        label: "Policy coverage",
        status: "pass",
        summary: "Production source activity has recent policy outcomes.",
      },
    ],
    metricsSnapshot: {
      activeSourceCount: 1,
      activeProductionSourceCount: 1,
      recentActivitySourceCount: 1,
      policyOutcomeSourceCount: 1,
      needsReviewSourceCount: 0,
      needsActionReviewCount: 0,
      liveExportDestinationCount: 0,
      failingExportDestinationCount: 0,
    },
    note: "Reviewed with dry-run on.",
  };

  it("accepts a metadata-only rollout acknowledgement snapshot", async () => {
    const out = await parseBody(
      jsonRequest(validBody),
      agentRolloutAcknowledgementCreateSchema
    );

    if (!(out instanceof NextResponse)) {
      expect(out.sourceRolloutStatus).toBe("ready_for_pilot");
      expect(out.checklistSnapshot[0]?.status).toBe("pass");
      expect(out.metricsSnapshot.policyOutcomeSourceCount).toBe(1);
    }
  });

  it("rejects invalid rollout statuses and oversize notes", async () => {
    const invalidStatus = await parseBody(
      jsonRequest({ ...validBody, sourceRolloutStatus: "approved" }),
      agentRolloutAcknowledgementCreateSchema
    );
    expect(invalidStatus).toBeInstanceOf(NextResponse);

    const invalidNote = await parseBody(
      jsonRequest({ ...validBody, note: "x".repeat(2000) }),
      agentRolloutAcknowledgementCreateSchema
    );
    expect(invalidNote).toBeInstanceOf(NextResponse);
  });
});

describe("agentIntegrationEvidence schemas", () => {
  const validBody = {
    sourceId: "550e8400-e29b-41d4-a716-446655440000",
    title: "Production wrapper implementation evidence",
    status: "in_progress",
    implementationOwner: "Security engineering",
    wrapperLocation: "services/ai-gateway",
    evidenceUrl: "https://example.com/ticket/123",
    checklistSnapshot: [
      {
        id: "server_side_secret",
        label: "Source key stored server-side",
        detail: "Stored in server-side secret storage, not browser code.",
        completed: true,
      },
    ],
    note: "Reviewed metadata-only wrapper path.",
  };

  it("accepts metadata-only integration evidence creation", async () => {
    const out = await parseBody(
      jsonRequest(validBody),
      agentIntegrationEvidenceCreateSchema
    );

    if (!(out instanceof NextResponse)) {
      expect(out.sourceId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(out.status).toBe("in_progress");
      expect(out.checklistSnapshot[0]?.completed).toBe(true);
    }
  });

  it("defaults optional integration evidence fields", async () => {
    const out = await parseBody(
      jsonRequest({ title: "Minimal evidence" }),
      agentIntegrationEvidenceCreateSchema
    );

    if (!(out instanceof NextResponse)) {
      expect(out.sourceId).toBeNull();
      expect(out.status).toBe("in_progress");
      expect(out.checklistSnapshot).toEqual([]);
      expect(out.note).toBe("");
    }
  });

  it("rejects obvious source keys and private keys", async () => {
    const sourceKey = await parseBody(
      jsonRequest({
        ...validBody,
        note: "Token was sgag_1234567890abcdef",
      }),
      agentIntegrationEvidenceCreateSchema
    );
    expect(sourceKey).toBeInstanceOf(NextResponse);

    const privateKey = await parseBody(
      jsonRequest({
        ...validBody,
        wrapperLocation: "-----BEGIN PRIVATE KEY-----",
      }),
      agentIntegrationEvidencePatchSchema
    );
    expect(privateKey).toBeInstanceOf(NextResponse);
  });

  it("accepts integration evidence patches and rejects empty patches", async () => {
    const valid = await parseBody(
      jsonRequest({ status: "pilot_ready" }),
      agentIntegrationEvidencePatchSchema
    );
    expect(valid).not.toBeInstanceOf(NextResponse);

    const empty = await parseBody(
      jsonRequest({}),
      agentIntegrationEvidencePatchSchema
    );
    expect(empty).toBeInstanceOf(NextResponse);
  });
});

describe("policyBodySchema", () => {
  it("accepts a minimal valid policy", async () => {
    const req = jsonRequest({
      name: "Block credentials",
      action: "block",
    });
    const out = await parseBody(req, policyBodySchema);
    if (!(out instanceof NextResponse)) {
      expect(out.priority).toBe(5); // default
      expect(out.enabled).toBe(true);
      expect(out.conditions).toEqual([]);
    }
  });

  it("rejects unknown action", async () => {
    const req = jsonRequest({
      name: "weird",
      action: "obliterate",
    });
    const out = await parseBody(req, policyBodySchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("rejects priority out of range", async () => {
    const req = jsonRequest({ name: "x", action: "allow", priority: 99999 });
    const out = await parseBody(req, policyBodySchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("validates each condition", async () => {
    const req = jsonRequest({
      name: "x",
      action: "block",
      conditions: [{ field: "bad_field", operator: "equals", value: "x" }],
    });
    const out = await parseBody(req, policyBodySchema);
    expect(out).toBeInstanceOf(NextResponse);
  });
});

describe("policyPatchSchema", () => {
  it("accepts an empty body (all fields optional)", async () => {
    const req = jsonRequest({});
    const out = await parseBody(req, policyPatchSchema);
    expect(out).not.toBeInstanceOf(NextResponse);
  });

  it("validates a single field when provided", async () => {
    const req = jsonRequest({ priority: -5 });
    const out = await parseBody(req, policyPatchSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });
});

describe("agentPolicyReviewPatchSchema", () => {
  it("accepts status, owner, and note updates", async () => {
    const out = await parseBody(
      jsonRequest({
        status: "investigating",
        assignedTo: "Security Lead",
        reviewNote: "Checking with the data owner.",
      }),
      agentPolicyReviewPatchSchema
    );

    if (!(out instanceof NextResponse)) {
      expect(out.status).toBe("investigating");
      expect(out.assignedTo).toBe("Security Lead");
      expect(out.reviewNote).toContain("data owner");
    }
  });

  it("rejects empty or invalid review updates", async () => {
    const empty = await parseBody(jsonRequest({}), agentPolicyReviewPatchSchema);
    expect(empty).toBeInstanceOf(NextResponse);

    const badStatus = await parseBody(
      jsonRequest({ status: "closed" }),
      agentPolicyReviewPatchSchema
    );
    expect(badStatus).toBeInstanceOf(NextResponse);
  });
});

describe("AI governance schemas", () => {
  it("accepts a minimal AI system create body", async () => {
    const req = jsonRequest({
      name: "Support reply assistant",
      useCase: "Draft support replies with human review.",
    });
    const out = await parseBody(req, aiSystemCreateSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.dataSensitivity).toBe("internal");
      expect(out.humanReviewRequired).toBe(true);
      expect(out.approvalStatus).toBe("under_review");
    }
  });

  it("allows sparse AI system patches without applying create defaults", async () => {
    const req = jsonRequest({ approvalStatus: "approved" });
    const out = await parseBody(req, aiSystemPatchSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.approvalStatus).toBe("approved");
      expect(out.ownerEmail).toBeUndefined();
      expect(out.name).toBeUndefined();
    }
  });

  it("rejects invalid owner emails", async () => {
    const req = jsonRequest({
      name: "Bad owner",
      useCase: "Test",
      ownerEmail: "not-an-email",
    });
    const out = await parseBody(req, aiSystemCreateSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("accepts a minimal AI inventory import body", async () => {
    const req = jsonRequest({
      csvText: "system_name,use_case\nSupport Assistant,Draft replies",
    });
    const out = await parseBody(req, aiSystemImportSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.dryRun).toBe(true);
      expect(out.csvText).toContain("Support Assistant");
    }
  });

  it("rejects oversized AI inventory import bodies", async () => {
    const req = jsonRequest({
      csvText: "a".repeat(250_001),
    });
    const out = await parseBody(req, aiSystemImportSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("accepts a minimal risk assessment body with defaults", async () => {
    const req = jsonRequest({});
    const out = await parseBody(req, aiRiskAssessmentSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.status).toBe("completed");
      expect(out.dataSensitivity).toBe("internal");
      expect(out.businessCriticality).toBe("medium");
    }
  });

  it("accepts a control task patch", async () => {
    const req = jsonRequest({
      owner: "Security Lead",
      status: "in_progress",
      dueDate: "2026-06-01",
      notes: "Waiting on vendor response.",
      evidenceUrl: "https://example.com/evidence",
      evidenceText: "Vendor SOC 2 requested.",
    });
    const out = await parseBody(req, aiSystemControlPatchSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.status).toBe("in_progress");
      expect(out.dueDate).toBe("2026-06-01");
    }
  });

  it("rejects invalid control evidence URLs", async () => {
    const req = jsonRequest({ evidenceUrl: "ftp://example.com/file" });
    const out = await parseBody(req, aiSystemControlPatchSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("accepts a minimal evidence create body with defaults", async () => {
    const req = jsonRequest({
      title: "Vendor SOC 2 review",
      evidenceUrl: "https://example.com/soc2",
    });
    const out = await parseBody(req, aiSystemEvidenceCreateSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.category).toBe("other");
      expect(out.status).toBe("current");
      expect(out.controlId).toBeNull();
    }
  });

  it("accepts evidence patches and validates evidence URLs", async () => {
    const valid = await parseBody(
      jsonRequest({
        status: "needs_review",
        controlId: "550e8400-e29b-41d4-a716-446655440000",
      }),
      aiSystemEvidencePatchSchema
    );
    expect(valid).not.toBeInstanceOf(NextResponse);

    const invalid = await parseBody(
      jsonRequest({ evidenceUrl: "file:///local/path" }),
      aiSystemEvidencePatchSchema
    );
    expect(invalid).toBeInstanceOf(NextResponse);
  });

  it("accepts governance report snapshot create requests", async () => {
    const systemReq = jsonRequest({
      reportType: "ai_system_readiness",
      aiSystemId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Support Assistant Readiness Report",
    });
    const systemOut = await parseBody(systemReq, governanceReportSnapshotCreateSchema);
    expect(systemOut).not.toBeInstanceOf(NextResponse);

    const portfolioReq = jsonRequest({ reportType: "organization_governance" });
    const portfolioOut = await parseBody(portfolioReq, governanceReportSnapshotCreateSchema);
    if (!(portfolioOut instanceof NextResponse)) {
      expect(portfolioOut.aiSystemId).toBeNull();
      expect(portfolioOut.title).toBe("");
    }
  });

  it("requires aiSystemId for single-system report snapshots", async () => {
    const req = jsonRequest({ reportType: "ai_system_readiness" });
    const out = await parseBody(req, governanceReportSnapshotCreateSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("accepts governance report snapshot delivery updates", async () => {
    const req = jsonRequest({
      clientName: "Acme Health",
      preparedByNote: "Prepared by Example Organization.",
      executiveSummaryNote: "Focus next on vendor review evidence.",
    });
    const out = await parseBody(req, governanceReportSnapshotDeliveryPatchSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.clientName).toBe("Acme Health");
      expect(out.preparedByNote).toContain("Example Organization");
    }
  });

  it("rejects oversized governance report snapshot delivery notes", async () => {
    const req = jsonRequest({
      executiveSummaryNote: "a".repeat(4001),
    });
    const out = await parseBody(req, governanceReportSnapshotDeliveryPatchSchema);
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("accepts governance report review submissions", async () => {
    const req = jsonRequest({
      reviewerName: "Security Reviewer",
      reviewerEmail: " Reviewer@Example.COM ",
      reviewNote: "Please validate evidence gaps.",
    });
    const out = await parseBody(req, governanceReportSnapshotReviewSubmitSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.reviewerEmail).toBe("reviewer@example.com");
      expect(out.reviewNote).toContain("evidence");
    }
  });

  it("accepts governance report review decisions", async () => {
    const req = jsonRequest({
      action: "approve",
      reviewerEmail: "reviewer@example.com",
      reviewNote: "Approved for client delivery.",
    });
    const out = await parseBody(req, governanceReportSnapshotReviewDecisionSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.action).toBe("approve");
      expect(out.reviewerName).toBe("");
    }
  });

  it("rejects invalid governance report review decisions", async () => {
    const invalidAction = await parseBody(
      jsonRequest({ action: "finalize", reviewerEmail: "reviewer@example.com" }),
      governanceReportSnapshotReviewDecisionSchema
    );
    expect(invalidAction).toBeInstanceOf(NextResponse);

    const invalidEmail = await parseBody(
      jsonRequest({ reviewerEmail: "not-an-email" }),
      governanceReportSnapshotReviewSubmitSchema
    );
    expect(invalidEmail).toBeInstanceOf(NextResponse);
  });

  it("accepts governance report remediation creation", async () => {
    const req = jsonRequest({
      title: "Add vendor evidence note",
      owner: "Governance Lead",
      dueDate: "2026-06-01",
      notes: "Reviewer requested a clearer vendor evidence explanation.",
    });
    const out = await parseBody(req, governanceReportSnapshotRemediationCreateSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.status).toBe("open");
      expect(out.dueDate).toBe("2026-06-01");
    }
  });

  it("accepts governance report remediation patches", async () => {
    const req = jsonRequest({
      status: "resolved",
      owner: "Casey",
      dueDate: "",
      notes: "Updated and ready for re-review.",
    });
    const out = await parseBody(req, governanceReportSnapshotRemediationPatchSchema);
    if (!(out instanceof NextResponse)) {
      expect(out.status).toBe("resolved");
      expect(out.dueDate).toBe("");
    }
  });

  it("rejects invalid governance report remediation payloads", async () => {
    const missingTitle = await parseBody(
      jsonRequest({ owner: "Governance Lead" }),
      governanceReportSnapshotRemediationCreateSchema
    );
    expect(missingTitle).toBeInstanceOf(NextResponse);

    const badStatus = await parseBody(
      jsonRequest({ status: "done" }),
      governanceReportSnapshotRemediationPatchSchema
    );
    expect(badStatus).toBeInstanceOf(NextResponse);

    const badDate = await parseBody(
      jsonRequest({ title: "Fix", dueDate: "06/01/2026" }),
      governanceReportSnapshotRemediationCreateSchema
    );
    expect(badDate).toBeInstanceOf(NextResponse);
  });

  it("accepts optional delivery link expiration dates", async () => {
    const dated = await parseBody(
      jsonRequest({ expiresAt: "2026-06-01" }),
      governanceReportDeliveryLinkCreateSchema
    );
    if (!(dated instanceof NextResponse)) {
      expect(dated.expiresAt).toBe("2026-06-01");
    }

    const empty = await parseBody(jsonRequest({}), governanceReportDeliveryLinkCreateSchema);
    if (!(empty instanceof NextResponse)) {
      expect(empty.expiresAt).toBe("");
    }
  });

  it("rejects invalid delivery link expiration dates", async () => {
    const out = await parseBody(
      jsonRequest({ expiresAt: "06/01/2026" }),
      governanceReportDeliveryLinkCreateSchema
    );
    expect(out).toBeInstanceOf(NextResponse);
  });

  it("accepts delivery link revocation patches only", async () => {
    const valid = await parseBody(
      jsonRequest({ status: "revoked" }),
      governanceReportDeliveryLinkPatchSchema
    );
    expect(valid).not.toBeInstanceOf(NextResponse);

    const invalid = await parseBody(
      jsonRequest({ status: "active" }),
      governanceReportDeliveryLinkPatchSchema
    );
    expect(invalid).toBeInstanceOf(NextResponse);
  });
});
