import type {
  AIFrameworkMapping,
  AISystemControl,
  ControlReadinessSummary,
  RecommendedControl,
} from "./types";
import { frameworkMappingsForControl } from "./frameworks";

type ControlStatusOnly = Pick<AISystemControl, "status">;

export type ControlTaskSeed = {
  org_id: string;
  ai_system_id: string;
  control_key: string;
  title: string;
  category: string;
  priority: RecommendedControl["priority"];
  reason: string;
  framework_mappings: AIFrameworkMapping[];
  source_assessment_id: string;
};

export function isClosedControl(status: ControlStatusOnly["status"]): boolean {
  return status === "completed" || status === "waived";
}

export function calculateControlReadiness(
  controls: ControlStatusOnly[]
): ControlReadinessSummary {
  const total = controls.length;
  const completed = controls.filter((control) => control.status === "completed").length;
  const waived = controls.filter((control) => control.status === "waived").length;
  const inProgress = controls.filter((control) => control.status === "in_progress").length;
  const notStarted = controls.filter((control) => control.status === "not_started").length;
  const closed = completed + waived;
  const open = notStarted + inProgress;

  return {
    total,
    open,
    notStarted,
    inProgress,
    completed,
    waived,
    closed,
    readinessPercent: total === 0 ? 100 : Math.round((closed / total) * 100),
  };
}

export function buildControlTaskSeeds(params: {
  orgId: string;
  aiSystemId: string;
  assessmentId: string;
  controls: RecommendedControl[];
}): ControlTaskSeed[] {
  const { orgId, aiSystemId, assessmentId, controls } = params;

  return controls.map((control) => ({
    org_id: orgId,
    ai_system_id: aiSystemId,
    control_key: control.key,
    title: control.title,
    category: control.category,
    priority: control.priority,
    reason: control.reason,
    framework_mappings:
      control.framework_mappings ??
      frameworkMappingsForControl({
        key: control.key,
        category: control.category,
      }),
    source_assessment_id: assessmentId,
  }));
}
