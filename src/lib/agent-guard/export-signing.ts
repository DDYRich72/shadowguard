import { createHmac } from "node:crypto";
import {
  canonicalizeAgentGuardExportPayload,
  type AgentGuardExportEvent,
} from "./export-foundation";

export function signAgentGuardExportPayload(
  payload: AgentGuardExportEvent,
  signingSecret: string
): string {
  return createHmac("sha256", signingSecret)
    .update(canonicalizeAgentGuardExportPayload(payload), "utf8")
    .digest("hex");
}
