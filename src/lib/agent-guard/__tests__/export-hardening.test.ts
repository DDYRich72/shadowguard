import { describe, expect, it } from "vitest";
import {
  AGENT_EXPORT_HARDENING_BOUNDARY,
  acknowledgementStatusLabel,
  classifyAgentExportFailure,
} from "../export-hardening";

describe("AgentGuard export hardening", () => {
  it("classifies successful and dry-run attempts", () => {
    expect(classifyAgentExportFailure({ status: "succeeded" }).category).toBe(
      "none"
    );
    expect(classifyAgentExportFailure({ status: "dry_run" }).category).toBe(
      "dry_run"
    );
  });

  it("groups receiver HTTP failures", () => {
    const failure = classifyAgentExportFailure({
      status: "failed",
      httpStatus: 500,
      errorMessage: "Destination returned HTTP 500.",
    });

    expect(failure.category).toBe("receiver_http_error");
    expect(failure.label).toBe("Receiver HTTP error");
    expect(failure.nextAction).toContain("receiver owner");
  });

  it("groups timeout, network, and signing/config failures", () => {
    expect(
      classifyAgentExportFailure({
        status: "failed",
        errorMessage: "Destination test timed out.",
      }).category
    ).toBe("timeout");
    expect(
      classifyAgentExportFailure({
        status: "failed",
        errorMessage: "fetch failed: getaddrinfo ENOTFOUND receiver.example.com",
      }).category
    ).toBe("network_error");
    expect(
      classifyAgentExportFailure({
        status: "failed",
        errorMessage: "AGENT_GUARD_EXPORT_SECRET_KEY is required",
      }).category
    ).toBe("signing_or_configuration");
  });

  it("labels acknowledgement statuses", () => {
    expect(acknowledgementStatusLabel("confirmed")).toBe("Confirmed");
    expect(acknowledgementStatusLabel("not-real")).toBe("Unknown");
  });

  it("keeps hardening boundaries claim-safe", () => {
    expect(AGENT_EXPORT_HARDENING_BOUNDARY).toContain(
      "customer-owned receiver ownership"
    );
    expect(AGENT_EXPORT_HARDENING_BOUNDARY).toContain("not automatic retry");
    expect(AGENT_EXPORT_HARDENING_BOUNDARY).toContain("managed connector");
    expect(AGENT_EXPORT_HARDENING_BOUNDARY).toContain(
      "not proof of receiver-side signature verification"
    );
  });
});
