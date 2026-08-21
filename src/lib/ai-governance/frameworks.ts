import type {
  AIFrameworkCoverageGroup,
  AIFrameworkCoverageItem,
  AIFrameworkDisplayGroup,
  AIFrameworkId,
  AIFrameworkMapping,
  AIFrameworkProfile,
  AISystemControl,
  RecommendedControl,
} from "./types";

export const frameworkDisplayGroupLabels: Record<AIFrameworkDisplayGroup, string> = {
  ai_governance: "AI Governance",
  audit_security_readiness: "Audit / Security Readiness",
  regulated_data_privacy: "Regulated Data / Privacy",
};

const frameworkDisplayGroupOrder: AIFrameworkDisplayGroup[] = [
  "ai_governance",
  "audit_security_readiness",
  "regulated_data_privacy",
];

export const frameworkCatalog: AIFrameworkProfile[] = [
  {
    id: "nist_ai_rmf",
    label: "NIST AI RMF-style",
    shortLabel: "NIST AI RMF",
    type: "ai_governance",
    status: "active",
    displayGroup: "ai_governance",
    guardrail: "Style mapping for AI risk management conversations; not a formal NIST assessment.",
    categories: ["Govern", "Map", "Measure", "Manage"],
  },
  {
    id: "iso_42001",
    label: "ISO 42001-style",
    shortLabel: "ISO 42001",
    type: "ai_governance",
    status: "active",
    displayGroup: "ai_governance",
    guardrail: "Style mapping for AI management system readiness; not certification or conformity.",
    categories: ["Governance", "Documentation", "Risk Management", "Monitoring"],
  },
  {
    id: "eu_ai_act_readiness",
    label: "EU AI Act readiness",
    shortLabel: "EU AI Act",
    type: "ai_governance",
    status: "preview",
    displayGroup: "ai_governance",
    guardrail: "Readiness and risk-classification support only; not a legal classification.",
    categories: ["Governance", "Risk Classification", "Human Oversight", "Documentation"],
  },
  {
    id: "soc2_readiness",
    label: "SOC 2 readiness / TSC-style",
    shortLabel: "SOC 2",
    type: "audit_readiness",
    status: "active",
    displayGroup: "audit_security_readiness",
    guardrail: "Readiness support for auditor/client conversations; not a SOC 2 report or compliance claim.",
    categories: ["Control Environment", "Risk Assessment", "Monitoring", "Vendor Management"],
  },
  {
    id: "iso_27001",
    label: "ISO 27001-style security management alignment",
    shortLabel: "ISO 27001",
    type: "security",
    status: "preview",
    displayGroup: "audit_security_readiness",
    guardrail: "Security management alignment only; not certification or conformity.",
    categories: ["Leadership", "Asset Management", "Supplier Relationships", "Logging"],
  },
  {
    id: "nist_csf",
    label: "NIST CSF-style cybersecurity alignment",
    shortLabel: "NIST CSF",
    type: "security",
    status: "preview",
    displayGroup: "audit_security_readiness",
    guardrail: "Cybersecurity framework alignment only; not a maturity rating or formal assessment.",
    categories: ["Govern", "Protect", "Detect", "Supply Chain"],
  },
  {
    id: "hipaa_aware",
    label: "HIPAA-aware AI usage readiness",
    shortLabel: "HIPAA-aware",
    type: "regulated_data",
    status: "active",
    displayGroup: "regulated_data_privacy",
    guardrail: "Regulated data readiness and evidence organization only; not a HIPAA compliance determination.",
    categories: ["PHI Handling", "Business Associate Review", "Audit Controls", "Use Review"],
  },
  {
    id: "gdpr_aware",
    label: "GDPR-aware privacy/data protection readiness",
    shortLabel: "GDPR-aware",
    type: "privacy",
    status: "active",
    displayGroup: "regulated_data_privacy",
    guardrail: "Privacy readiness and evidence organization only; not legal advice or a GDPR compliance determination.",
    categories: ["Purpose Limitation", "Processor Review", "DPIA Support", "Accountability"],
  },
  {
    id: "ccpa_cpra_aware",
    label: "CCPA/CPRA-aware privacy readiness",
    shortLabel: "CCPA/CPRA-aware",
    type: "privacy",
    status: "preview",
    displayGroup: "regulated_data_privacy",
    guardrail: "Privacy readiness and evidence organization only; not legal advice or a compliance determination.",
    categories: ["Notice Support", "Service Provider Review", "Data Use", "Privacy Review"],
  },
  {
    id: "glba_ftc_safeguards",
    label: "GLBA / FTC Safeguards-style readiness",
    shortLabel: "GLBA / FTC",
    type: "regulated_data",
    status: "preview",
    displayGroup: "regulated_data_privacy",
    guardrail: "Safeguards-style readiness support only; not a GLBA or FTC compliance determination.",
    categories: ["Customer Information", "Service Provider Oversight", "Risk Assessment", "Monitoring"],
  },
  {
    id: "ferpa_aware",
    label: "FERPA-aware education data readiness",
    shortLabel: "FERPA-aware",
    type: "regulated_data",
    status: "preview",
    displayGroup: "regulated_data_privacy",
    guardrail: "Education data readiness and evidence organization only; not a FERPA compliance determination.",
    categories: ["Education Records", "Vendor Review", "Access Review", "Redisclosure"],
  },
  {
    id: "pci_dss_aware",
    label: "PCI DSS-aware payment data readiness",
    shortLabel: "PCI DSS-aware",
    type: "regulated_data",
    status: "preview",
    displayGroup: "regulated_data_privacy",
    guardrail: "Payment data readiness and evidence organization only; not a PCI DSS compliance determination.",
    categories: ["Cardholder Data", "Service Provider Review", "Logging", "Scope Review"],
  },
];

export const frameworkCatalogById = Object.fromEntries(
  frameworkCatalog.map((profile) => [profile.id, profile])
) as Record<AIFrameworkId, AIFrameworkProfile>;

export const frameworkLabels = Object.fromEntries(
  frameworkCatalog.map((profile) => [profile.id, profile.label])
) as Record<AIFrameworkId, string>;

type MappingSeed = Omit<AIFrameworkMapping, "framework_label">;

function mapping(
  framework: AIFrameworkId,
  code: string,
  title: string,
  category: string
): MappingSeed {
  return { framework, code, title, category };
}

const defaultNistMapping = mapping(
  "nist_ai_rmf",
  "GOVERN",
  "Governance and accountability",
  "Govern"
);

const defaultIsoMapping = mapping(
  "iso_42001",
  "GOV",
  "AI governance responsibilities",
  "Governance"
);

const controlFrameworkMappings: Record<string, MappingSeed[]> = {
  "owner-assigned": [
    defaultNistMapping,
    defaultIsoMapping,
    mapping("eu_ai_act_readiness", "GOV", "AI governance accountability", "Governance"),
    mapping("soc2_readiness", "CC1", "Control environment accountability", "Control Environment"),
    mapping("iso_27001", "LEADERSHIP", "Security responsibility assignment", "Leadership"),
    mapping("nist_csf", "GV.OC", "Organizational cybersecurity governance", "Govern"),
  ],
  "approved-use-case": [
    mapping("nist_ai_rmf", "MAP", "Use case context and boundaries", "Map"),
    mapping("iso_42001", "DOC", "Documented AI system use and boundaries", "Documentation"),
    mapping("eu_ai_act_readiness", "CLASSIFY", "AI use case risk-classification support", "Risk Classification"),
    mapping("gdpr_aware", "PURPOSE", "Purpose and processing boundary support", "Purpose Limitation"),
    mapping("ccpa_cpra_aware", "NOTICE", "Consumer notice and use boundary support", "Notice Support"),
  ],
  "vendor-review": [
    mapping("nist_ai_rmf", "MANAGE", "Third-party AI risk treatment", "Manage"),
    mapping("iso_42001", "SUPPLIER", "Supplier and third-party management", "Supplier Management"),
    mapping("soc2_readiness", "CC9", "Vendor and third-party risk support", "Vendor Management"),
    mapping("hipaa_aware", "BA", "Business associate review support", "Business Associate Review"),
    mapping("gdpr_aware", "PROCESSOR", "Processor and DPA evidence support", "Processor Review"),
    mapping("ccpa_cpra_aware", "SERVICE_PROVIDER", "Service provider review support", "Service Provider Review"),
    mapping("glba_ftc_safeguards", "SERVICE_PROVIDER", "Service provider safeguards support", "Service Provider Oversight"),
    mapping("ferpa_aware", "VENDOR", "Education data vendor review support", "Vendor Review"),
    mapping("pci_dss_aware", "12.8", "Service provider review support", "Service Provider Review"),
    mapping("iso_27001", "SUPPLIER", "Supplier relationship security support", "Supplier Relationships"),
    mapping("nist_csf", "GV.SC", "Cyber supply chain risk support", "Supply Chain"),
  ],
  "data-handling-rules": [
    mapping("nist_ai_rmf", "MAP", "Data context and impact mapping", "Map"),
    mapping("iso_42001", "DATA", "Data and resource governance", "Data Governance"),
    mapping("hipaa_aware", "PHI", "PHI handling boundary support", "PHI Handling"),
    mapping("gdpr_aware", "DATA", "Personal data handling support", "Accountability"),
    mapping("ccpa_cpra_aware", "DATA_USE", "Personal information use boundary support", "Data Use"),
    mapping("glba_ftc_safeguards", "CUSTOMER_INFO", "Customer information handling support", "Customer Information"),
    mapping("ferpa_aware", "ED_RECORDS", "Education record handling support", "Education Records"),
    mapping("pci_dss_aware", "CHD", "Cardholder data handling support", "Cardholder Data"),
    mapping("iso_27001", "ASSET", "Information classification and handling support", "Asset Management"),
    mapping("nist_csf", "PR.DS", "Data security protection support", "Protect"),
  ],
  "human-oversight": [
    mapping("nist_ai_rmf", "MANAGE", "Human oversight and risk response", "Manage"),
    mapping("iso_42001", "OVERSIGHT", "Human oversight responsibilities", "Human Oversight"),
    mapping("eu_ai_act_readiness", "OVERSIGHT", "Human oversight readiness support", "Human Oversight"),
    mapping("soc2_readiness", "CC5", "Control activity oversight support", "Control Activities"),
  ],
  "usage-logging": [
    mapping("nist_ai_rmf", "MEASURE", "Monitoring and measurement", "Measure"),
    mapping("iso_42001", "MONITOR", "Monitoring, auditability, and improvement", "Monitoring"),
    mapping("soc2_readiness", "CC7", "Monitoring and detection evidence support", "Monitoring"),
    mapping("hipaa_aware", "AUDIT", "Audit control evidence support", "Audit Controls"),
    mapping("gdpr_aware", "ACCOUNTABILITY", "Processing accountability evidence support", "Accountability"),
    mapping("glba_ftc_safeguards", "MONITORING", "Safeguards monitoring evidence support", "Monitoring"),
    mapping("ferpa_aware", "ACCESS_REVIEW", "Access review evidence support", "Access Review"),
    mapping("pci_dss_aware", "LOGGING", "Payment data logging evidence support", "Logging"),
    mapping("iso_27001", "LOGGING", "Event logging evidence support", "Logging"),
    mapping("nist_csf", "DE.CM", "Continuous monitoring evidence support", "Detect"),
  ],
  "regulated-use-review": [
    mapping("nist_ai_rmf", "MAP", "Impact context and affected stakeholders", "Map"),
    mapping("iso_42001", "RISK", "AI risk assessment and treatment", "Risk Management"),
    mapping("eu_ai_act_readiness", "RISK_CLASS", "High-impact use review support", "Risk Classification"),
    mapping("soc2_readiness", "CC3", "Risk assessment evidence support", "Risk Assessment"),
    mapping("hipaa_aware", "USE_REVIEW", "Regulated health data use review support", "Use Review"),
    mapping("gdpr_aware", "DPIA", "Data protection impact review support", "DPIA Support"),
    mapping("ccpa_cpra_aware", "PRIVACY_REVIEW", "Privacy impact review support", "Privacy Review"),
    mapping("glba_ftc_safeguards", "RISK_ASSESS", "Customer information risk review support", "Risk Assessment"),
    mapping("ferpa_aware", "ED_REVIEW", "Education data use review support", "Education Records"),
    mapping("pci_dss_aware", "SCOPE", "Payment data scope review support", "Scope Review"),
  ],
  "executive-approval": [
    defaultNistMapping,
    mapping("iso_42001", "GOV", "Leadership accountability and approval", "Governance"),
    mapping("eu_ai_act_readiness", "GOV", "Accountable approval support", "Governance"),
    mapping("soc2_readiness", "CC1", "Leadership oversight support", "Control Environment"),
    mapping("iso_27001", "LEADERSHIP", "Leadership commitment support", "Leadership"),
    mapping("nist_csf", "GV.RR", "Roles, responsibilities, and authorities support", "Govern"),
  ],
  "training-data-opt-out": [
    mapping("nist_ai_rmf", "MANAGE", "Data-use risk treatment", "Manage"),
    mapping("iso_42001", "SUPPLIER", "Supplier data-use controls", "Supplier Management"),
    mapping("soc2_readiness", "C1", "Confidentiality evidence support", "Vendor Management"),
    mapping("gdpr_aware", "TRAINING_USE", "Training-data processing boundary support", "Processor Review"),
    mapping("ccpa_cpra_aware", "SALE_SHARE", "Data sharing and training-use boundary support", "Data Use"),
    mapping("glba_ftc_safeguards", "DATA_USE", "Customer information training-use support", "Customer Information"),
    mapping("ferpa_aware", "REDISCLOSURE", "Education data redisclosure support", "Redisclosure"),
    mapping("pci_dss_aware", "DATA_USE", "Payment data training-use boundary support", "Cardholder Data"),
    mapping("iso_27001", "SUPPLIER", "Supplier data-use security support", "Supplier Relationships"),
    mapping("nist_csf", "GV.SC", "Supplier data-use risk support", "Supply Chain"),
  ],
};

function isClosedStatus(status: AISystemControl["status"]): boolean {
  return status === "completed" || status === "waived";
}

function withFrameworkLabels(mappings: MappingSeed[]): AIFrameworkMapping[] {
  return mappings.map((item) => ({
    ...item,
    framework_label: frameworkLabels[item.framework],
  }));
}

export function frameworkMappingsForControl(
  control: Pick<RecommendedControl, "key" | "category">
): AIFrameworkMapping[] {
  const explicit = controlFrameworkMappings[control.key];
  if (explicit) return withFrameworkLabels(explicit);

  const category = control.category.toLowerCase();
  if (category.includes("vendor")) {
    return withFrameworkLabels(controlFrameworkMappings["vendor-review"]);
  }
  if (category.includes("data")) {
    return withFrameworkLabels(controlFrameworkMappings["data-handling-rules"]);
  }
  if (category.includes("audit") || category.includes("log")) {
    return withFrameworkLabels(controlFrameworkMappings["usage-logging"]);
  }
  if (category.includes("approval") || category.includes("owner")) {
    return withFrameworkLabels([defaultNistMapping, defaultIsoMapping]);
  }

  return withFrameworkLabels([defaultNistMapping, defaultIsoMapping]);
}

function normalizeControlMappings(control: AISystemControl): AIFrameworkMapping[] {
  if (Array.isArray(control.framework_mappings) && control.framework_mappings.length > 0) {
    return control.framework_mappings;
  }
  return frameworkMappingsForControl({
    key: control.control_key,
    category: control.category,
  });
}

export function frameworkMappingSummary(mappings: AIFrameworkMapping[]): string {
  return mappings
    .map((item) => `${item.framework_label} ${item.code}`)
    .join(", ");
}

function enrichCoverageItem(mapping: AIFrameworkMapping): Omit<
  AIFrameworkCoverageItem,
  "totalControls" | "openControls" | "closedControls" | "readinessPercent"
> {
  const profile = frameworkCatalogById[mapping.framework];
  const displayGroup = profile.displayGroup;

  return {
    framework: mapping.framework,
    framework_label: mapping.framework_label || profile.label,
    framework_short_label: profile.shortLabel,
    framework_type: profile.type,
    framework_status: profile.status,
    display_group: displayGroup,
    display_group_label: frameworkDisplayGroupLabels[displayGroup],
    guardrail: profile.guardrail,
    code: mapping.code,
    title: mapping.title,
    category: mapping.category,
  };
}

export function calculateFrameworkCoverage(
  controls: AISystemControl[]
): AIFrameworkCoverageItem[] {
  const grouped = new Map<string, AIFrameworkCoverageItem>();

  for (const control of controls) {
    for (const mapping of normalizeControlMappings(control)) {
      const key = `${mapping.framework}:${mapping.code}:${mapping.category}`;
      const current = grouped.get(key) ?? {
        ...enrichCoverageItem(mapping),
        totalControls: 0,
        openControls: 0,
        closedControls: 0,
        readinessPercent: 100,
      };

      current.totalControls += 1;
      if (isClosedStatus(control.status)) {
        current.closedControls += 1;
      } else {
        current.openControls += 1;
      }
      current.readinessPercent =
        current.totalControls === 0
          ? 100
          : Math.round((current.closedControls / current.totalControls) * 100);
      grouped.set(key, current);
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const groupDelta =
      frameworkDisplayGroupOrder.indexOf(a.display_group) -
      frameworkDisplayGroupOrder.indexOf(b.display_group);
    if (groupDelta !== 0) return groupDelta;

    const frameworkDelta = a.framework_label.localeCompare(b.framework_label);
    if (frameworkDelta !== 0) return frameworkDelta;
    return a.category.localeCompare(b.category);
  });
}

function itemWithCatalogDefaults(item: AIFrameworkCoverageItem): AIFrameworkCoverageItem {
  const profile = frameworkCatalogById[item.framework];
  const displayGroup = item.display_group ?? profile.displayGroup;

  return {
    ...item,
    framework_label: item.framework_label || profile.label,
    framework_short_label: item.framework_short_label ?? profile.shortLabel,
    framework_type: item.framework_type ?? profile.type,
    framework_status: item.framework_status ?? profile.status,
    display_group: displayGroup,
    display_group_label: item.display_group_label ?? frameworkDisplayGroupLabels[displayGroup],
    guardrail: item.guardrail ?? profile.guardrail,
  };
}

export function groupFrameworkCoverage(
  coverage: AIFrameworkCoverageItem[]
): AIFrameworkCoverageGroup[] {
  const grouped = new Map<AIFrameworkDisplayGroup, AIFrameworkCoverageItem[]>();

  for (const item of coverage) {
    const enriched = itemWithCatalogDefaults(item);
    const items = grouped.get(enriched.display_group) ?? [];
    items.push(enriched);
    grouped.set(enriched.display_group, items);
  }

  return frameworkDisplayGroupOrder
    .map((id) => ({
      id,
      label: frameworkDisplayGroupLabels[id],
      items: grouped.get(id) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}
