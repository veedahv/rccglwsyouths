import { jsPDF } from "jspdf";
import type { MonthlyReport, QuarterlyReport, ReportLineItem } from "./reports";
import { formatMonthList } from "./dues";
import { parseISODate } from "./format";
import rccgLogo from "@/assets/Rccg_logo.png";
import youthLogo from "@/assets/logo.png";

/* ---------------------------------------------------------------------------
 * Layout follows the manual report the department already uses:
 *   Incoming Money (dues grouped by date, with one line per person)
 *   Outgoing Money (with a Notes column)
 *   Summary, then free-text Notes.
 * Styled with the RCCG palette, with both crests in the header.
 * ------------------------------------------------------------------------ */

type RGB = [number, number, number];

const NAVY: RGB = [24, 12, 98]; // #180C62
const GREEN: RGB = [2, 138, 44]; // #028A2C
const RED: RGB = [214, 24, 18]; // #D61812
const WHITE: RGB = [255, 255, 255];
const INK: RGB = [27, 20, 64];
const MUTED: RGB = [107, 102, 136];
const RULE: RGB = [228, 225, 240];
const TINT: RGB = [244, 242, 251]; // pale navy, for group rows
const TINT_STRONG: RGB = [232, 229, 246]; // totals rows

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 17; // leave room for the footer
const PT_TO_MM = 0.3528; // jsPDF font sizes are in points; coordinates/widths are mm

export const DEFAULT_ORG_NAME = "Youth Department, LWS, RCCG";

export interface PdfOptions {
  orgName?: string;
  /** Free text printed under the summary (e.g. "Cash handed to the treasurer: 3,500"). */
  notes?: string;
}

/* ------------------------------ formatting ------------------------------ */

function money(n: number): string {
  return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthParts(yearMonth: string): [number, number] {
  const [y, m] = yearMonth.split("-").map(Number);
  return [y, m];
}

function formatMonth(yearMonth: string): string {
  const [y, m] = monthParts(yearMonth);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function shortMonth(yearMonth: string): string {
  const [y, m] = monthParts(yearMonth);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

function previousMonthLabel(yearMonth: string): string {
  const [y, m] = monthParts(yearMonth);
  return new Date(y, m - 2, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

function longDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function capitalize(s?: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/* -------------------------------- logos --------------------------------- */

interface LogoImage {
  dataUrl: string;
  ratio: number; // width / height
}

export interface ReportLogos {
  church: LogoImage | null;
  youth: LogoImage | null;
}

/**
 * Loads an image and shrinks it. The church crest ships at 2300x2300px;
 * embedding that as-is would make every PDF several MB for a 17mm logo.
 */
function loadLogo(src: string, targetHeightPx = 260): Promise<LogoImage | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = img.naturalWidth / img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.height = targetHeightPx;
        canvas.width = Math.round(targetHeightPx * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL("image/png"), ratio });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** A missing logo never blocks the report; the header just goes without it. */
export async function loadReportLogos(): Promise<ReportLogos> {
  const [church, youth] = await Promise.all([loadLogo(rccgLogo.src), loadLogo(youthLogo.src)]);
  return { church, youth };
}

/* --------------------------- naira and amount drawing -------------------- */

/**
 * Draws the Naira glyph as vector lines rather than text. jsPDF's
 * built-in fonts (Helvetica/Times/Courier) don't include the Naira
 * codepoint (U+20A6), so rendering it as text would show a missing-glyph
 * box or nothing at all. Embedding a real Unicode font would fix this
 * properly, but needs a font file fetched from somewhere. Drawing the
 * symbol as strokes sidesteps the font question entirely: it's an "N"
 * with two horizontal bars through it, which is literally what the sign is.
 */
function drawNairaGlyph(doc: jsPDF, x: number, baselineY: number, fontSizePt: number): number {
  const fontSizeMm = fontSizePt * PT_TO_MM;
  const h = fontSizeMm * 0.72; // cap-height, roughly matching the adjacent digits
  const w = h * 0.62;
  const top = baselineY - h;
  const prevWidth = doc.getLineWidth();
  doc.setLineWidth(Math.max(0.16, fontSizeMm * 0.045));

  doc.line(x, baselineY, x, top); // left vertical
  doc.line(x + w, baselineY, x + w, top); // right vertical
  doc.line(x, top, x + w, baselineY); // diagonal

  const bar1 = top + h * 0.38;
  const bar2 = top + h * 0.62;
  const overhang = w * 0.18;
  doc.line(x - overhang, bar1, x + w + overhang, bar1);
  doc.line(x - overhang, bar2, x + w + overhang, bar2);

  doc.setLineWidth(prevWidth);
  return w + overhang * 2;
}

/**
 * Right-aligns a signed amount at `rightX` with the Naira glyph drawn
 * before the digits. Inherits the doc's current font and size, and draws
 * text and glyph in the same `color`.
 */
function drawAmount(doc: jsPDF, amount: number, rightX: number, y: number, color: RGB = INK) {
  const fontSizePt = doc.getFontSize();
  const fontSizeMm = fontSizePt * PT_TO_MM;
  const numberStr = money(amount);

  doc.setTextColor(...color);
  doc.setDrawColor(...color);

  const numberWidth = doc.getTextWidth(numberStr);
  doc.text(numberStr, rightX, y, { align: "right" });

  const glyphX = rightX - numberWidth - fontSizeMm * 0.18 - fontSizeMm * 0.45;
  drawNairaGlyph(doc, glyphX, y, fontSizePt);

  if (amount < 0) {
    doc.text("-", glyphX - 1.5, y, { align: "right" });
  }
}

/* ------------------------------ page chrome ----------------------------- */

interface Ctx {
  doc: jsPDF;
  y: number;
  logos: ReportLogos;
  orgName: string;
  /** Shown in the slim header on continuation pages. */
  runningTitle: string;
}

/** Thin three-colour strip: the RCCG blue, green and red. */
function drawBrandRule(doc: jsPDF, y: number) {
  const parts: [RGB, number][] = [
    [NAVY, 0.6],
    [GREEN, 0.25],
    [RED, 0.15],
  ];
  let x = MARGIN;
  for (const [color, share] of parts) {
    const w = CONTENT_W * share;
    doc.setFillColor(...color);
    doc.rect(x, y, w, 0.9, "F");
    x += w;
  }
}

/** Full header: both crests, organisation name and the report title. Used at the top of each report. */
function drawFullHeader(ctx: Ctx, title: string) {
  const { doc, logos } = ctx;
  const logoH = 16;
  const top = 10;
  let x = MARGIN;

  if (logos.church) {
    doc.addImage(logos.church.dataUrl, "PNG", x, top, logoH * logos.church.ratio, logoH);
    x += logoH * logos.church.ratio + 3;
  }
  if (logos.youth) {
    doc.addImage(logos.youth.dataUrl, "PNG", x, top, logoH * logos.youth.ratio, logoH);
    x += logoH * logos.youth.ratio + 3;
  }
  if (logos.church || logos.youth) x += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(ctx.orgName, x, top + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(...GREEN);
  doc.text(title, x, top + 14);

  drawBrandRule(doc, top + logoH + 3);
  ctx.runningTitle = title;
  ctx.y = top + logoH + 11;
}

/** Slim header for pages a long report spills onto. */
function drawContinuationHeader(ctx: Ctx) {
  const { doc } = ctx;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(ctx.orgName, MARGIN, 13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`${ctx.runningTitle} (continued)`, PAGE_W - MARGIN, 13, { align: "right" });
  drawBrandRule(doc, 16);
  ctx.y = 26;
}

/** Starts a new page if `height` won't fit. Returns true when it did, so tables can repeat their header. */
function ensureSpace(ctx: Ctx, height: number): boolean {
  if (ctx.y + height <= BOTTOM) return false;
  ctx.doc.addPage();
  drawContinuationHeader(ctx);
  return true;
}

function startPage(ctx: Ctx, title: string, isFirst: boolean) {
  if (!isFirst) ctx.doc.addPage();
  drawFullHeader(ctx, title);
}

function drawFooters(doc: jsPDF, orgName: string) {
  const total = doc.getNumberOfPages();
  const generated = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${orgName}  |  Generated ${generated}`, MARGIN, PAGE_H - 9.5);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 9.5, { align: "right" });
  }
}

function drawSectionTitle(ctx: Ctx, text: string, color: RGB, keepTogether = 24) {
  ensureSpace(ctx, keepTogether); // move the heading to the next page if its table can't start here
  const { doc } = ctx;
  doc.setFillColor(...color);
  doc.rect(MARGIN, ctx.y, 1.6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(text, MARGIN + 4.2, ctx.y + 4.7);
  ctx.y += 7;
}

/* -------------------------------- tables -------------------------------- */

interface Col {
  header: string;
  x: number;
  w: number;
  align?: "left" | "right";
}

interface Cell {
  text?: string;
  amount?: number;
  indent?: number;
  bold?: boolean;
  color?: RGB;
  amountColor?: RGB;
}

interface RowStyle {
  fill?: RGB;
  bold?: boolean;
  textColor?: RGB;
  minHeight?: number;
  fontSize?: number;
  borderColor?: RGB;
  /** Reserve room for the next row too, so a group header isn't left alone at the foot of a page. */
  keepWithNext?: boolean;
}

const LINE_H = 4.1;

function drawTableHeader(ctx: Ctx, cols: Col[]) {
  const { doc } = ctx;
  const h = 7;
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, ctx.y, CONTENT_W, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...WHITE);
  for (const col of cols) {
    if (col.align === "right") {
      doc.text(col.header, col.x + col.w - 2.5, ctx.y + 4.7, { align: "right" });
    } else {
      doc.text(col.header, col.x + 2.5, ctx.y + 4.7);
    }
  }
  ctx.y += h;
}

function drawRow(ctx: Ctx, cols: Col[], cells: Cell[], style: RowStyle = {}) {
  const { doc } = ctx;
  const fontSize = style.fontSize ?? 9;

  // Wrap text cells first: that decides the row's height.
  doc.setFontSize(fontSize);
  const wrapped: (string[] | null)[] = cells.map((cell, i) => {
    if (cell.text === undefined || cell.text === "") return null;
    doc.setFont("helvetica", cell.bold || style.bold ? "bold" : "normal");
    return doc.splitTextToSize(cell.text, cols[i].w - 5 - (cell.indent ?? 0)) as string[];
  });
  const maxLines = Math.max(1, ...wrapped.map((w) => w?.length ?? 1));
  const height = Math.max(style.minHeight ?? 5.7, maxLines * LINE_H + 1.6);

  if (ensureSpace(ctx, height * (style.keepWithNext ? 2 : 1) + 7)) {
    drawTableHeader(ctx, cols); // header repeats at the top of the new page
  }

  if (style.fill) {
    doc.setFillColor(...style.fill);
    doc.rect(MARGIN, ctx.y, CONTENT_W, height, "F");
  }

  // Single-line rows sit near the top; tall, emphasised rows (totals) are centred.
  const centred = (style.minHeight ?? 0) > 7;
  const baseline = centred ? ctx.y + height / 2 + fontSize * PT_TO_MM * 0.36 : ctx.y + 4.0;

  cells.forEach((cell, i) => {
    const col = cols[i];
    const color = cell.color ?? style.textColor ?? INK;
    doc.setFont("helvetica", cell.bold || style.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);

    if (cell.amount !== undefined) {
      drawAmount(doc, cell.amount, col.x + col.w - 2.5, baseline, cell.amountColor ?? color);
    } else if (wrapped[i]) {
      doc.setTextColor(...color);
      doc.text(wrapped[i]!, col.x + 2.5 + (cell.indent ?? 0), baseline);
    }
  });

  doc.setDrawColor(...(style.borderColor ?? RULE));
  doc.setLineWidth(0.15);
  doc.line(MARGIN, ctx.y + height, MARGIN + CONTENT_W, ctx.y + height);
  ctx.y += height;
}

/* ------------------------- incoming / outgoing / summary ---------------- */

const FLOW_COLS_IN: Col[] = [
  { header: "Date", x: MARGIN, w: 28 },
  { header: "Description", x: MARGIN + 28, w: 82 },
  { header: "Amount", x: MARGIN + 110, w: 36, align: "right" },
  { header: "Type", x: MARGIN + 146, w: 36 },
];

const FLOW_COLS_OUT: Col[] = [
  { header: "Date", x: MARGIN, w: 28 },
  { header: "Description", x: MARGIN + 28, w: 70 },
  { header: "Amount", x: MARGIN + 98, w: 36, align: "right" },
  { header: "Notes", x: MARGIN + 134, w: 48 },
];

/**
 * Dues are shown the way the manual report shows them: one bold
 * "Monthly Dues" row per day carrying that day's total, then an indented
 * line for each person who paid. Everything else is a plain row.
 */
function splitIncoming(items: ReportLineItem[]) {
  const dues = items.filter((i) => i.kind === "dues");
  const other = items.filter((i) => i.kind !== "dues");

  const byDate = new Map<string, ReportLineItem[]>();
  for (const item of dues) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date)!.push(item);
  }
  const duesDays = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  const otherSorted = [...other].sort((a, b) => a.date.localeCompare(b.date));
  return { duesDays, otherSorted };
}

function payerLabel(item: ReportLineItem): string {
  const name = item.payer ?? item.description;
  // Only call out the month when it isn't simply the month it was paid in,
  // e.g. "Sis Precious (Jan 2026)" for a February payment covering January.
  const paidMonth = item.date.slice(0, 7);
  const covers = item.months ?? [];
  const isCurrent = covers.length === 1 && covers[0] === paidMonth;
  return covers.length > 0 && !isCurrent ? `- ${name} (${formatMonthList(covers)})` : `- ${name}`;
}

function drawIncoming(ctx: Ctx, report: MonthlyReport) {
  drawSectionTitle(ctx, "Incoming Money", GREEN, 40);
  drawTableHeader(ctx, FLOW_COLS_IN);

  const { duesDays, otherSorted } = splitIncoming(report.incomingBreakdown);

  if (duesDays.length === 0 && otherSorted.length === 0) {
    drawRow(ctx, FLOW_COLS_IN, [
      { text: "" },
      { text: "No incoming money this month", color: MUTED },
      { amount: 0, color: MUTED },
      { text: "" },
    ]);
  }

  for (const [date, payments] of duesDays) {
    const dayTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    drawRow(
      ctx,
      FLOW_COLS_IN,
      [{ text: longDate(date), bold: true }, { text: "Monthly Dues", bold: true }, { amount: dayTotal, bold: true }, { text: "" }],
      { fill: TINT, keepWithNext: true }
    );
    for (const p of payments) {
      drawRow(ctx, FLOW_COLS_IN, [
        { text: "" },
        { text: payerLabel(p), indent: 3 },
        { amount: p.amount },
        { text: capitalize(p.method), color: MUTED },
      ]);
    }
  }

  for (const item of otherSorted) {
    drawRow(ctx, FLOW_COLS_IN, [
      { text: longDate(item.date) },
      { text: item.description },
      { amount: item.amount },
      { text: capitalize(item.method), color: MUTED },
    ]);
  }

  drawRow(
    ctx,
    FLOW_COLS_IN,
    [{ text: "" }, { text: "Total Incoming", bold: true }, { amount: report.totalIncoming, bold: true, amountColor: GREEN }, { text: "" }],
    { fill: TINT_STRONG, bold: true, borderColor: NAVY, minHeight: 7.2 }
  );
  ctx.y += 7;
}

function drawOutgoing(ctx: Ctx, report: MonthlyReport) {
  drawSectionTitle(ctx, "Outgoing Money", RED, 40);
  drawTableHeader(ctx, FLOW_COLS_OUT);

  if (report.outgoingBreakdown.length === 0) {
    drawRow(ctx, FLOW_COLS_OUT, [
      { text: "" },
      { text: "No outgoing this month", color: MUTED },
      { amount: 0, color: MUTED },
      { text: "" },
    ]);
  }

  for (const item of report.outgoingBreakdown) {
    drawRow(ctx, FLOW_COLS_OUT, [
      { text: longDate(item.date) },
      { text: item.description },
      { amount: item.amount },
      { text: item.note ?? "", color: MUTED },
    ]);
  }

  drawRow(
    ctx,
    FLOW_COLS_OUT,
    [{ text: "" }, { text: "Total Outgoing", bold: true }, { amount: report.totalOutgoing, bold: true, amountColor: RED }, { text: "" }],
    { fill: TINT_STRONG, bold: true, borderColor: NAVY, minHeight: 7.2 }
  );
  ctx.y += 7;
}

const SUMMARY_COLS: Col[] = [
  { header: "Description", x: MARGIN, w: 134 },
  { header: "Amount", x: MARGIN + 134, w: 48, align: "right" },
];

function drawSummary(ctx: Ctx, report: MonthlyReport) {
  const m = shortMonth(report.yearMonth);
  drawSectionTitle(ctx, "Summary", NAVY, 46);
  drawTableHeader(ctx, SUMMARY_COLS);

  drawRow(ctx, SUMMARY_COLS, [{ text: `Opening Balance (${previousMonthLabel(report.yearMonth)})` }, { amount: report.openingBalance }]);
  drawRow(ctx, SUMMARY_COLS, [{ text: `Total Incoming (${m})` }, { amount: report.totalIncoming, amountColor: GREEN }]);
  drawRow(ctx, SUMMARY_COLS, [{ text: `Total Outgoing (${m})` }, { amount: report.totalOutgoing, amountColor: RED }]);
  drawRow(
    ctx,
    SUMMARY_COLS,
    [{ text: `Balance (End of ${m})`, bold: true }, { amount: report.closingBalance, bold: true }],
    { fill: NAVY, textColor: WHITE, bold: true, minHeight: 9, fontSize: 10.5, borderColor: NAVY }
  );
  ctx.y += 7;
}

function drawNotes(ctx: Ctx, notes?: string) {
  const text = notes?.trim();
  if (!text) return;
  const { doc } = ctx;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(text, CONTENT_W - 10) as string[];
  // Keep the heading with up to its first three lines, but don't strand it.
  drawSectionTitle(ctx, "Notes", NAVY, 9 + Math.min(lines.length, 3) * 5.4);
  // Drawn line by line so a long note can run onto the next page.
  for (const line of lines) {
    ensureSpace(ctx, 6);
    doc.setFillColor(...TINT);
    doc.rect(MARGIN, ctx.y, CONTENT_W, 5.4, "F");
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN, ctx.y, 1, 5.4, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(line, MARGIN + 5, ctx.y + 3.9);
    ctx.y += 5.4;
  }
  ctx.y += 6;
}

function renderMonth(ctx: Ctx, report: MonthlyReport, isFirstPage: boolean, notes?: string) {
  startPage(ctx, `Financial Report \u2013 ${formatMonth(report.yearMonth)}`, isFirstPage);
  drawIncoming(ctx, report);
  drawOutgoing(ctx, report);
  drawSummary(ctx, report);
  drawNotes(ctx, notes);
}

/* ------------------------------- quarterly ------------------------------ */

const QUARTER_COLS: Col[] = [
  { header: "Month", x: MARGIN, w: 42 },
  { header: "Opening", x: MARGIN + 42, w: 35, align: "right" },
  { header: "Incoming", x: MARGIN + 77, w: 35, align: "right" },
  { header: "Outgoing", x: MARGIN + 112, w: 35, align: "right" },
  { header: "Closing", x: MARGIN + 147, w: 35, align: "right" },
];

function renderQuarterSummary(ctx: Ctx, report: QuarterlyReport, notes?: string) {
  startPage(ctx, `Quarter ${report.quarter} Financial Report \u2013 ${report.year}`, false);
  drawSectionTitle(ctx, "Quarter Summary", NAVY, 50);
  drawTableHeader(ctx, QUARTER_COLS);

  for (const m of report.months) {
    drawRow(ctx, QUARTER_COLS, [
      { text: formatMonth(m.yearMonth) },
      { amount: m.openingBalance },
      { amount: m.totalIncoming, amountColor: GREEN },
      { amount: m.totalOutgoing, amountColor: RED },
      { amount: m.closingBalance, bold: true },
    ]);
  }
  drawRow(
    ctx,
    QUARTER_COLS,
    [
      { text: `Quarter ${report.quarter}`, bold: true },
      { amount: report.openingBalance, bold: true },
      { amount: report.totalIncoming, bold: true, amountColor: GREEN },
      { amount: report.totalOutgoing, bold: true, amountColor: RED },
      { amount: report.closingBalance, bold: true },
    ],
    { fill: TINT_STRONG, bold: true, borderColor: NAVY, minHeight: 7.2 }
  );
  ctx.y += 10;

  // The headline figure, as in the manual report's closing note.
  ensureSpace(ctx, 24);
  const { doc } = ctx;
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, ctx.y, CONTENT_W, 15, "F");
  doc.setFillColor(...GREEN);
  doc.rect(MARGIN, ctx.y, 2, 15, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...WHITE);
  doc.text("End of quarter closing balance", MARGIN + 7, ctx.y + 9.3);
  doc.setFontSize(15);
  drawAmount(doc, report.closingBalance, MARGIN + CONTENT_W - 6, ctx.y + 10, WHITE);
  ctx.y += 25;

  drawNotes(ctx, notes);
}

/* --------------------------------- public ------------------------------- */

/** Builds the document without saving it, so the layout can be tested without a browser. */
export function buildMonthlyReportPdf(report: MonthlyReport, logos: ReportLogos, options: PdfOptions = {}): jsPDF {
  const orgName = options.orgName ?? DEFAULT_ORG_NAME;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: Ctx = { doc, y: 0, logos, orgName, runningTitle: "" };
  renderMonth(ctx, report, true, options.notes);
  drawFooters(doc, orgName);
  return doc;
}

export function buildQuarterlyReportPdf(report: QuarterlyReport, logos: ReportLogos, options: PdfOptions = {}): jsPDF {
  const orgName = options.orgName ?? DEFAULT_ORG_NAME;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: Ctx = { doc, y: 0, logos, orgName, runningTitle: "" };
  report.months.forEach((month, i) => renderMonth(ctx, month, i === 0));
  renderQuarterSummary(ctx, report, options.notes);
  drawFooters(doc, orgName);
  return doc;
}

export async function downloadMonthlyReportPdf(report: MonthlyReport, options: PdfOptions = {}) {
  const doc = buildMonthlyReportPdf(report, await loadReportLogos(), options);
  doc.save(`financial-report-${report.yearMonth}.pdf`);
}

export async function downloadQuarterlyReportPdf(report: QuarterlyReport, options: PdfOptions = {}) {
  const doc = buildQuarterlyReportPdf(report, await loadReportLogos(), options);
  doc.save(`financial-report-${report.year}-Q${report.quarter}.pdf`);
}
