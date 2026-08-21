export type KitSection = {
  title: string;
  items: string[];
};

export type DeliveryStep = {
  title: string;
  description: string;
  route?: string;
};

export type AssessmentTemplate = {
  name: string;
  audience: string;
  outcome: string;
  deliverables: string[];
  timeline: string;
};

export const manualInventoryCsvColumns = [
  "system_name",
  "department",
  "owner_name",
  "owner_email",
  "vendor_name",
  "model_or_product",
  "use_case",
  "business_process",
  "data_sensitivity",
  "data_types",
  "customer_facing",
  "employee_facing",
  "automated_decisions",
  "human_review_required",
  "training_data_use",
  "approval_status",
  "next_review_date",
  "evidence_notes",
] as const;

export const manualInventoryCsvSample = [
  "Customer Support Assistant",
  "Support Ops",
  "Casey Morgan",
  "casey@example.com",
  "OpenAI",
  "ChatGPT Team",
  "Draft customer support replies from ticket context",
  "Customer support",
  "confidential",
  "customer ticket context; account notes",
  "yes",
  "yes",
  "no",
  "yes",
  "opt_out",
  "under_review",
  "2026-09-30",
  "SOC 2 and DPA need review",
] as const;

export const manualInventoryCsvPath = "/templates/shadowguard-ai-inventory-intake.csv";

export function buildManualInventoryCsv(): string {
  const rows = [manualInventoryCsvColumns, manualInventoryCsvSample];
  return rows
    .map((row) =>
      row
        .map((value) => {
          const stringValue = String(value);
          return stringValue.includes(",") || stringValue.includes(";")
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        })
        .join(",")
    )
    .join("\n");
}

export const assessmentKit = {
  offer: {
    title: "AI Governance Readiness Assessment",
    promise:
      "Identify where AI is being used, which use cases carry risk, and what controls are missing before adoption expands.",
    idealFor: [
      "Family offices evaluating AI use across portfolio companies.",
      "Operators responsible for AI governance, security, compliance, or IT.",
      "Companies using AI tools without a formal inventory.",
      "Advisory teams that need a practical readiness workflow.",
    ],
    deliverables: [
      "AI system inventory.",
      "Risk-ranked use case assessment.",
      "Governance controls checklist.",
      "Evidence gap summary.",
      "Leadership-ready readiness report.",
      "Prioritized next-action roadmap.",
    ],
  },
  packages: [
    {
      name: "AI Governance Readiness Assessment",
      audience: "SMBs and lean operators using AI without a formal inventory.",
      outcome:
        "A practical view of current AI use, ranked risk, missing controls, and the next actions leadership can approve.",
      deliverables: [
        "AI system inventory.",
        "Risk-ranked use case assessment.",
        "Governance controls checklist.",
        "Evidence gap summary.",
        "Leadership-ready report and roadmap.",
      ],
      timeline: "1 week with a prepared inventory.",
    },
    {
      name: "Family Office AI Risk Review",
      audience:
        "Family offices and operators overseeing AI adoption across portfolio companies or operating entities.",
      outcome:
        "A board-ready oversight view of where AI is being used, which use cases create exposure, and what proof is missing.",
      deliverables: [
        "Portfolio/company AI usage inventory.",
        "High-risk use case summary.",
        "Owner and department accountability map.",
        "Control and evidence gap review.",
        "Executive briefing pack.",
      ],
      timeline: "1-2 weeks depending on entity count.",
    },
    {
      name: "Leadership AI Governance Pack",
      audience:
        "Advisory, legal, accounting, healthcare, and security teams that need proof artifacts for clients or leadership.",
      outcome:
        "A controlled governance deliverable that shows AI usage, readiness, evidence gaps, and remediation status.",
      deliverables: [
        "Finalized governance report snapshot.",
        "Client export pack.",
        "PDF deliverable.",
        "Secure delivery link.",
        "Review and remediation record for internal operators.",
      ],
      timeline: "Built from an approved ShadowGuard report snapshot.",
    },
  ] satisfies AssessmentTemplate[],
  intakeChecklist: [
    {
      title: "Inventory",
      items: [
        "Which AI tools are approved, tolerated, or unknown?",
        "Which departments are using AI in daily workflows?",
        "Which use cases should be reviewed first?",
      ],
    },
    {
      title: "Data And Impact",
      items: [
        "Which systems touch customer, employee, confidential, or regulated data?",
        "Can AI output reach customers or regulated decisions?",
        "Is human review required before output is used?",
      ],
    },
    {
      title: "Governance",
      items: [
        "Who owns each AI use case?",
        "Which vendors have legal, security, SOC 2, or DPA review?",
        "Is usage logging available?",
        "What evidence links or policy documents already exist?",
      ],
    },
  ] satisfies KitSection[],
  workflow: [
    {
      title: "Collect Inventory",
      description: "Use discovery, manual entry, or the CSV template to identify meaningful AI use cases.",
      route: "/dashboard/ai-systems",
    },
    {
      title: "Register AI Systems",
      description: "Create one AI System per use case, owner, and business process.",
      route: "/dashboard/ai-systems/new",
    },
    {
      title: "Assess Risk",
      description: "Complete the risk assessment to generate a tier, score, and recommended controls.",
    },
    {
      title: "Track Controls",
      description: "Assign owners, update statuses, and capture evidence metadata for required safeguards.",
    },
    {
      title: "Generate Report",
      description: "Use the Governance Readiness Report to present risk, readiness, evidence, and next actions.",
    },
  ] satisfies DeliveryStep[],
  kickoffAgenda: [
    "Confirm assessment scope, review audience, and final deliverable format.",
    "Review known AI tools, business-critical workflows, and departments in scope.",
    "Confirm data sensitivity boundaries and what should not be uploaded into ShadowGuard.",
    "Assign organization owners for inventory, evidence, and report review.",
    "Set the target date for the executive readout.",
  ],
  materialsRequest: [
    "Current list of approved, tolerated, and suspected AI tools.",
    "Department owner names and emails for key AI use cases.",
    "Vendor security reviews, DPAs, SOC reports, or procurement notes already available.",
    "Relevant AI usage policy, acceptable-use language, or employee guidance.",
    "Evidence links for logging, human review, access controls, and vendor review.",
  ],
  deliveryChecklist: [
    "Inventory imported or entered as AI Systems.",
    "Risk assessment completed for each meaningful use case.",
    "Recommended controls reviewed and owner/status fields updated.",
    "Evidence records added or gaps documented.",
    "Organization or system report snapshot saved.",
    "Internal review completed before Final status.",
    "Client export pack and PDF generated from the finalized snapshot.",
    "Secure delivery link created only after final approval.",
  ],
  executiveReadout: [
    "Start with the highest-risk AI use cases and why they matter.",
    "Show readiness score, unresolved controls, and evidence gaps.",
    "Separate quick wins from policy, vendor, and technical follow-up.",
    "Avoid certification language; position the output as readiness and governance evidence.",
    "Close with a 30-day remediation roadmap and named owners.",
  ],
  conversationGuide: [
    "What AI decisions or outputs would create the most concern if they were wrong?",
    "Where do employees already use AI outside formal procurement?",
    "Which AI use cases touch client, investor, employee, financial, or regulated data?",
    "Who would need to approve expanded AI use?",
    "What proof would leadership want before calling a system governed?",
  ],
  successMetrics: [
    "All material AI systems inventoried.",
    "Risk assessments completed for every in-scope system.",
    "Control owners and next review dates assigned.",
    "Evidence gaps recorded before final report approval.",
  ],
  guardrails: [
    "Do not claim certification or legal compliance.",
    "Do not upload sensitive customer data into demos.",
    "Do not send external reports without approval.",
    "Enable optional integrations only when the installer supplies and approves the required credentials.",
  ],
} as const;
