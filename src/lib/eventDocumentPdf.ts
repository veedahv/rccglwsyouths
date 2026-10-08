import { jsPDF } from "jspdf";
import {
  CONTENT_W,
  Col,
  Ctx,
  DEFAULT_ORG_NAME,
  GREEN,
  INK,
  MARGIN,
  MUTED,
  NAVY,
  RED,
  RULE,
  TINT_STRONG,
  ReportLogos,
  drawBrandRule,
  drawFooters,
  drawRow,
  drawSectionTitle,
  drawTableHeader,
  ensureSpace,
  loadReportLogos,
  longDate,
} from "./reportPdf";
import { documentBudget, documentBudgetTotal, documentItems, DOCUMENT_KIND_LABEL } from "./eventDocuments";
import { formatTime } from "./format";
import type { ChurchEvent, DocumentSection, DocumentSignatory, EventDocument } from "@/types";

/* ---------------------------------------------------------------------------
 * Proposals and sponsorship requests, on the same letterhead as the
 * financial reports. Both end with the signature blocks.
 * ------------------------------------------------------------------------ */

const BODY_PT = 10;
const BODY_LINE = 5; // mm per line of body text

export interface EventDocumentPdfOptions {
  orgName?: string;
  /** excoId → name, so the agenda can say who is in charge of each item. */
  ownerNames?: Record<string, string>;
}

/**
 * jsPDF's built-in fonts only cover Latin-1 plus a few Windows-1252
 * punctuation marks. Anything else (an emoji, and the ₦ sign — see the
 * note in reportPdf about why Naira is drawn as strokes) would print as a
 * broken glyph, so it's swapped or dropped here. ₦ becomes a plain "N",
 * which is how Nigerians usually write it by hand anyway: N5,000.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/₦/g, "N")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\u0009\u000A\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2022\u2026\u20AC]/g, "");
}

/* ------------------------------- text blocks ---------------------------- */

/**
 * Draws free text: blank lines separate paragraphs, and lines starting
 * with "- " (or "• ") become bullets with a hanging indent. Breaks across
 * pages line by line, so a long section never gets cut off.
 */
function drawParagraphs(ctx: Ctx, text: string, opts: { size?: number; bold?: boolean } = {}) {
  const { doc } = ctx;
  const size = opts.size ?? BODY_PT;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...INK);

  for (const raw of pdfSafe(text).replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      ctx.y += 2.2;
      continue;
    }
    if (line === "-" || line === "•") continue; // an empty bullet left over from the template
    const bullet = /^[-•*]\s+/.test(line);
    const content = bullet ? line.replace(/^[-•*]\s+/, "") : line;
    const indent = bullet ? 5 : 0;
    const wrapped = doc.splitTextToSize(content, CONTENT_W - indent) as string[];

    wrapped.forEach((part, i) => {
      if (ensureSpace(ctx, BODY_LINE)) {
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...INK);
      }
      if (bullet && i === 0) {
        doc.setFillColor(...GREEN);
        doc.circle(MARGIN + 1.6, ctx.y - 1.2, 0.6, "F");
      }
      doc.text(part, MARGIN + indent, ctx.y);
      ctx.y += BODY_LINE;
    });
    ctx.y += 0.6;
  }
}

function drawSection(ctx: Ctx, section: DocumentSection) {
  if (!section.heading.trim() && !section.body.trim()) return;
  if (section.heading.trim()) drawSectionTitle(ctx, pdfSafe(section.heading), GREEN, 22);
  ctx.y += 5;
  drawParagraphs(ctx, section.body);
  ctx.y += 4;
}

/** A label/value list for the event's key facts (date, venue, …). */
function drawFacts(ctx: Ctx, facts: [string, string | undefined][]) {
  const rows = facts.filter(([, v]) => v && v.trim()) as [string, string][];
  if (rows.length === 0) return;
  const { doc } = ctx;
  const labelW = 40;
  for (const [label, value] of rows) {
    doc.setFontSize(BODY_PT);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(pdfSafe(value), CONTENT_W - labelW - 4) as string[];
    const height = lines.length * BODY_LINE + 1.8;
    ensureSpace(ctx, height);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(label), MARGIN + 2, ctx.y + 3.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_PT);
    doc.setTextColor(...INK);
    doc.text(lines, MARGIN + labelW, ctx.y + 3.8);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, ctx.y + height, MARGIN + CONTENT_W, ctx.y + height);
    ctx.y += height;
  }
  ctx.y += 5;
}

/* --------------------------------- tables ------------------------------- */

function drawBudget(ctx: Ctx, document: EventDocument, event: ChurchEvent) {
  const items = documentBudget(document, event);
  if (items.length === 0) return;
  drawSectionTitle(ctx, "Budget", GREEN, 36);
  ctx.y += 2;
  const cols: Col[] = [
    { header: "No.", x: MARGIN, w: 14 },
    { header: "Item", x: MARGIN + 14, w: 108 },
    { header: "Estimated cost", x: MARGIN + 122, w: 60, align: "right" },
  ];
  drawTableHeader(ctx, cols);
  items.forEach((b, i) => {
    drawRow(ctx, cols, [{ text: String(i + 1) }, { text: pdfSafe(b.item) }, { amount: b.price }]);
  });
  drawRow(
    ctx,
    cols,
    [{ text: "" }, { text: "Total budget", bold: true }, { amount: documentBudgetTotal(document, event), bold: true }],
    { fill: TINT_STRONG, bold: true, borderColor: NAVY, minHeight: 7.2 }
  );
  ctx.y += 7;
}

function drawRequest(ctx: Ctx, document: EventDocument, event: ChurchEvent) {
  const cash = document.cashRequested ?? 0;
  const items = documentItems(document, event);
  if (cash <= 0 && items.length === 0) return;

  drawSectionTitle(ctx, "What we are requesting", GREEN, 36);
  ctx.y += 2;

  if (cash > 0) {
    const cols: Col[] = [
      { header: "Support", x: MARGIN, w: 122 },
      { header: "Amount", x: MARGIN + 122, w: 60, align: "right" },
    ];
    drawTableHeader(ctx, cols);
    drawRow(ctx, cols, [{ text: "Financial support (cash)", bold: true }, { amount: cash, bold: true }], {
      fill: TINT_STRONG,
      minHeight: 7.2,
    });
    ctx.y += 6;
  }

  if (items.length > 0) {
    const cols: Col[] = [
      { header: "No.", x: MARGIN, w: 14 },
      { header: "Item", x: MARGIN + 14, w: 78 },
      { header: "Quantity", x: MARGIN + 92, w: 42 },
      { header: "Notes", x: MARGIN + 134, w: 48 },
    ];
    drawTableHeader(ctx, cols);
    items.forEach((it, i) => {
      drawRow(ctx, cols, [
        { text: String(i + 1) },
        { text: pdfSafe(it.name) },
        { text: pdfSafe(it.quantity) },
        { text: pdfSafe(it.note ?? "") },
      ]);
    });
    ctx.y += 6;
  }
}

function drawAgenda(ctx: Ctx, event: ChurchEvent, ownerNames: Record<string, string>) {
  if (event.agenda.length === 0) return;
  drawSectionTitle(ctx, "Order of programme", GREEN, 36);
  ctx.y += 2;
  const cols: Col[] = [
    { header: "Time", x: MARGIN, w: 30 },
    { header: "Activity", x: MARGIN + 30, w: 104 },
    { header: "In charge", x: MARGIN + 134, w: 48 },
  ];
  drawTableHeader(ctx, cols);
  for (const a of event.agenda) {
    drawRow(ctx, cols, [
      { text: pdfSafe(a.time ?? "") },
      { text: pdfSafe(a.item) },
      { text: pdfSafe(a.owner ? ownerNames[a.owner] ?? "" : "") },
    ]);
  }
  ctx.y += 6;
}

function drawContacts(ctx: Ctx, document: EventDocument) {
  const contacts = (document.contacts ?? []).filter((c) => c.name.trim());
  const payment = document.paymentDetails?.trim();
  if (!payment && contacts.length === 0) return;

  if (payment) {
    drawSectionTitle(ctx, "Payment details", GREEN, 24);
    ctx.y += 5;
    drawParagraphs(ctx, payment);
    ctx.y += 4;
  }
  if (contacts.length > 0) {
    drawSectionTitle(ctx, "Contact", GREEN, 24);
    ctx.y += 5;
    drawParagraphs(
      ctx,
      contacts
        .map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}${c.phone ? `: ${c.phone}` : ""}`)
        .map((l) => `- ${l}`)
        .join("\n")
    );
    ctx.y += 4;
  }
}

/* ------------------------------- signatures ----------------------------- */

// Signatures are drawn on a 400x160 pad (see SignaturePad), so a fixed 5:2 box fits them.
const SIG_W = 44;
const SIG_H = 17.6;
const SIG_COLS = 3;
const SIG_GAP = 8;

function drawSignatures(ctx: Ctx, signatories: DocumentSignatory[], closing: string) {
  const { doc } = ctx;
  const people = signatories.filter((s) => s.name.trim() || s.title.trim());
  if (people.length === 0) return;

  const colW = (CONTENT_W - SIG_GAP * (SIG_COLS - 1)) / SIG_COLS;
  const blockH = SIG_H + 22;

  // Keep the closing line with the first row of signatures.
  ensureSpace(ctx, blockH + 14);
  ctx.y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_PT);
  doc.setTextColor(...INK);
  doc.text(pdfSafe(closing), MARGIN, ctx.y);
  ctx.y += 8;

  for (let i = 0; i < people.length; i += SIG_COLS) {
    ensureSpace(ctx, blockH + 4);
    const row = people.slice(i, i + SIG_COLS);
    row.forEach((p, j) => {
      const x = MARGIN + j * (colW + SIG_GAP);
      if (p.signatureDataUrl) {
        try {
          doc.addImage(p.signatureDataUrl, "PNG", x, ctx.y, SIG_W, SIG_H);
        } catch {
          // A damaged image just leaves the line blank to sign by hand.
        }
      }
      const lineY = ctx.y + SIG_H + 1;
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.3);
      doc.line(x, lineY, x + colW, lineY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      const nameLines = doc.splitTextToSize(pdfSafe(p.name), colW) as string[];
      doc.text(nameLines, x, lineY + 5);
      let textY = lineY + 5 + nameLines.length * 4.4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      const titleLines = doc.splitTextToSize(pdfSafe(p.title), colW) as string[];
      doc.text(titleLines, x, textY);
      textY += titleLines.length * 4;

      doc.setFontSize(8.5);
      if (p.signedOn) {
        doc.text(`Signed ${longDate(p.signedOn)}`, x, textY + 0.5);
      } else {
        doc.text("Date:", x, textY + 0.5);
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.2);
        doc.line(x + 9, textY + 0.5, x + colW * 0.6, textY + 0.5);
      }
    });
    ctx.y += blockH + 2;
  }
}

/**
 * "Dear Pastor Bello," reads right; "Dear The Managing Director," doesn't.
 * A name that starts with a title is used as written, anything else
 * (an office, a company) gets the usual "Sir/Ma".
 */
export function salutationFor(recipientName?: string): string {
  const name = pdfSafe(recipientName ?? "").trim();
  const titled = /^(mr|mrs|ms|miss|dr|prof|engr|chief|pastor|deacon|deaconess|elder|alhaji|alhaja|hon|sir|dame|barr|rev|apostle|prophet|bro|sis|evangelist)\b\.?\s+\S/i;
  return titled.test(name) ? name : "Sir/Ma";
}

/* ------------------------------- letterhead ----------------------------- */

/**
 * The first-page heading of these documents: both crests, then three lines
 * — Redeemed Christian Church of God (green), Living Water Sanctuary (red),
 * Youth Department. Later pages keep the slim "Youth Department, LWS, RCCG"
 * header from reportPdf, so only this page differs from the reports.
 */
function drawLetterhead(ctx: Ctx, kindLabel: string) {
  const { doc, logos } = ctx;
  const logoH = 19;
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
  doc.setFontSize(13);
  doc.setTextColor(...GREEN);
  doc.text("REDEEMED CHRISTIAN CHURCH OF GOD", x, top + 5.6);
  doc.setTextColor(...RED);
  doc.text("LIVING WATER SANCTUARY", x, top + 11.9);
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("YOUTH DEPARTMENT", x, top + 17.6);

  drawBrandRule(doc, top + logoH + 3);
  ctx.runningTitle = kindLabel; // the slim header on later pages says "<kind> (continued)"
  ctx.y = top + logoH + 11;
}

/* ------------------------------- reply slip ----------------------------- */

function drawBox(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.rect(x, y - 3.4, 4, 4);
}

function drawFillLine(doc: jsPDF, label: string, x: number, y: number, width: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(label, x, y);
  const start = x + doc.getTextWidth(label) + 2;
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(start, y + 0.8, x + width, y + 0.8);
}

/**
 * A slip for the place being visited to tick, fill in and send back (or
 * just photograph and reply with): accept the date, or suggest another.
 */
function drawReplySlip(ctx: Ctx, event: ChurchEvent) {
  const { doc } = ctx;
  const height = 84;
  ensureSpace(ctx, height + 6);
  ctx.y += 6;
  const top = ctx.y;
  const left = MARGIN;

  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(left, top, left + CONTENT_W, top);
  doc.setLineDashPattern([], 0);

  let y = top + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("REPLY SLIP", left, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  const when = [longDate(event.date), event.time ? formatTime(event.time) : ""].filter(Boolean).join(", ");
  doc.text(pdfSafe(`To: Youth Department, LWS, RCCG   |   Proposed visit: ${when}`), left, y);
  y += 8;

  doc.setTextColor(...INK);
  drawBox(doc, left, y);
  doc.text("We are happy to receive you on the proposed date and time.", left + 7, y);
  y += 8;
  drawBox(doc, left, y);
  doc.text("That date and time is not suitable. A better date and time for us is:", left + 7, y);
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.2);
  doc.line(left + 7 + doc.getTextWidth("That date and time is not suitable. A better date and time for us is:") + 2, y + 0.8, left + CONTENT_W, y + 0.8);
  y += 9;

  drawFillLine(doc, "Items the children need most, or rules to observe:", left, y, CONTENT_W);
  y += 7;
  doc.setDrawColor(...MUTED);
  doc.line(left, y + 0.8, left + CONTENT_W, y + 0.8);
  y += 9;

  drawFillLine(doc, "Name:", left, y, 88);
  drawFillLine(doc, "Position:", left + 96, y, CONTENT_W - 96);
  y += 9;
  drawFillLine(doc, "Signature and stamp:", left, y, 88);
  drawFillLine(doc, "Date:", left + 96, y, CONTENT_W - 96);
  y += 4;

  ctx.y = Math.max(y, top + height);
}

/* --------------------------------- build -------------------------------- */

/** Where the event-specific tables go: after the section that matches, else just before the closing section. */
function insertionIndex(sections: DocumentSection[], pattern: RegExp): number {
  const match = sections.findIndex((s) => pattern.test(s.heading));
  if (match >= 0) return match + 1;
  return sections.length > 1 ? sections.length - 1 : sections.length;
}

export function buildEventDocumentPdf(
  document: EventDocument,
  event: ChurchEvent,
  logos: ReportLogos,
  options: EventDocumentPdfOptions = {}
): jsPDF {
  const orgName = options.orgName ?? DEFAULT_ORG_NAME;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: Ctx = { doc, y: 0, logos, orgName, runningTitle: "" };
  const isSponsorship = document.kind === "sponsorship";
  const isVisit = document.kind === "visit";
  const isLetter = isSponsorship || isVisit; // addressed to someone, opens "Dear …", ends "Yours faithfully,"

  drawLetterhead(ctx, DOCUMENT_KIND_LABEL[document.kind]);

  // Reference and date, right-aligned like a letter.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  const dateLine = `${document.ref?.trim() ? `Ref: ${pdfSafe(document.ref.trim())}    ` : ""}${longDate(document.documentDate)}`;
  doc.text(dateLine, MARGIN + CONTENT_W, ctx.y, { align: "right" });
  ctx.y += 6;

  // Who it's for.
  doc.setTextColor(...INK);
  if (isLetter) {
    const lines = [document.recipientName, document.recipientOrganisation, ...(document.recipientAddress ?? "").split("\n")]
      .map((l) => pdfSafe(l ?? "").trim())
      .filter(Boolean);
    doc.setFontSize(BODY_PT);
    lines.forEach((l, i) => {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      doc.text(l, MARGIN, ctx.y);
      ctx.y += BODY_LINE;
    });
    ctx.y += 3;
    doc.setFont("helvetica", "normal");
    doc.text(`Dear ${salutationFor(document.recipientName)},`, MARGIN, ctx.y);
    ctx.y += 8;
  } else if (document.submittedTo?.trim()) {
    doc.setFontSize(BODY_PT);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("Submitted to", MARGIN, ctx.y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(pdfSafe(document.submittedTo.trim()), MARGIN + 28, ctx.y);
    ctx.y += 8;
  }

  // The title, as a letter's subject line.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(pdfSafe(document.title.toUpperCase()), CONTENT_W) as string[];
  doc.text(titleLines, MARGIN, ctx.y);
  ctx.y += titleLines.length * 5.6 + 2;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, ctx.y, MARGIN + 30, ctx.y);
  ctx.y += 7;

  // Event at a glance.
  // A visit letter is addressed to the place being visited, so it doesn't
  // repeat the event's name or the venue back to them.
  const facts: [string, string | undefined][] = [
    ...(isVisit ? [] : ([["Event", event.title]] as [string, string | undefined][])),
    ["Theme", event.theme],
    ["Date and time", event.time ? `${longDate(event.date)}  |  ${formatTime(event.time)}` : longDate(event.date)],
    ...(isVisit ? [] : ([["Venue", event.venue]] as [string, string | undefined][])),
    ["Expected attendance", event.expectedAttendance],
  ];
  drawFacts(ctx, facts);

  const sections = document.sections;
  // Where the budget/agenda/contact blocks go: after the section that matches, else just before the closing one.
  const tablesAt = insertionIndex(
    sections,
    isSponsorship ? /support|need|why/i : isVisit ? /^\b$/ : /programme|activit|agenda/i
  );

  const drawTables = () => {
    if (isSponsorship) {
      if (document.includeBudget !== false) drawBudget(ctx, document, event);
      drawRequest(ctx, document, event);
      drawContacts(ctx, document);
    } else if (isVisit) {
      drawContacts(ctx, document);
    } else {
      drawAgenda(ctx, event, options.ownerNames ?? {});
    }
  };

  sections.forEach((section, i) => {
    if (i === tablesAt) drawTables();
    drawSection(ctx, section);
  });
  if (tablesAt >= sections.length) drawTables();

  drawSignatures(ctx, document.signatories, isLetter ? "Yours faithfully," : "Respectfully submitted by:");
  if (isVisit && document.includeReplySlip !== false) drawReplySlip(ctx, event);

  drawFooters(doc, orgName);
  return doc;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** The finished PDF as bytes, for the in-app preview (nothing is downloaded). */
export async function createEventDocumentPdfBytes(
  document: EventDocument,
  event: ChurchEvent,
  options: EventDocumentPdfOptions = {}
): Promise<ArrayBuffer> {
  const pdf = buildEventDocumentPdf(document, event, await loadReportLogos(), options);
  return pdf.output("arraybuffer");
}

export async function downloadEventDocumentPdf(
  document: EventDocument,
  event: ChurchEvent,
  options: EventDocumentPdfOptions = {}
) {
  const pdf = buildEventDocumentPdf(document, event, await loadReportLogos(), options);
  pdf.save(`${document.kind}-${slug(event.title) || "event"}.pdf`);
}
