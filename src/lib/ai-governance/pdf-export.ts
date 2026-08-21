import { createHash } from "node:crypto";
import { buildClientExportPack, type ClientExportPack } from "./export-pack";
import type { GovernanceReportSnapshot } from "./types";

type PdfLine = {
  text: string;
  size: number;
  bold?: boolean;
  gapBefore?: number;
  indent?: number;
};

type PdfPageLine = PdfLine & {
  x: number;
  y: number;
};

const pageWidth = 612;
const pageHeight = 792;
const margin = 54;
const bottomMargin = 56;

export type GeneratedPdf = {
  bytes: Uint8Array;
  filename: string;
  contentHash: string;
  sizeBytes: number;
};

function ascii(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = ascii(text);
  if (!clean) return [""];

  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
      continue;
    }
    if (`${line} ${word}`.length <= maxChars) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function addWrappedLine(lines: PdfLine[], text: string, options: Omit<PdfLine, "text">) {
  const indent = options.indent ?? 0;
  const maxChars = Math.max(36, Math.floor((92 - indent / 4) * (10 / options.size)));
  const wrapped = wrapText(text, maxChars);

  wrapped.forEach((part, index) => {
    lines.push({
      ...options,
      gapBefore: index === 0 ? options.gapBefore : 0,
      text: index === 0 ? part : part,
    });
  });
}

function addSection(lines: PdfLine[], title: string, body: string[]) {
  lines.push({ text: title, size: 16, bold: true, gapBefore: 18 });
  for (const item of body) {
    addWrappedLine(lines, item, { size: 10, indent: 0, gapBefore: 4 });
  }
}

function addNumberedSection(lines: PdfLine[], title: string, items: string[]) {
  lines.push({ text: title, size: 16, bold: true, gapBefore: 18 });
  items.forEach((item, index) => {
    addWrappedLine(lines, `${index + 1}. ${item}`, { size: 10, indent: 10, gapBefore: 4 });
  });
}

function addBulletedSection(lines: PdfLine[], title: string, items: string[]) {
  lines.push({ text: title, size: 16, bold: true, gapBefore: 18 });
  for (const item of items) {
    addWrappedLine(lines, `- ${item}`, { size: 10, indent: 10, gapBefore: 4 });
  }
}

function buildPdfLines(pack: ClientExportPack): PdfLine[] {
  const lines: PdfLine[] = [
    { text: "ShadowGuard", size: 14, bold: true, gapBefore: 0 },
    { text: "Client Export Pack", size: 28, bold: true, gapBefore: 72 },
    { text: pack.title, size: 18, bold: true, gapBefore: 12 },
    { text: `Report Type: ${pack.reportTypeLabel}`, size: 11, gapBefore: 18 },
    { text: `Status: ${pack.deliveryStatus === "final" ? "Final" : "Draft"}`, size: 11, gapBefore: 4 },
    { text: `Prepared for: ${pack.clientName}`, size: 11, gapBefore: 4 },
    { text: `Generated: ${new Date(pack.generatedAt).toLocaleString("en-US")}`, size: 11, gapBefore: 4 },
    { text: `Prepared by: ${pack.generatedBy}`, size: 11, gapBefore: 4 },
    { text: "__PAGE_BREAK__", size: 1, gapBefore: 0 },
  ];

  addSection(
    lines,
    "Executive Summary",
    [
      ...(pack.executiveSummaryNote ? [`Executive Note: ${pack.executiveSummaryNote}`] : []),
      pack.executiveSummary,
      ...(pack.preparedByNote ? [`Prepared By Note: ${pack.preparedByNote}`] : []),
    ]
  );

  addBulletedSection(
    lines,
    "Risk And Readiness Metrics",
    pack.metrics.map((metric) => `${metric.label}: ${metric.value}`)
  );
  addBulletedSection(lines, "Framework Alignment", pack.frameworkAlignment);
  addNumberedSection(lines, "Key Findings", pack.keyFindings);
  addBulletedSection(lines, "Evidence Gaps", pack.evidenceGaps);
  addNumberedSection(lines, "Next Actions", pack.nextActions);

  lines.push({ text: "Appendix", size: 18, bold: true, gapBefore: 20 });
  for (const section of pack.appendix) {
    addBulletedSection(lines, section.title, section.items);
  }

  return lines;
}

function paginate(lines: PdfLine[]): PdfPageLine[][] {
  const pages: PdfPageLine[][] = [[]];
  let y = pageHeight - margin;

  function newPage() {
    pages.push([]);
    y = pageHeight - margin;
  }

  for (const line of lines) {
    if (line.text === "__PAGE_BREAK__") {
      newPage();
      continue;
    }

    const gap = line.gapBefore ?? 0;
    const lineHeight = Math.max(12, line.size * 1.35);
    if (y - gap - lineHeight < bottomMargin) {
      newPage();
    }

    y -= gap;
    pages[pages.length - 1].push({
      ...line,
      x: margin + (line.indent ?? 0),
      y,
    });
    y -= lineHeight;
  }

  return pages.filter((page) => page.length > 0);
}

function pageContent(lines: PdfPageLine[]): string {
  return lines
    .map((line) => {
      const font = line.bold ? "F2" : "F1";
      return `BT /${font} ${line.size} Tf 1 0 0 1 ${line.x.toFixed(2)} ${line.y.toFixed(2)} Tm (${escapePdfText(line.text)}) Tj ET`;
    })
    .join("\n");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function formatXrefOffset(offset: number): string {
  return `${String(offset).padStart(10, "0")} 00000 n \n`;
}

function buildPdf(pack: ClientExportPack): Uint8Array {
  const pages = paginate(buildPdfLines(pack));
  const objectBodies: Record<number, string> = {
    1: "<< /Type /Catalog /Pages 2 0 R >>",
    3: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    4: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  };

  const pageObjectIds: number[] = [];
  let nextObjectId = 5;

  for (const page of pages) {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    const content = pageContent(page);

    pageObjectIds.push(pageObjectId);
    objectBodies[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objectBodies[contentObjectId] =
      `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`;
  }

  objectBodies[2] =
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const maxObjectId = nextObjectId - 1;
  const offsets: number[] = [];
  let pdf = "%PDF-1.4\n";

  for (let id = 1; id <= maxObjectId; id += 1) {
    offsets[id] = byteLength(pdf);
    pdf += `${id} 0 obj\n${objectBodies[id]}\nendobj\n`;
  }

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxObjectId; id += 1) {
    pdf += formatXrefOffset(offsets[id]);
  }
  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export function pdfFilenameForSnapshot(snapshot: GovernanceReportSnapshot): string {
  const title = ascii(snapshot.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `shadowguard-${title || "governance-report"}-${snapshot.id.slice(0, 8)}.pdf`;
}

export function hashPdfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function generateSnapshotPdf(snapshot: GovernanceReportSnapshot): GeneratedPdf {
  const pack = buildClientExportPack(snapshot);
  const bytes = buildPdf(pack);
  const filename = pdfFilenameForSnapshot(snapshot);
  const contentHash = hashPdfBytes(bytes);

  return {
    bytes,
    filename,
    contentHash,
    sizeBytes: bytes.byteLength,
  };
}
