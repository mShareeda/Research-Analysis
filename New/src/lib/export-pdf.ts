import jsPDF from "jspdf";
import type { FlatAnalysisReport } from "./schemas";

type RGB = [number, number, number];

const C = {
  headerBg:   [20,  30,  48]  as RGB,
  headerDim:  [100, 140, 180] as RGB,
  headerBrt:  [190, 220, 255] as RGB,
  white:      [255, 255, 255] as RGB,
  body:       [28,  38,  54]  as RGB,
  muted:      [100, 116, 139] as RGB,
  line:       [216, 224, 232] as RGB,
  sectionBg:  [246, 248, 250] as RGB,
  sectionTxt: [100, 116, 139] as RGB,
  accent:     [8,   145, 178] as RGB,
  bahrainBg:  [240, 249, 255] as RGB,
  evidenceBg: [248, 250, 252] as RGB,
  posBg:      [240, 253, 244] as RGB,  posText: [22,  101, 52]  as RGB,  posBdr: [134, 239, 172] as RGB,
  negBg:      [254, 242, 242] as RGB,  negText: [185, 28,  28]  as RGB,  negBdr: [252, 165, 165] as RGB,
  neuBg:      [241, 245, 249] as RGB,  neuText: [51,  65,  85]  as RGB,  neuBdr: [203, 213, 225] as RGB,
};

// jsPDF line height in mm: fontSize(pt) × 1.15 lineHeightFactor ÷ 2.8346 (pt/mm)
const LH = (size: number) => size * 0.406;

function sentimentCol(s: string) {
  if (s === "positive") return { bg: C.posBg, text: C.posText, bdr: C.posBdr };
  if (s === "negative") return { bg: C.negBg, text: C.negText, bdr: C.negBdr };
  return { bg: C.neuBg, text: C.neuText, bdr: C.neuBdr };
}

export function exportAnalysisPdf(data: {
  title: string | null;
  url: string | null;
  fileName: string | null;
  model: string;
  createdAt: string;
  report: FlatAnalysisReport;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 18;           // page margin
  const PW = 210;
  const CW = PW - M * 2; // content width = 174mm
  const BOTTOM = 282;     // safe bottom limit
  let y = 0;

  // ── Low-level helpers ────────────────────────────────────────────────────

  const fill   = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const ink    = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  function font(size: number, style: "normal"|"bold"|"italic"|"bolditalic" = "normal") {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  }

  function split(str: string, size: number, style: "normal"|"bold"|"italic"|"bolditalic", width: number): string[] {
    font(size, style);
    return doc.splitTextToSize(str, width) as string[];
  }

  // Height of a text block (lines already split)
  function blockH(lines: string[], size: number): number {
    return lines.length * LH(size);
  }

  function newPage() { doc.addPage(); y = M; }

  function checkPage(needed: number) {
    if (y + needed > BOTTOM) newPage();
  }

  // Render pre-split lines; does NOT call checkPage (caller is responsible)
  function drawLines(lines: string[], size: number, style: "normal"|"bold"|"italic"|"bolditalic", color: RGB, x: number) {
    font(size, style);
    ink(color);
    doc.text(lines, x, y);
    y += blockH(lines, size) + 1.5;
  }

  // Normal flowing paragraph — splits, checks page, renders
  function para(str: string, size: number, style: "normal"|"bold"|"italic"|"bolditalic" = "normal", color: RGB = C.body, x = M, width = CW) {
    const lines = split(str, size, style, width);
    const h = blockH(lines, size);
    checkPage(h + 4);
    drawLines(lines, size, style, color, x);
  }

  function sectionHeader(label: string) {
    y += 6;
    checkPage(12);
    fill(C.sectionBg); stroke(C.line);
    doc.setLineWidth(0.2);
    doc.rect(M, y - 3, CW, 8, "FD");
    font(7.5, "bold"); ink(C.sectionTxt);
    doc.text(label.toUpperCase(), M + 3, y + 2.5);
    y += 9;
  }

  // ── HEADER ───────────────────────────────────────────────────────────────

  // Pre-split title so we know its height
  const titleLines = split(data.title ?? "Untitled source", 16, "bold", CW).slice(0, 3);
  const srcText = data.url ?? data.fileName ?? "Pasted text";
  const srcLines  = split(srcText, 8, "normal", CW).slice(0, 2);

  const headerH = 14                             // label + gap
    + titleLines.length * LH(16) + 3            // title
    + srcLines.length  * LH(8)  + 3             // source
    + 8;                                         // bottom padding

  fill(C.headerBg);
  doc.rect(0, 0, PW, headerH, "F");

  y = 11;
  font(7, "bold"); ink(C.headerDim);
  doc.text("RESEARCH ANALYSIS REPORT", M, y);
  y += 7;

  font(16, "bold"); ink(C.white);
  doc.text(titleLines, M, y);
  y += titleLines.length * LH(16) + 3;

  font(8, "normal"); ink(C.headerDim);
  doc.text(srcLines, M, y);
  y += srcLines.length * LH(8) + 3;


  y = headerH + 8;

  // ── SENTIMENT BADGES ─────────────────────────────────────────────────────

  const hasBahrain = Boolean(data.report.bahrainSentiment);
  const badgeW = hasBahrain ? (CW - 5) / 2 : CW;
  const badgeH = 18;

  function drawBadge(label: string, sentiment: string, bx: number, bw: number) {
    const col = sentimentCol(sentiment);
    fill(col.bg); stroke(col.bdr);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, y, bw, badgeH, 2, 2, "FD");
    font(6.5, "bold"); ink(C.muted);
    doc.text(label, bx + bw / 2, y + 6, { align: "center" });
    font(12, "bold"); ink(col.text);
    doc.text(sentiment.toUpperCase(), bx + bw / 2, y + 14, { align: "center" });
  }

  drawBadge("STORY", data.report.sentiment, M, badgeW);
  if (hasBahrain && data.report.bahrainSentiment) {
    drawBadge("BAHRAIN", data.report.bahrainSentiment, M + badgeW + 5, badgeW);
  }
  y += badgeH + 5;

  font(8, "normal"); ink(C.muted);
  doc.text(`Confidence: ${Math.round(data.report.confidence * 100)}%`, M, y);
  y += 7;

  // ── SUMMARY ──────────────────────────────────────────────────────────────

  sectionHeader("Summary");
  para(data.report.summary, 10);

  // ── BAHRAIN ANALYSIS ─────────────────────────────────────────────────────

  if (data.report.bahrainHeaderMentions !== undefined) {
    sectionHeader("Bahrain Analysis");

    const IW = CW - 10; // inner text width (7mm left indent + 3mm right)
    const TX = M + 7;
    const PAD = 6;
    const GAP = 1.5;

    // Pre-split every line with correct font so measurement matches rendering
    const mentionStr =
      `Mentions — Title: ${data.report.bahrainHeaderMentions} ` +
      `${data.report.bahrainHeaderMentions === 1 ? "time" : "times"}` +
      `   ·   Body: ${data.report.bahrainBodyMentions} ` +
      `${data.report.bahrainBodyMentions === 1 ? "time" : "times"}`;

    const mLines  = split(mentionStr, 10, "bold", IW);
    const ctxStr  = data.report.bahrainContext?.length
      ? `Context: ${data.report.bahrainContext.join("  ·  ")}` : null;
    const ctxLines = ctxStr ? split(ctxStr, 9.5, "normal", IW) : null;
    const promStr  = data.report.bahrainProminence
      ? `Prominence: ${data.report.bahrainProminence}` : null;
    const promLines = promStr ? split(promStr, 9.5, "normal", IW) : null;
    const framLines = data.report.bahrainClassificationBasis
      ? split(data.report.bahrainClassificationBasis, 9.5, "normal", IW) : null;
    const kwStr   = data.report.bahrainSentimentKeywords?.length
      ? data.report.bahrainSentimentKeywords.join(", ") : null;
    const kwLines = kwStr ? split(kwStr, 9.5, "normal", IW) : null;

    // Calculate exact box height
    let contentH = blockH(mLines, 10) + GAP;
    if (ctxLines)  contentH += blockH(ctxLines, 9.5) + GAP;
    if (promLines) contentH += blockH(promLines, 9.5) + GAP;
    if (framLines) contentH += 5 + LH(8) + GAP + blockH(framLines, 9.5) + GAP;
    if (kwLines)   contentH += 5 + LH(8) + GAP + blockH(kwLines, 9.5) + GAP;

    const boxH = PAD + contentH + PAD;
    checkPage(boxH + 6);
    const boxTop = y;

    fill(C.bahrainBg); stroke(C.line);
    doc.setLineWidth(0.2);
    doc.rect(M, boxTop, CW, boxH, "FD");
    fill(C.accent);
    doc.rect(M, boxTop, 2.5, boxH, "F");

    y = boxTop + PAD;

    drawLines(mLines, 10, "bold", C.body, TX);
    if (ctxLines)  drawLines(ctxLines, 9.5, "normal", C.muted, TX);
    if (promLines) drawLines(promLines, 9.5, "normal", C.muted, TX);

    if (framLines) {
      y += 3;
      const flabel = split("Framing", 8, "bold", IW);
      drawLines(flabel, 8, "bold", C.sectionTxt, TX);
      drawLines(framLines, 9.5, "normal", C.body, TX);
    }
    if (kwLines) {
      y += 3;
      const klabel = split("Keywords", 8, "bold", IW);
      drawLines(klabel, 8, "bold", C.sectionTxt, TX);
      drawLines(kwLines, 9.5, "normal", C.body, TX);
    }

    // Always advance past the box regardless of rendering drift
    y = boxTop + boxH + 5;
  }

  // ── CLASSIFICATION BASIS ─────────────────────────────────────────────────

  sectionHeader("Classification Basis");
  para(data.report.classificationBasis, 10);

  if (data.report.sentimentKeywords?.length) {
    y += 3;
    para("Story keywords", 8, "bold", C.sectionTxt);
    para(data.report.sentimentKeywords.join(", "), 9.5);
  }

  // ── SUPPORTING EVIDENCE ──────────────────────────────────────────────────

  sectionHeader("Supporting Evidence");

  for (const ev of data.report.supportingEvidence) {
    const IW  = CW - 8;
    const TX  = M + 4;
    const TOP = 6;
    const MID = 4;
    const BOT = 6;

    // Split with correct fonts BEFORE measuring
    const qLines = split(`"${ev.quote}"`, 10, "bolditalic", IW);
    const eLines = split(ev.explanation, 9.5, "normal", IW);

    const boxH = TOP + blockH(qLines, 10) + MID + blockH(eLines, 9.5) + BOT;
    checkPage(boxH + 6);
    const boxTop = y;

    fill(C.evidenceBg); stroke(C.line);
    doc.setLineWidth(0.25);
    doc.rect(M, boxTop, CW, boxH, "FD");
    fill(C.accent);
    doc.rect(M, boxTop, CW, 1.5, "F");

    y = boxTop + TOP;
    drawLines(qLines, 10, "bolditalic", C.body, TX);

    y = boxTop + TOP + blockH(qLines, 10) + MID;
    drawLines(eLines, 9.5, "normal", C.muted, TX);

    y = boxTop + boxH + 5;
  }

  // ── KEY CLAIMS ───────────────────────────────────────────────────────────

  if (data.report.keyClaims?.length) {
    sectionHeader("Key Claims");
    for (const claim of data.report.keyClaims) {
      const lines = split(claim, 10, "normal", CW - 6);
      checkPage(blockH(lines, 10) + 4);
      fill(C.accent);
      doc.circle(M + 1.5, y - 1.2, 0.9, "F");
      drawLines(lines, 10, "normal", C.body, M + 5);
    }
  }

  // ── TONE SIGNALS ─────────────────────────────────────────────────────────

  if (data.report.toneSignals?.length) {
    sectionHeader("Tone Signals");
    for (const signal of data.report.toneSignals) {
      const lines = split(signal, 10, "normal", CW - 6);
      checkPage(blockH(lines, 10) + 4);
      fill(C.accent);
      doc.circle(M + 1.5, y - 1.2, 0.9, "F");
      drawLines(lines, 10, "normal", C.body, M + 5);
    }
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    stroke(C.line);
    doc.setLineWidth(0.3);
    doc.line(M, 287, PW - M, 287);
    font(7.5, "normal"); ink(C.muted);
    doc.text(`Research Analysis  ·  Page ${i} of ${total}`, M, 292);
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────

  const safeName = (data.title ?? "analysis")
    .replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_").toLowerCase().slice(0, 50);
  doc.save(`${safeName}.pdf`);
}
