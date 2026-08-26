import { notFound } from "next/navigation";
import { serializeCodedArticle } from "@/lib/coding-store";
import { prisma } from "@/lib/prisma";
import {
  ARTICLE_TYPE_LABELS_AR,
  CENTRALITY_LABELS_AR,
  CENTRAL_ACTOR_LABELS_AR,
  CONTEXT_LABELS_AR,
  IMAGE_LABELS_AR,
  LIFE_CYCLE_LABELS_AR,
  NEWS_FRAME_LABELS_AR,
  TONE_LABELS_AR,
  UI_LABELS as T,
  translateEnum,
} from "@/lib/coding-labels";
import { formatDate } from "@/lib/format";
import { PrintButton } from "./print-button";

export const runtime = "nodejs";

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="printRow">
      <span className="printLabel">{label}</span>
      <span className="printValue">{value}</span>
    </div>
  );
}

function Axis({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="printAxis">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default async function CodingPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.codedArticle.findUnique({ where: { id } });
  if (!row) notFound();

  const a = serializeCodedArticle(row);

  return (
    <div className="printPage" dir="rtl">
      <PrintButton />

      <header className="printHeader">
        <h1>استمارة تحليل المضمون</h1>
      </header>

      <Axis title={T.axis1}>
        <Row label={T.articleNumber} value={a.articleNumber} />
        <Row label={T.coderName} value={a.coderName || "—"} />
        <Row label={T.codingDate} value={formatDate(a.codingDate)} />
        <Row label={T.site} value={a.site} />
        <Row label={T.articleTitle} value={a.articleTitle} />
        <Row label={T.url} value={a.url ?? "—"} />
        <Row label={T.publicationDate} value={a.publicationDate ? formatDate(a.publicationDate) : "—"} />
        <Row label={T.year} value={a.year ?? "—"} />
        <Row label={T.lifeCycle} value={translateEnum(LIFE_CYCLE_LABELS_AR, a.lifeCycle)} />
        <Row
          label={T.articleType}
          value={translateEnum(ARTICLE_TYPE_LABELS_AR, a.articleType) + (a.articleType === "Other" && a.articleTypeOther ? ` — ${a.articleTypeOther}` : "")}
        />
      </Axis>

      <Axis title={T.axis2}>
        <Row label={T.bahrainInTitle} value={a.bahrainInTitle ? T.yes : T.no} />
        <Row label={T.bahrainInBody} value={a.bahrainInBody ? T.yes : T.no} />
        <Row label={T.headlineMentions} value={a.headlineMentions} />
        <Row label={T.bodyMentions} value={a.bodyMentions} />
        <Row label={T.totalMentions} value={a.totalMentions} />
        <Row label={T.bahrainCentrality} value={translateEnum(CENTRALITY_LABELS_AR, a.bahrainCentrality)} />
      </Axis>

      <Axis title={T.axis3}>
        <Row label={T.overallTone} value={translateEnum(TONE_LABELS_AR, a.overallTone)} />
        <Row label={T.toneTowardBahrain} value={translateEnum(TONE_LABELS_AR, a.toneTowardBahrain)} />
      </Axis>

      <Axis title={T.axis4}>
        <Row label={T.dominantContext} value={translateEnum(CONTEXT_LABELS_AR, a.dominantContext)} />
        <Row
          label={T.dominantNewsFrame}
          value={translateEnum(NEWS_FRAME_LABELS_AR, a.dominantNewsFrame) + (a.dominantNewsFrame === "Other" && a.newsFrameOther ? ` — ${a.newsFrameOther}` : "")}
        />
        <Row
          label={T.centralActor}
          value={translateEnum(CENTRAL_ACTOR_LABELS_AR, a.centralActor) + (a.centralActor === "Other" && a.centralActorOther ? ` — ${a.centralActorOther}` : "")}
        />
        <Row
          label={T.dominantImage}
          value={translateEnum(IMAGE_LABELS_AR, a.dominantImage) + (a.dominantImage === "Other" && a.imageOther ? ` — ${a.imageOther}` : "")}
        />
      </Axis>

      <Axis title={T.axis5}>
        <div className="printLongRow">
          <span className="printLabel">{T.textExamples}</span>
          <p className="printValue">{a.textExamples || "—"}</p>
        </div>
        <div className="printLongRow">
          <span className="printLabel">{T.notes}</span>
          <p className="printValue">{a.notes || T.noNotes}</p>
        </div>
      </Axis>
    </div>
  );
}
