import { describe, expect, it } from "vitest";
import {
  AGENT_GUARD_RECEIVER_CHECKLIST,
  AGENT_GUARD_RECEIVER_EXAMPLES,
} from "../receiver-kit";

describe("AgentGuard receiver integration kit", () => {
  it("ships the expected receiver examples", () => {
    expect(AGENT_GUARD_RECEIVER_EXAMPLES.map((example) => example.id)).toEqual([
      "nextjs",
      "express",
      "fastapi",
    ]);
  });

  it("references the current ShadowGuard signing headers in every example", () => {
    for (const example of AGENT_GUARD_RECEIVER_EXAMPLES) {
      expect(example.code).toContain("x-shadowguard-event-id");
      expect(example.code).toContain("x-shadowguard-timestamp");
      expect(example.code).toContain("x-shadowguard-signature");
    }
  });

  it("verifies canonical JSON with timing-safe comparison", () => {
    const allCode = AGENT_GUARD_RECEIVER_EXAMPLES.map((example) => example.code).join("\n");

    expect(allCode).toContain("canonicalJson");
    expect(allCode).toContain("canonical_json");
    expect(allCode).toContain("HMAC-SHA256");
    expect(allCode).toContain("timingSafeEqual");
    expect(allCode).toContain("compare_digest");
  });

  it("includes timestamp tolerance and duplicate event ID handling", () => {
    for (const example of AGENT_GUARD_RECEIVER_EXAMPLES) {
      expect(example.code).toContain("300");
      expect(example.code).toContain("duplicate");
    }
    expect(AGENT_GUARD_RECEIVER_CHECKLIST.map((item) => item.title)).toContain(
      "Track event IDs"
    );
  });

  it("keeps receiver guidance metadata-only and avoids connector claims", () => {
    const text = [
      ...AGENT_GUARD_RECEIVER_CHECKLIST.map((item) => `${item.title} ${item.detail}`),
      ...AGENT_GUARD_RECEIVER_EXAMPLES.map((example) => example.code),
    ].join("\n");

    expect(text).toContain("contentLength");
    expect(text).toContain("do not include raw prompts");
    expect(text).not.toContain("managed SIEM connector");
    expect(text).not.toContain("Slack connector");
    expect(text).not.toContain("automatic retry");
  });
});
