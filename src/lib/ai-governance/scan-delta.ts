/**
 * Scan delta computation (spec 024).
 *
 * Pure functions only — callers fetch two scans' worth of
 * scan_app_results rows and hand them here. Matching key is
 * canonical_name (already lowercased/trimmed by the scan pipeline).
 */

export type ScanAppRecord = {
  canonicalName: string;
  appName: string;
  isAiTool: boolean;
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  scopes: string[];
  userCount: number;
  sourcePlatforms: string[];
};

export type RiskChange = {
  app: ScanAppRecord;
  previousScore: number;
  change: number;
  /** |change| >= SIGNIFICANT_RISK_CHANGE — UI emphasis. */
  significant: boolean;
};

export type ScopeAddition = {
  app: ScanAppRecord;
  addedScopes: string[];
};

export type AdoptionChange = {
  app: ScanAppRecord;
  previousUserCount: number;
  change: number;
};

export type ScanDeltaSummary = {
  newApps: number;
  newAiTools: number;
  removedApps: number;
  riskIncreased: number;
  riskDecreased: number;
  scopeExpansions: number;
  netUserChange: number;
};

export type ScanDelta = {
  newApps: ScanAppRecord[];
  removedApps: ScanAppRecord[];
  riskIncreases: RiskChange[];
  riskDecreases: RiskChange[];
  scopeAdditions: ScopeAddition[];
  adoptionChanges: AdoptionChange[];
  summary: ScanDeltaSummary;
};

/** Serializable subset embedded in governance report snapshots. */
export type ScanDeltaSection = {
  fromScannedAt: string;
  toScannedAt: string;
  summary: ScanDeltaSummary;
  newApps: Array<{ appName: string; isAiTool: boolean; riskLevel: string; userCount: number }>;
  riskIncreases: Array<{ appName: string; previousScore: number; currentScore: number }>;
  scopeAdditions: Array<{ appName: string; addedScopes: string[] }>;
};

export const SIGNIFICANT_RISK_CHANGE = 10;

const SECTION_ITEM_CAP = 10;

function byCanonical(records: ScanAppRecord[]): Map<string, ScanAppRecord> {
  const map = new Map<string, ScanAppRecord>();
  for (const r of records) {
    const key = r.canonicalName.toLowerCase().trim();
    // Last write wins; duplicate canonical names within one scan should
    // not happen (UNIQUE upsert key upstream) but don't explode if they do.
    map.set(key, r);
  }
  return map;
}

/**
 * Diff two scans. `from` is the older scan's app records, `to` the
 * newer. An empty `from` treats everything in `to` as new (first scan).
 */
export function buildScanDelta(
  from: ScanAppRecord[],
  to: ScanAppRecord[]
): ScanDelta {
  const fromMap = byCanonical(from);
  const toMap = byCanonical(to);

  const newApps: ScanAppRecord[] = [];
  const removedApps: ScanAppRecord[] = [];
  const riskIncreases: RiskChange[] = [];
  const riskDecreases: RiskChange[] = [];
  const scopeAdditions: ScopeAddition[] = [];
  const adoptionChanges: AdoptionChange[] = [];

  let fromUsers = 0;
  for (const r of fromMap.values()) fromUsers += r.userCount;
  let toUsers = 0;
  for (const r of toMap.values()) toUsers += r.userCount;

  for (const [key, curr] of toMap) {
    const prev = fromMap.get(key);
    if (!prev) {
      newApps.push(curr);
      continue;
    }

    const scoreChange = curr.riskScore - prev.riskScore;
    if (scoreChange > 0) {
      riskIncreases.push({
        app: curr,
        previousScore: prev.riskScore,
        change: scoreChange,
        significant: scoreChange >= SIGNIFICANT_RISK_CHANGE,
      });
    } else if (scoreChange < 0) {
      riskDecreases.push({
        app: curr,
        previousScore: prev.riskScore,
        change: scoreChange,
        significant: -scoreChange >= SIGNIFICANT_RISK_CHANGE,
      });
    }

    const prevScopes = new Set(prev.scopes);
    const addedScopes = curr.scopes.filter((s) => !prevScopes.has(s));
    if (addedScopes.length > 0) {
      scopeAdditions.push({ app: curr, addedScopes });
    }

    const userChange = curr.userCount - prev.userCount;
    if (userChange !== 0) {
      adoptionChanges.push({
        app: curr,
        previousUserCount: prev.userCount,
        change: userChange,
      });
    }
  }

  for (const [key, prev] of fromMap) {
    if (!toMap.has(key)) removedApps.push(prev);
  }

  // Highest-risk / largest-change items first so capped views surface
  // what matters.
  newApps.sort((a, b) => b.riskScore - a.riskScore);
  removedApps.sort((a, b) => b.riskScore - a.riskScore);
  riskIncreases.sort((a, b) => b.change - a.change);
  riskDecreases.sort((a, b) => a.change - b.change);
  scopeAdditions.sort((a, b) => b.addedScopes.length - a.addedScopes.length);
  adoptionChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return {
    newApps,
    removedApps,
    riskIncreases,
    riskDecreases,
    scopeAdditions,
    adoptionChanges,
    summary: {
      newApps: newApps.length,
      newAiTools: newApps.filter((a) => a.isAiTool).length,
      removedApps: removedApps.length,
      riskIncreased: riskIncreases.length,
      riskDecreased: riskDecreases.length,
      scopeExpansions: scopeAdditions.length,
      netUserChange: toUsers - fromUsers,
    },
  };
}

export function hasChanges(delta: ScanDelta): boolean {
  const s = delta.summary;
  return (
    s.newApps > 0 ||
    s.removedApps > 0 ||
    s.riskIncreased > 0 ||
    s.riskDecreased > 0 ||
    s.scopeExpansions > 0 ||
    s.netUserChange !== 0
  );
}

/**
 * Serializable, capped representation for embedding in a governance
 * report snapshot. Caps each list at SECTION_ITEM_CAP so snapshots stay
 * compact regardless of tenant size.
 */
export function toScanDeltaSection(
  delta: ScanDelta,
  fromScannedAt: string,
  toScannedAt: string
): ScanDeltaSection {
  return {
    fromScannedAt,
    toScannedAt,
    summary: delta.summary,
    newApps: delta.newApps.slice(0, SECTION_ITEM_CAP).map((a) => ({
      appName: a.appName,
      isAiTool: a.isAiTool,
      riskLevel: a.riskLevel,
      userCount: a.userCount,
    })),
    riskIncreases: delta.riskIncreases.slice(0, SECTION_ITEM_CAP).map((r) => ({
      appName: r.app.appName,
      previousScore: r.previousScore,
      currentScore: r.app.riskScore,
    })),
    scopeAdditions: delta.scopeAdditions.slice(0, SECTION_ITEM_CAP).map((s) => ({
      appName: s.app.appName,
      addedScopes: s.addedScopes,
    })),
  };
}

/** Map a scan_app_results DB row to the pure record shape. */
export function recordFromRow(row: {
  canonical_name: string;
  app_name: string;
  is_ai_tool: boolean | null;
  risk_score: number | null;
  risk_level: string | null;
  scopes: string[] | null;
  user_count: number | null;
  source_platforms: string[] | null;
}): ScanAppRecord {
  const level = row.risk_level;
  return {
    canonicalName: row.canonical_name,
    appName: row.app_name,
    isAiTool: row.is_ai_tool ?? false,
    riskScore: row.risk_score ?? 0,
    riskLevel:
      level === "critical" || level === "high" || level === "medium" || level === "low"
        ? level
        : "low",
    scopes: row.scopes ?? [],
    userCount: row.user_count ?? 0,
    sourcePlatforms: row.source_platforms ?? [],
  };
}
