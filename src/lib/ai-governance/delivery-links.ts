import { randomBytes } from "crypto";
import type { GovernanceReportDeliveryLink } from "./types";
import { getPublicAppUrl } from "@/lib/public-url";

export type DeliveryLinkDisplayStatus = "active" | "revoked" | "expired";

const tokenByteLength = 32;

export function generateDeliveryLinkToken(): string {
  return randomBytes(tokenByteLength).toString("base64url");
}

export function clientReportPath(token: string): string {
  return `/client-reports/${encodeURIComponent(token)}`;
}

export function clientReportUrl(token: string, baseUrl = getPublicAppUrl()): string {
  return `${baseUrl.replace(/\/$/, "")}${clientReportPath(token)}`;
}

export function deliveryLinkDisplayStatus(
  link: Pick<GovernanceReportDeliveryLink, "status" | "expires_at">,
  now = new Date()
): DeliveryLinkDisplayStatus {
  if (link.status === "revoked") return "revoked";
  if (link.expires_at && new Date(link.expires_at).getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}

export function canOpenDeliveryLink(
  link: Pick<GovernanceReportDeliveryLink, "status" | "expires_at">,
  now = new Date()
): boolean {
  return deliveryLinkDisplayStatus(link, now) === "active";
}

export function expirationDateToTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const localEndOfDay = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999
  );
  return localEndOfDay.toISOString();
}
