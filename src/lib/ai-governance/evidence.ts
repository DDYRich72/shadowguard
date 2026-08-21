import { isClosedControl } from "./controls";
import type {
  AISystemControl,
  AISystemEvidence,
} from "./types";

export type ControlEvidenceGroup = {
  control: AISystemControl;
  evidence: AISystemEvidence[];
  hasLegacyEvidence: boolean;
};

export function hasLegacyControlEvidence(control: AISystemControl): boolean {
  return Boolean(control.evidence_url?.trim() || control.evidence_text?.trim());
}

export function groupEvidenceByControl(
  evidenceRecords: AISystemEvidence[]
): Map<string, AISystemEvidence[]> {
  const grouped = new Map<string, AISystemEvidence[]>();

  for (const evidence of evidenceRecords) {
    if (!evidence.control_id) continue;
    const existing = grouped.get(evidence.control_id) ?? [];
    existing.push(evidence);
    grouped.set(evidence.control_id, existing);
  }

  for (const [controlId, records] of grouped) {
    grouped.set(controlId, sortEvidenceForDisplay(records));
  }

  return grouped;
}

export function sortEvidenceForDisplay(records: AISystemEvidence[]): AISystemEvidence[] {
  return [...records].sort((a, b) => {
    const statusDelta = evidenceStatusRank(a.status) - evidenceStatusRank(b.status);
    if (statusDelta !== 0) return statusDelta;
    return a.title.localeCompare(b.title);
  });
}

export function evidenceStatusRank(status: AISystemEvidence["status"]): number {
  switch (status) {
    case "current":
      return 0;
    case "needs_review":
      return 1;
    case "draft":
      return 2;
    case "expired":
      return 3;
  }
}

export function hasLinkedEvidence(
  control: AISystemControl,
  evidenceRecords: AISystemEvidence[]
): boolean {
  return evidenceRecords.some((evidence) => evidence.control_id === control.id);
}

export function hasControlEvidence(
  control: AISystemControl,
  evidenceRecords: AISystemEvidence[] = []
): boolean {
  return hasLegacyControlEvidence(control) || hasLinkedEvidence(control, evidenceRecords);
}

export function buildControlEvidenceGroups(
  controls: AISystemControl[],
  evidenceRecords: AISystemEvidence[]
): ControlEvidenceGroup[] {
  const evidenceByControl = groupEvidenceByControl(evidenceRecords);

  return controls.map((control) => ({
    control,
    evidence: evidenceByControl.get(control.id) ?? [],
    hasLegacyEvidence: hasLegacyControlEvidence(control),
  }));
}

export function evidenceGapsForControls(
  controls: AISystemControl[],
  evidenceRecords: AISystemEvidence[] = []
): AISystemControl[] {
  return controls.filter(
    (control) => isClosedControl(control.status) && !hasControlEvidence(control, evidenceRecords)
  );
}
