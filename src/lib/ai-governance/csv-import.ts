import type {
  AIDataSensitivity,
  AISystemApprovalStatus,
  AITrainingDataUse,
} from "./types";

export const AI_INVENTORY_IMPORT_MAX_ROWS = 250;

export type ExistingAISystemForImport = {
  id: string;
  name: string;
  use_case: string;
};

export type AISystemImportPayload = {
  name: string;
  description: string;
  ownerName: string;
  ownerEmail: string;
  department: string;
  vendorName: string;
  modelName: string;
  useCase: string;
  businessProcess: string;
  dataTypes: string[];
  dataSensitivity: AIDataSensitivity;
  customerFacing: boolean;
  employeeFacing: boolean;
  automatedDecisions: boolean;
  humanReviewRequired: boolean;
  trainingDataUse: AITrainingDataUse;
  approvalStatus: AISystemApprovalStatus;
  nextReviewDate: string;
  source: "import";
  connectedAppId: null;
};

export type AISystemImportPreviewStatus =
  | "ready"
  | "duplicate"
  | "error"
  | "created";

export type AISystemImportPreviewRow = {
  rowNumber: number;
  status: AISystemImportPreviewStatus;
  errors: string[];
  warnings: string[];
  duplicateOf?: {
    source: "existing" | "import";
    id?: string;
    name: string;
  };
  payload: AISystemImportPayload;
};

export type AISystemImportSummary = {
  totalRows: number;
  readyRows: number;
  duplicateRows: number;
  errorRows: number;
  createdRows: number;
  skippedRows: number;
};

export type AISystemImportPreview = {
  globalErrors: string[];
  rows: AISystemImportPreviewRow[];
  summary: AISystemImportSummary;
};

type ParsedCsv = {
  headers: string[];
  records: Array<{ rowNumber: number; values: string[] }>;
  globalErrors: string[];
};

const columnAliases: Record<string, string> = {
  ai_system: "system_name",
  ai_system_name: "system_name",
  name: "system_name",
  system: "system_name",
  usecase: "use_case",
  owner: "owner_name",
  model: "model_or_product",
  model_product: "model_or_product",
  product: "model_or_product",
  data: "data_types",
  sensitivity: "data_sensitivity",
  customer: "customer_facing",
  employee: "employee_facing",
  autonomous_actions: "automated_decisions",
  human_review: "human_review_required",
  training_use: "training_data_use",
  approval: "approval_status",
  review_date: "next_review_date",
  next_review: "next_review_date",
};

const requiredHeaders = ["system_name", "use_case"] as const;
const dataSensitivityValues = new Set<AIDataSensitivity>([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
const trainingDataUseValues = new Set<AITrainingDataUse>([
  "unknown",
  "none",
  "opt_out",
  "allowed",
]);
const approvalStatusValues = new Set<AISystemApprovalStatus>([
  "discovered",
  "under_review",
  "approved",
  "blocked",
  "retired",
]);

function emptyPayload(): AISystemImportPayload {
  return {
    name: "",
    description: "",
    ownerName: "",
    ownerEmail: "",
    department: "",
    vendorName: "",
    modelName: "",
    useCase: "",
    businessProcess: "",
    dataTypes: [],
    dataSensitivity: "internal",
    customerFacing: false,
    employeeFacing: false,
    automatedDecisions: false,
    humanReviewRequired: true,
    trainingDataUse: "unknown",
    approvalStatus: "under_review",
    nextReviewDate: "",
    source: "import",
    connectedAppId: null,
  };
}

function normalizeHeader(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return columnAliases[normalized] ?? normalized;
}

function normalizeEnum(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeDuplicatePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function duplicateKeyForAISystem(name: string, useCase: string): string {
  return `${normalizeDuplicatePart(name)}::${normalizeDuplicatePart(useCase)}`;
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
  label: string,
  errors: string[]
): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  errors.push(`${label} must be yes/no or true/false.`);
  return fallback;
}

function parseDataTypes(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function parseEmail(value: string, errors: string[]): string {
  const email = value.trim().toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("owner_email must be a valid email address.");
  }
  return email;
}

function parseDataSensitivity(value: string | undefined, errors: string[]): AIDataSensitivity {
  const normalized = normalizeEnum(value ?? "");
  if (!normalized) return "internal";
  if (dataSensitivityValues.has(normalized as AIDataSensitivity)) {
    return normalized as AIDataSensitivity;
  }
  errors.push("data_sensitivity must be public, internal, confidential, or restricted.");
  return "internal";
}

function parseTrainingDataUse(value: string | undefined, errors: string[]): AITrainingDataUse {
  const normalized = normalizeEnum(value ?? "");
  if (!normalized) return "unknown";
  if (trainingDataUseValues.has(normalized as AITrainingDataUse)) {
    return normalized as AITrainingDataUse;
  }
  errors.push("training_data_use must be unknown, none, opt_out, or allowed.");
  return "unknown";
}

function parseApprovalStatus(value: string | undefined, errors: string[]): AISystemApprovalStatus {
  const normalized = normalizeEnum(value ?? "");
  if (!normalized) return "under_review";
  if (approvalStatusValues.has(normalized as AISystemApprovalStatus)) {
    return normalized as AISystemApprovalStatus;
  }
  errors.push("approval_status must be discovered, under_review, approved, blocked, or retired.");
  return "under_review";
}

function parseReviewDate(value: string | undefined, errors: string[]): string {
  const date = (value ?? "").trim();
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push("next_review_date must be YYYY-MM-DD.");
    return "";
  }
  return date;
}

function isBlankRecord(values: string[]): boolean {
  return values.every((value) => value.trim() === "");
}

export function parseCsvText(csvText: string): ParsedCsv {
  const globalErrors: string[] = [];
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let rowStart = true;
  const text = csvText.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else if (inQuotes) {
        inQuotes = false;
      } else if (rowStart && field === "") {
        inQuotes = true;
      } else {
        field += char;
      }
      rowStart = false;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      rowStart = true;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      rowStart = true;
      if (char === "\r" && next === "\n") index += 1;
      continue;
    }

    field += char;
    rowStart = false;
  }

  if (inQuotes) {
    globalErrors.push("CSV has an unclosed quoted field.");
  }

  row.push(field);
  rows.push(row);

  const nonEmptyRows = rows.filter((values) => !isBlankRecord(values));
  if (nonEmptyRows.length === 0) {
    return { headers: [], records: [], globalErrors: ["CSV is empty."] };
  }

  const headers = nonEmptyRows[0].map(normalizeHeader);
  const records = nonEmptyRows.slice(1).map((values, index) => ({
    rowNumber: index + 2,
    values,
  }));

  if (records.length > AI_INVENTORY_IMPORT_MAX_ROWS) {
    globalErrors.push(`CSV import is limited to ${AI_INVENTORY_IMPORT_MAX_ROWS} rows.`);
  }

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      globalErrors.push(`Missing required header: ${header}.`);
    }
  }

  return { headers, records: records.slice(0, AI_INVENTORY_IMPORT_MAX_ROWS), globalErrors };
}

function valueFor(row: Record<string, string>, key: string): string {
  return row[key]?.trim() ?? "";
}

function mapRecord(headers: string[], values: string[]) {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    if (header && record[header] === undefined) {
      record[header] = values[index] ?? "";
    }
    return record;
  }, {});
}

function previewRow(params: {
  rowNumber: number;
  record: Record<string, string>;
  globalErrors: string[];
}): AISystemImportPreviewRow {
  const { rowNumber, record, globalErrors } = params;
  const errors: string[] = [...globalErrors];
  const evidenceNotes = valueFor(record, "evidence_notes");
  const name = valueFor(record, "system_name");
  const useCase = valueFor(record, "use_case");

  if (!name) errors.push("system_name is required.");
  if (!useCase) errors.push("use_case is required.");

  const payload: AISystemImportPayload = {
    ...emptyPayload(),
    name,
    description: evidenceNotes ? `Imported evidence notes: ${evidenceNotes}` : "",
    ownerName: valueFor(record, "owner_name"),
    ownerEmail: parseEmail(valueFor(record, "owner_email"), errors),
    department: valueFor(record, "department"),
    vendorName: valueFor(record, "vendor_name"),
    modelName: valueFor(record, "model_or_product"),
    useCase,
    businessProcess: valueFor(record, "business_process"),
    dataTypes: parseDataTypes(valueFor(record, "data_types")),
    dataSensitivity: parseDataSensitivity(valueFor(record, "data_sensitivity"), errors),
    customerFacing: parseBoolean(valueFor(record, "customer_facing"), false, "customer_facing", errors),
    employeeFacing: parseBoolean(valueFor(record, "employee_facing"), false, "employee_facing", errors),
    automatedDecisions: parseBoolean(valueFor(record, "automated_decisions"), false, "automated_decisions", errors),
    humanReviewRequired: parseBoolean(valueFor(record, "human_review_required"), true, "human_review_required", errors),
    trainingDataUse: parseTrainingDataUse(valueFor(record, "training_data_use"), errors),
    approvalStatus: parseApprovalStatus(valueFor(record, "approval_status"), errors),
    nextReviewDate: parseReviewDate(valueFor(record, "next_review_date"), errors),
    source: "import",
    connectedAppId: null,
  };

  return {
    rowNumber,
    status: errors.length > 0 ? "error" : "ready",
    errors,
    warnings: [],
    payload,
  };
}

function summarize(rows: AISystemImportPreviewRow[]): AISystemImportSummary {
  const errorRows = rows.filter((row) => row.status === "error").length;
  const duplicateRows = rows.filter((row) => row.status === "duplicate").length;
  const createdRows = rows.filter((row) => row.status === "created").length;
  const readyRows = rows.filter((row) => row.status === "ready").length;

  return {
    totalRows: rows.length,
    readyRows,
    duplicateRows,
    errorRows,
    createdRows,
    skippedRows: duplicateRows + errorRows,
  };
}

export function buildAIInventoryImportPreview(params: {
  csvText: string;
  existingSystems?: ExistingAISystemForImport[];
}): AISystemImportPreview {
  const { csvText, existingSystems = [] } = params;
  const parsed = parseCsvText(csvText);
  const existingByKey = new Map(
    existingSystems.map((system) => [
      duplicateKeyForAISystem(system.name, system.use_case),
      system,
    ])
  );
  const importRowsByKey = new Map<string, AISystemImportPreviewRow>();

  const rows = parsed.records.map(({ rowNumber, values }) => {
    const record = mapRecord(parsed.headers, values);
    const row = previewRow({
      rowNumber,
      record,
      globalErrors: parsed.globalErrors,
    });

    if (row.status === "error") return row;

    const duplicateKey = duplicateKeyForAISystem(row.payload.name, row.payload.useCase);
    const existing = existingByKey.get(duplicateKey);
    if (existing) {
      return {
        ...row,
        status: "duplicate" as const,
        duplicateOf: {
          source: "existing" as const,
          id: existing.id,
          name: existing.name,
        },
        warnings: ["Likely duplicate of an existing AI system."],
      };
    }

    const earlier = importRowsByKey.get(duplicateKey);
    if (earlier) {
      return {
        ...row,
        status: "duplicate" as const,
        duplicateOf: {
          source: "import" as const,
          name: `row ${earlier.rowNumber}`,
        },
        warnings: ["Duplicate of an earlier row in this CSV."],
      };
    }

    importRowsByKey.set(duplicateKey, row);
    return row;
  });

  return {
    globalErrors: parsed.globalErrors,
    rows,
    summary: summarize(rows),
  };
}

export function markCreatedRows(
  preview: AISystemImportPreview,
  createdIdsByRowNumber: Map<number, string>
): AISystemImportPreview {
  const rows = preview.rows.map((row) => {
    if (row.status !== "ready" || !createdIdsByRowNumber.has(row.rowNumber)) {
      return row;
    }
    return {
      ...row,
      status: "created" as const,
      warnings: [`Created AI System ${createdIdsByRowNumber.get(row.rowNumber)}.`],
    };
  });

  return {
    ...preview,
    rows,
    summary: summarize(rows),
  };
}
