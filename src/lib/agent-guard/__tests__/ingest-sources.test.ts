import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_INGEST_TOKEN_PREFIX,
  agentIngestSourceRotationPosture,
  generateAgentIngestToken,
  hashAgentIngestToken,
  mergeSourceMetadata,
  normalizeAllowedToolNames,
  parseBearerToken,
  sourceCanSubmitTool,
  tokenHint,
} from "../ingest-sources";
import { prepareAgentActivity } from "../activity";

describe("AgentGuard ingest source keys", () => {
  it("generates prefixed high-entropy keys and stores only hashes", () => {
    const token = generateAgentIngestToken();
    const hash = hashAgentIngestToken(token);

    expect(token.startsWith(AGENT_GUARD_INGEST_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
  });

  it("parses bearer tokens conservatively", () => {
    const token = generateAgentIngestToken();

    expect(parseBearerToken(`Bearer ${token}`)).toBe(token);
    expect(parseBearerToken(`bearer ${token}`)).toBe(token);
    expect(parseBearerToken(token)).toBeNull();
    expect(parseBearerToken("Bearer not-shadowguard")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  it("formats non-secret token hints", () => {
    const token = `${AGENT_GUARD_INGEST_TOKEN_PREFIX}abcdefghijklmnopqrstuvwxyz`;

    expect(tokenHint(token)).toBe("sgag_abcd...wxyz");
  });

  it("normalizes allowed tool scopes and matches case-insensitively", () => {
    const allowed = normalizeAllowedToolNames([" ChatGPT ", "chatgpt", "Claude"]);

    expect(allowed).toEqual(["ChatGPT", "Claude"]);
    expect(sourceCanSubmitTool(allowed, "chatgpt")).toBe(true);
    expect(sourceCanSubmitTool(allowed, "Gemini")).toBe(false);
    expect(sourceCanSubmitTool([], "Any Tool")).toBe(true);
  });

  it("adds source attribution without preserving raw content", () => {
    const raw = "customer secret payload";
    const prepared = prepareAgentActivity(
      {
        orgId: "org-1",
        toolName: "ChatGPT",
        userEmail: "analyst@example.com",
        activityType: "prompt_sent",
        content: raw,
        metadata: mergeSourceMetadata(
          {
            source: "wrapper",
            prompt: raw,
          },
          {
            id: "source-1",
            name: "Production wrapper",
            environment: "production",
          }
        ),
      },
      []
    );

    const serialized = JSON.stringify(prepared.insert);
    expect(serialized).not.toContain(raw);
    expect(prepared.insert.metadata.agentGuardSource).toEqual({
      id: "source-1",
      name: "Production wrapper",
      environment: "production",
      auth: "source_key",
    });
  });

  it("classifies advisory source-key rotation posture", () => {
    const now = new Date("2026-05-18T00:00:00.000Z");

    expect(
      agentIngestSourceRotationPosture(
        { createdAt: "2026-05-01T00:00:00.000Z", status: "active" },
        now
      ).status
    ).toBe("fresh");
    expect(
      agentIngestSourceRotationPosture(
        { createdAt: "2026-02-25T00:00:00.000Z", status: "active" },
        now
      ).status
    ).toBe("due_soon");
    expect(
      agentIngestSourceRotationPosture(
        { createdAt: "2026-01-01T00:00:00.000Z", status: "active" },
        now
      ).status
    ).toBe("overdue");
    expect(
      agentIngestSourceRotationPosture(
        { createdAt: "2026-01-01T00:00:00.000Z", status: "revoked" },
        now
      ).status
    ).toBe("revoked");
  });
});
