import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  processAgentGuardAutomaticExports,
  type AgentExportDestinationRow,
  type AgentGuardAutomaticExportDatabase,
} from "../automatic-export";
import { encryptAgentExportSigningSecret } from "../export-destinations";
import {
  agentGuardSampleExportEvent,
  buildAgentGuardExportEvent,
} from "../export-foundation";

const TEST_EXPORT_SECRET_KEY = "unit-test-agent-export-secret-key";
let previousExportSecretKey: string | undefined;

function createThenableChain<T>(
  result: T,
  onEq?: (column: string, value: unknown) => void
) {
  const chain = {
    eq: vi.fn((column: string, value: unknown) => {
      onEq?.(column, value);
      return chain;
    }),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled?: ((value: T) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return chain;
}

function destination(
  overrides: Partial<AgentExportDestinationRow> = {}
): AgentExportDestinationRow {
  return {
    id: "dest-1",
    org_id: "org-1",
    name: "Security webhook",
    destination_type: "webhook",
    status: "enabled",
    endpoint_url: "https://example.com/agentguard",
    signing_secret_encrypted: encryptAgentExportSigningSecret("receiver-secret"),
    signing_secret_hint: "sgae_...test",
    automatic_delivery_enabled: true,
    dry_run_enabled: true,
    event_types: ["agentguard.activity.evaluated"],
    ...overrides,
  };
}

function createExportDb(destinations: AgentExportDestinationRow[]) {
  const filters: Array<[string, unknown]> = [];
  const attempts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const db = {
    from(table: string) {
      if (table === "agent_export_destinations") {
        return {
          select: vi.fn(() =>
            createThenableChain({ data: destinations, error: null }, (column, value) => {
              filters.push([column, value]);
            })
          ),
          insert: vi.fn(),
          update: vi.fn((values: Record<string, unknown>) => {
            updates.push(values);
            return createThenableChain({ error: null });
          }),
        };
      }

      if (table === "agent_export_delivery_attempts") {
        return {
          select: vi.fn(),
          insert: vi.fn((values: Record<string, unknown>) => {
            attempts.push(values);
            return Promise.resolve({ error: null });
          }),
          update: vi.fn(),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return {
    db: db as unknown as AgentGuardAutomaticExportDatabase,
    attempts,
    filters,
    updates,
  };
}

beforeEach(() => {
  previousExportSecretKey = process.env.AGENT_GUARD_EXPORT_SECRET_KEY;
  process.env.AGENT_GUARD_EXPORT_SECRET_KEY = TEST_EXPORT_SECRET_KEY;
});

afterEach(() => {
  if (previousExportSecretKey === undefined) {
    delete process.env.AGENT_GUARD_EXPORT_SECRET_KEY;
  } else {
    process.env.AGENT_GUARD_EXPORT_SECRET_KEY = previousExportSecretKey;
  }
  vi.restoreAllMocks();
});

describe("AgentGuard automatic export processing", () => {
  it("logs dry-run attempts from ingest without outbound delivery", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const { db, attempts, updates } = createExportDb([
      destination({
        dry_run_enabled: true,
        signing_secret_encrypted: "invalid-and-unused-in-dry-run",
      }),
    ]);

    const results = await processAgentGuardAutomaticExports(
      db,
      "org-1",
      agentGuardSampleExportEvent(),
      { fetchImpl }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("dry_run");
    expect(results[0]?.deliveryMode).toBe("dry_run");
    expect(attempts[0]).toMatchObject({
      org_id: "org-1",
      destination_id: "dest-1",
      status: "dry_run",
      delivery_mode: "dry_run",
      http_status: null,
    });
    expect(updates[0]).toHaveProperty("last_automatic_attempt_at");
  });

  it("sends and logs live automatic delivery only when dry-run is off", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const { db, attempts } = createExportDb([
      destination({ dry_run_enabled: false }),
    ]);

    const results = await processAgentGuardAutomaticExports(
      db,
      "org-1",
      agentGuardSampleExportEvent(),
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(results[0]).toMatchObject({
      destinationId: "dest-1",
      status: "succeeded",
      deliveryMode: "automatic",
      httpStatus: 204,
    });
    expect(attempts[0]).toMatchObject({
      status: "succeeded",
      delivery_mode: "automatic",
      http_status: 204,
    });
  });

  it("skips disabled, automatic-off, and event-type mismatch destinations", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const { db, attempts } = createExportDb([
      destination({ id: "disabled", status: "disabled" }),
      destination({ id: "auto-off", automatic_delivery_enabled: false }),
      destination({ id: "blocked-only", event_types: ["agentguard.policy.blocked"] }),
    ]);

    const results = await processAgentGuardAutomaticExports(
      db,
      "org-1",
      agentGuardSampleExportEvent(),
      { fetchImpl }
    );

    expect(results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(attempts).toEqual([]);
  });

  it("routes review-required events only to destinations that selected them", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const reviewEvent = buildAgentGuardExportEvent({
      id: "activity-review",
      orgId: "org-1",
      toolName: "Claude",
      userEmail: "analyst@example.com",
      activityType: "prompt_sent",
      riskLevel: "medium",
      blocked: false,
      dataClassification: {
        sensitivity: "confidential",
        categories: ["customer_context"],
        piiDetected: true,
        credentialsDetected: false,
        proprietaryDetected: false,
      },
      contentLength: 120,
      eventType: "agentguard.review.required",
    });
    const { db, attempts } = createExportDb([
      destination({ id: "activity-only", event_types: ["agentguard.activity.evaluated"] }),
      destination({
        id: "review-routing",
        dry_run_enabled: false,
        event_types: ["agentguard.review.required"],
      }),
    ]);

    const results = await processAgentGuardAutomaticExports(
      db,
      "org-1",
      reviewEvent,
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      destinationId: "review-routing",
      eventType: "agentguard.review.required",
      status: "succeeded",
    });
    expect(attempts[0]).toMatchObject({
      destination_id: "review-routing",
      event_type: "agentguard.review.required",
    });
  });
});
