import { describe, expect, it } from "vitest";
import {
  canOpenDeliveryLink,
  clientReportPath,
  clientReportUrl,
  deliveryLinkDisplayStatus,
  expirationDateToTimestamp,
  generateDeliveryLinkToken,
} from "../delivery-links";

describe("governance report delivery links", () => {
  it("generates URL-safe high-entropy tokens", () => {
    const first = generateDeliveryLinkToken();
    const second = generateDeliveryLinkToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("builds client report paths and URLs", () => {
    expect(clientReportPath("abc_123")).toBe("/client-reports/abc_123");
    expect(clientReportUrl("abc_123", "https://example.com/")).toBe(
      "https://example.com/client-reports/abc_123"
    );
  });

  it("derives active, revoked, and expired states", () => {
    const now = new Date("2026-05-13T12:00:00.000Z");

    expect(
      deliveryLinkDisplayStatus(
        { status: "active", expires_at: "2026-05-14T00:00:00.000Z" },
        now
      )
    ).toBe("active");
    expect(
      deliveryLinkDisplayStatus(
        { status: "revoked", expires_at: "2026-05-14T00:00:00.000Z" },
        now
      )
    ).toBe("revoked");
    expect(
      deliveryLinkDisplayStatus(
        { status: "active", expires_at: "2026-05-12T23:59:59.999Z" },
        now
      )
    ).toBe("expired");
  });

  it("only opens active unexpired links", () => {
    const now = new Date("2026-05-13T12:00:00.000Z");

    expect(canOpenDeliveryLink({ status: "active", expires_at: null }, now)).toBe(true);
    expect(
      canOpenDeliveryLink(
        { status: "active", expires_at: "2026-05-13T11:59:59.999Z" },
        now
      )
    ).toBe(false);
    expect(canOpenDeliveryLink({ status: "revoked", expires_at: null }, now)).toBe(false);
  });

  it("converts date-only expiration input to an end-of-day timestamp", () => {
    const timestamp = expirationDateToTimestamp("2026-06-01");
    expect(timestamp).toBeTruthy();

    const local = new Date(timestamp!);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(5);
    expect(local.getDate()).toBe(1);
    expect(local.getHours()).toBe(23);
    expect(local.getMinutes()).toBe(59);
    expect(local.getSeconds()).toBe(59);
    expect(local.getMilliseconds()).toBe(999);
    expect(expirationDateToTimestamp("")).toBeNull();
    expect(expirationDateToTimestamp(null)).toBeNull();
  });

  it("keeps a date-only link active through the selected local day", () => {
    const expiresAt = expirationDateToTimestamp("2026-06-01");

    expect(
      canOpenDeliveryLink(
        { status: "active", expires_at: expiresAt },
        new Date(2026, 5, 1, 12)
      )
    ).toBe(true);
    expect(
      canOpenDeliveryLink(
        { status: "active", expires_at: expiresAt },
        new Date(2026, 5, 2, 0)
      )
    ).toBe(false);
  });
});
