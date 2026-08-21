import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_RECEIVER_FIELD_DICTIONARY,
  AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY,
  AGENT_GUARD_RECEIVER_MAPPING_EVENT_TYPES,
  AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES,
  prettyReceiverMappingSample,
  receiverMappingTemplateById,
  renderReceiverMappingTemplateMarkdown,
} from "../receiver-field-mapping";

const UNSAFE_SAMPLE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /sgae_[A-Za-z0-9_-]{8,}/,
  /api[_-]?key\s*=/i,
  /raw prompt/i,
  /raw response/i,
];

describe("AgentGuard receiver field mapping", () => {
  it("covers the shipped export event types", () => {
    expect(AGENT_GUARD_RECEIVER_MAPPING_EVENT_TYPES).toEqual([
      "agentguard.activity.evaluated",
      "agentguard.policy.blocked",
      "agentguard.review.required",
    ]);
  });

  it("defines dictionary entries for key export payload fields", () => {
    const paths = AGENT_GUARD_RECEIVER_FIELD_DICTIONARY.map(
      (field) => field.path
    );

    expect(paths).toContain("eventId");
    expect(paths).toContain("eventType");
    expect(paths).toContain("activity.toolName");
    expect(paths).toContain("activity.userEmail");
    expect(paths).toContain("activity.dataClassification.sensitivity");
    expect(paths).toContain("activity.contentLength");
    expect(paths).toContain("alert.severity");
  });

  it("ships generic mapping templates without vendor-specific clients", () => {
    const ids = AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES.map(
      (template) => template.id
    );

    expect(ids).toEqual([
      "webhook_event_log",
      "siem_http_intake",
      "customer_alert_queue",
    ]);
    for (const template of AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES) {
      expect(template.rows.length).toBeGreaterThanOrEqual(7);
      expect(template.customerOwner).toContain("Customer owns");
    }
  });

  it("keeps sample outputs metadata-only and secret-free", () => {
    const text = AGENT_GUARD_RECEIVER_MAPPING_TEMPLATES.map(
      (template) => prettyReceiverMappingSample(template)
    ).join("\n");

    for (const pattern of UNSAFE_SAMPLE_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
    expect(text).toContain("content_length");
    expect(text).not.toContain("promptText");
  });

  it("renders copyable markdown with mapping rows and boundaries", () => {
    const template = receiverMappingTemplateById("siem_http_intake");
    const markdown = renderReceiverMappingTemplateMarkdown(template);

    expect(markdown).toContain("# AgentGuard Receiver Mapping: SIEM HTTP intake");
    expect(markdown).toContain("| Source field | Target field | Required |");
    expect(markdown).toContain("`activity.userEmail`");
    expect(markdown).toContain("Safe Sample Output");
    expect(markdown).toContain(AGENT_GUARD_RECEIVER_FIELD_MAPPING_COPY.boundary);
    expect(markdown).toContain("Do not add source keys");
  });

  it("falls back to the first template for unknown ids at runtime", () => {
    expect(
      receiverMappingTemplateById(
        "missing" as Parameters<typeof receiverMappingTemplateById>[0]
      ).id
    ).toBe("webhook_event_log");
  });
});
