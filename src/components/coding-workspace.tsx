"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  LinkIcon,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import type { CodedArticle, CodingDraft } from "@/lib/coding-schemas";
import {
  ARTICLE_TYPE_OPTIONS,
  BAHRAIN_TONE_OPTIONS,
  CENTRALITY_OPTIONS,
  CENTRAL_ACTOR_OPTIONS,
  CONTEXT_OPTIONS,
  IMAGE_OPTIONS,
  LIFE_CYCLE_OPTIONS,
  NEWS_FRAME_OPTIONS,
  OVERALL_TONE_OPTIONS,
  SITE_OPTIONS,
} from "@/lib/coding-schemas";
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
import { formatDate, formatDateTime } from "@/lib/format";

type SourceMode = "url" | "paste" | "csv";

type BatchItem = {
  id: string;
  url: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  error: string | null;
  articleId: string | null;
};

type BatchDetail = {
  id: string;
  fileName: string;
  status: "RUNNING" | "DONE";
  items: BatchItem[];
};

type DetailResponse = CodedArticle & { extractedTextPreview: string };

const modeConfig = {
  url: { label: "رابط", icon: LinkIcon },
  paste: { label: "لصق نص", icon: FileText },
  csv: { label: "دفعة CSV", icon: FileSpreadsheet },
};

const CODER_NAME_STORAGE_KEY = "codingCoderName";

export function CodingWorkspace() {
  const [mode, setMode] = useState<SourceMode>("url");
  const [url, setUrl] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [coderName, setCoderName] = useState("");
  const [publicationDateInput, setPublicationDateInput] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [draft, setDraft] = useState<CodingDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<CodedArticle[]>([]);
  const [selected, setSelected] = useState<DetailResponse | null>(null);
  const [activeBatch, setActiveBatch] = useState<BatchDetail | null>(null);
  const [retryingBatch, setRetryingBatch] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCoderName(window.localStorage.getItem(CODER_NAME_STORAGE_KEY) ?? "");
  }, []);

  function updateCoderName(value: string) {
    setCoderName(value);
    window.localStorage.setItem(CODER_NAME_STORAGE_KEY, value);
  }

  const loadDetail = useCallback(async (id: string) => {
    setError("");
    setDraft(null);
    const response = await fetch(`/api/coding/${id}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "تعذر تحميل هذه المادة المرمزة.");
    }
    const detail = (await response.json()) as DetailResponse;
    setSelected(detail);
  }, []);

  const loadHistory = useCallback(async (selectFirst = false) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyQuery.trim()) params.set("q", historyQuery.trim());
      const response = await fetch(`/api/coding${params.toString() ? `?${params}` : ""}`);
      if (!response.ok) throw new Error("تعذر تحميل المواد المرمزة.");
      const data = (await response.json()) as CodedArticle[];
      setHistory(data);
      if (selectFirst && data[0]?.id) {
        await loadDetail(data[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل المواد المرمزة.");
    } finally {
      setLoadingHistory(false);
    }
  }, [historyQuery, loadDetail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory(true);
  }, [loadHistory]);

  const fetchBatch = useCallback(async (batchId: string) => {
    const response = await fetch(`/api/coding-batches/${batchId}`);
    if (!response.ok) throw new Error("تعذر تحميل حالة الدفعة.");
    return (await response.json()) as BatchDetail;
  }, []);

  useEffect(() => {
    if (!activeBatch || activeBatch.status !== "RUNNING") return;

    const interval = setInterval(() => {
      fetchBatch(activeBatch.id)
        .then((batch) => {
          setActiveBatch(batch);
          if (batch.status === "DONE") void loadHistory();
        })
        .catch((batchError) => setError(batchError instanceof Error ? batchError.message : "تعذر متابعة الدفعة."));
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBatch, fetchBatch, loadHistory]);

  async function deleteArticle(id: string) {
    const response = await fetch(`/api/coding/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "تعذر حذف هذه المادة.");
      return;
    }
    if (selected?.id === id) setSelected(null);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }

  function submitAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "csv") return submitBatch();
    return runDraft();
  }

  async function runDraft() {
    setError("");
    setAnalyzing(true);
    setSelected(null);

    try {
      const payload: Record<string, string> = { coderName };
      if (publicationDateInput) payload.publicationDate = publicationDateInput;
      if (yearInput) payload.year = yearInput;

      if (mode === "url") {
        payload.url = url;
      } else {
        payload.pastedTitle = pastedTitle;
        payload.pastedText = pastedText;
      }

      const response = await fetch("/api/coding/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "فشل التحليل.");

      setDraft(body as CodingDraft);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "فشل التحليل.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/coding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "فشل الحفظ.");

      setDraft(null);
      setUrl("");
      setPastedTitle("");
      setPastedText("");
      await loadHistory();
      await loadDetail(body.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "فشل الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  function patchDraft(patch: Partial<CodingDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function submitBatch() {
    if (!csvFile) return;
    setError("");
    setAnalyzing(true);
    setSelected(null);

    try {
      const formData = new FormData();
      formData.set("file", csvFile);

      const response = await fetch("/api/coding-batches", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "تعذر بدء الدفعة.");

      setCsvFile(null);
      setActiveBatch(await fetchBatch(body.id));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذر بدء الدفعة.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function retryFailedBatchItems(itemId?: string) {
    if (!activeBatch) return;
    setError("");
    setRetryingBatch(true);

    try {
      const response = await fetch(`/api/coding-batches/${activeBatch.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "تعذر إعادة محاولة العناصر الفاشلة.");
      setActiveBatch(await fetchBatch(activeBatch.id));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "تعذر إعادة محاولة العناصر الفاشلة.");
    } finally {
      setRetryingBatch(false);
    }
  }

  const canSubmit = useMemo(() => {
    if (analyzing) return false;
    if (mode === "url") return url.trim().length > 0;
    if (mode === "paste") return pastedText.trim().length >= 20;
    return Boolean(csvFile);
  }, [analyzing, csvFile, mode, pastedText, url]);

  return (
    <section className="workspace" dir="rtl">
      <aside className="sourcePanel">
        <form onSubmit={submitAnalysis}>
          <div className="segmented codingSegmented" aria-label="نوع المصدر">
            {(Object.entries(modeConfig) as Array<[SourceMode, (typeof modeConfig)[SourceMode]]>).map(
              ([key, config]) => {
                const Icon = config.icon;
                return (
                  <button key={key} type="button" className={mode === key ? "active" : ""} onClick={() => setMode(key)}>
                    <Icon size={16} />
                    <span>{config.label}</span>
                  </button>
                );
              },
            )}
          </div>

          <label className="field">
            <span>{T.coderName}</span>
            <input value={coderName} onChange={(event) => updateCoderName(event.target.value)} placeholder="اسمك" />
          </label>

          {mode === "url" && (
            <label className="field">
              <span>رابط المادة</span>
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/f1-bahrain-story" type="url" />
            </label>
          )}

          {mode === "paste" && (
            <>
              <label className="field">
                <span>عنوان المادة (اختياري)</span>
                <input value={pastedTitle} onChange={(event) => setPastedTitle(event.target.value)} />
              </label>
              <label className="field">
                <span>نص المادة</span>
                <textarea rows={8} value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="الصق نص المقال هنا" />
              </label>
              <p className="fieldHint">استخدم هذا الخيار عند تعذر جلب الرابط تلقائيا (حماية من الزحف، اشتراك مدفوع...).</p>
            </>
          )}

          {(mode === "url" || mode === "paste") && (
            <>
              <div className="codingGrid codingDateFields">
                <label className="codingField">
                  <span>{T.publicationDate} (اختياري)</span>
                  <input type="date" value={publicationDateInput} onChange={(event) => setPublicationDateInput(event.target.value)} />
                </label>
                <label className="codingField">
                  <span>{T.year} (اختياري)</span>
                  <input type="number" min={2021} max={2025} value={yearInput} onChange={(event) => setYearInput(event.target.value)} placeholder="2023" />
                </label>
              </div>
              <p className="fieldHint">لا يُستخرجان تلقائيا — أدخلهما إن كانا معروفين لديك.</p>
            </>
          )}

          {mode === "csv" && (
            <>
              <label className="dropzone">
                <Upload size={22} />
                <span>{csvFile ? csvFile.name : "ارفع ملف CSV يحتوي رابط مادة واحد لكل سطر"}</span>
                <input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} />
              </label>
              <p className="fieldHint">الأعمدة: url, publication date (اختياري), year (اختياري). تُحفظ الدفعة تلقائيا دون مراجعة يدوية.</p>
            </>
          )}

          <button className="primaryButton" disabled={!canSubmit} type="submit">
            {analyzing ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            <span>{analyzing ? "جارٍ البدء" : mode === "csv" ? "تشغيل الدفعة" : "تحليل"}</span>
          </button>

          {error && (
            <div className="error">
              <p>{error}</p>
              {mode === "csv" && csvFile && !activeBatch && (
                <button type="button" className="secondaryButton" onClick={() => void submitBatch()}>
                  إعادة المحاولة
                </button>
              )}
            </div>
          )}
        </form>

        <div className="historyHeader">
          <h2>المواد المرمزة</h2>
          <span>{loadingHistory ? "جارٍ التحميل" : `${history.length} مادة`}</span>
        </div>

        <div className="historyFilters">
          <input
            className="historySearch"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="ابحث بالعنوان أو الرابط"
            type="search"
            aria-label="بحث في المواد المرمزة"
          />
        </div>

        <button
          type="button"
          className="secondaryButton exportCsvLink"
          onClick={() => {
            window.open("/api/coding/export", "_blank");
          }}
        >
          <Download size={14} />
          <span>تصدير CSV</span>
        </button>

        <div className="historyList">
          {history.map((item) => (
            <div key={item.id} className={selected?.id === item.id ? "historyItem selected" : "historyItem"}>
              <button type="button" className="historyItemMain" onClick={() => void loadDetail(item.id).catch((detailError) => setError(detailError.message))}>
                <div className="historyPills">
                  <span className="pill neutral">#{item.articleNumber} · {item.site}</span>
                  <span className={`pill ${item.overallTone.toLowerCase()}`}>{translateEnum(TONE_LABELS_AR, item.overallTone)}</span>
                </div>
                <strong>{item.articleTitle}</strong>
                <small>{formatDate(item.createdAt)}</small>
              </button>
              <button type="button" className="deleteButton" aria-label="حذف المادة المرمزة" onClick={() => void deleteArticle(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!loadingHistory && history.length === 0 && <p className="empty">لم تُرمّز أي مادة بعد.</p>}
        </div>
      </aside>

      <section className="analysisPanel">
        {activeBatch ? (
          <CodingBatchProgress
            batch={activeBatch}
            retrying={retryingBatch}
            onDismiss={() => setActiveBatch(null)}
            onRetryFailed={() => void retryFailedBatchItems()}
            onRetryItem={(itemId) => void retryFailedBatchItems(itemId)}
            onOpen={(articleId) => {
              setActiveBatch(null);
              void loadDetail(articleId).catch((detailError) => setError(detailError.message));
            }}
          />
        ) : draft ? (
          <DraftReviewForm draft={draft} onChange={patchDraft} onSave={() => void saveDraft()} onDiscard={() => setDraft(null)} saving={saving} />
        ) : !selected ? (
          <div className="emptyState">
            <Search size={34} />
            <h2>لم يتم اختيار مادة</h2>
            <p>أدخل رابط مادة أو الصق نصها لترميزها وفق استمارة الدراسة.</p>
          </div>
        ) : (
          <CodedArticleView article={selected} />
        )}
      </section>
    </section>
  );
}

function CodedArticleView({ article }: { article: DetailResponse }) {
  return (
    <article>
      <div className="resultHeader">
        <div>
          <p className="eyebrow">{article.url ?? "مصدر بدون رابط"}</p>
          <h2>{article.articleTitle}</h2>
        </div>
        <div className="resultMeta">
          <a className="secondaryButton" href={`/coding/${article.id}/print`} target="_blank" rel="noreferrer">
            <Printer size={14} />
            <span>طباعة / PDF</span>
          </a>
          <p className="analysedDate">{formatDateTime(article.createdAt)}</p>
        </div>
      </div>

      <section className="reportSection codingForm">
        <h3>{T.axis1}</h3>
        <div className="codingGrid">
          <InfoField label={T.articleNumber} value={article.articleNumber} />
          <InfoField label={T.coderName} value={article.coderName || "—"} />
          <InfoField label={T.codingDate} value={formatDate(article.codingDate)} />
          <InfoField label={T.site} value={article.site} />
          <InfoField label={T.articleTitle} value={article.articleTitle} />
          <InfoField label={T.url} value={article.url ?? "—"} />
          <InfoField label={T.publicationDate} value={article.publicationDate ? formatDate(article.publicationDate) : "—"} />
          <InfoField label={T.year} value={article.year ?? "—"} />
          <InfoField label={T.lifeCycle} value={translateEnum(LIFE_CYCLE_LABELS_AR, article.lifeCycle)} />
          <InfoField
            label={T.articleType}
            value={translateEnum(ARTICLE_TYPE_LABELS_AR, article.articleType) + (article.articleType === "Other" && article.articleTypeOther ? ` — ${article.articleTypeOther}` : "")}
          />
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis2}</h3>
        <div className="codingGrid">
          <InfoField label={T.bahrainInTitle} value={article.bahrainInTitle ? T.yes : T.no} />
          <InfoField label={T.bahrainInBody} value={article.bahrainInBody ? T.yes : T.no} />
          <InfoField label={T.headlineMentions} value={article.headlineMentions} />
          <InfoField label={T.bodyMentions} value={article.bodyMentions} />
          <InfoField label={T.totalMentions} value={article.totalMentions} />
          <InfoField label={T.bahrainCentrality} value={translateEnum(CENTRALITY_LABELS_AR, article.bahrainCentrality)} />
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis3}</h3>
        <div className="codingGrid">
          <div className="codingField codingReadOnly">
            <span>{T.overallTone}</span>
            <strong className={`pill ${article.overallTone.toLowerCase()}`}>{translateEnum(TONE_LABELS_AR, article.overallTone)}</strong>
          </div>
          <div className="codingField codingReadOnly">
            <span>{T.toneTowardBahrain}</span>
            <strong className={`pill ${article.toneTowardBahrain.toLowerCase()}`}>{translateEnum(TONE_LABELS_AR, article.toneTowardBahrain)}</strong>
          </div>
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis4}</h3>
        <div className="codingGrid">
          <InfoField label={T.dominantContext} value={translateEnum(CONTEXT_LABELS_AR, article.dominantContext)} />
          <InfoField
            label={T.dominantNewsFrame}
            value={translateEnum(NEWS_FRAME_LABELS_AR, article.dominantNewsFrame) + (article.dominantNewsFrame === "Other" && article.newsFrameOther ? ` — ${article.newsFrameOther}` : "")}
          />
          <InfoField
            label={T.centralActor}
            value={translateEnum(CENTRAL_ACTOR_LABELS_AR, article.centralActor) + (article.centralActor === "Other" && article.centralActorOther ? ` — ${article.centralActorOther}` : "")}
          />
          <InfoField
            label={T.dominantImage}
            value={translateEnum(IMAGE_LABELS_AR, article.dominantImage) + (article.dominantImage === "Other" && article.imageOther ? ` — ${article.imageOther}` : "")}
          />
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis5}</h3>
        <p className="codingLongText"><strong>{T.textExamples}:</strong> {article.textExamples || "—"}</p>
        <p className="codingLongText"><strong>{T.notes}:</strong> {article.notes || T.noNotes}</p>
      </section>

      <details className="sourcePreview">
        <summary>معاينة نص المصدر</summary>
        <pre>{article.extractedTextPreview}</pre>
      </details>
    </article>
  );
}

function DraftReviewForm({
  draft,
  onChange,
  onSave,
  onDiscard,
  saving,
}: {
  draft: CodingDraft;
  onChange: (patch: Partial<CodingDraft>) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const canSave = Boolean(draft.site) && draft.coderName.trim().length > 0;

  return (
    <article>
      <div className="resultHeader">
        <div>
          <p className="eyebrow">مسودة — لم تُحفظ بعد</p>
          <h2>{draft.articleTitle}</h2>
        </div>
      </div>

      <section className="reportSection codingForm">
        <h3>{T.axis1}</h3>
        <div className="codingGrid">
          <TextField label={T.coderName} value={draft.coderName} onChange={(v) => onChange({ coderName: v })} />
          <DateField label={T.codingDate} value={draft.codingDate} onChange={(v) => onChange({ codingDate: v })} />
          <SelectField
            label={T.site}
            value={draft.site ?? ""}
            options={SITE_OPTIONS.map((o) => ({ value: o, label: o }))}
            placeholder="اختر الموقع"
            onChange={(v) => onChange({ site: v as CodingDraft["site"] })}
          />
          <TextField label={T.articleTitle} value={draft.articleTitle} onChange={(v) => onChange({ articleTitle: v })} />
          <TextField label={T.url} value={draft.url ?? ""} onChange={(v) => onChange({ url: v || null })} />
          <DateField label={T.publicationDate} value={draft.publicationDate ?? ""} onChange={(v) => onChange({ publicationDate: v || null })} />
          <NumberField label={T.year} value={draft.year} onChange={(v) => onChange({ year: v })} min={2021} max={2025} />
          <SelectField
            label={T.lifeCycle}
            value={draft.lifeCycle}
            options={LIFE_CYCLE_OPTIONS.map((o) => ({ value: o, label: LIFE_CYCLE_LABELS_AR[o] }))}
            onChange={(v) => onChange({ lifeCycle: v as CodingDraft["lifeCycle"] })}
          />
          <SelectField
            label={T.articleType}
            value={draft.articleType}
            options={ARTICLE_TYPE_OPTIONS.map((o) => ({ value: o, label: ARTICLE_TYPE_LABELS_AR[o] }))}
            onChange={(v) => onChange({ articleType: v as CodingDraft["articleType"] })}
          />
          {draft.articleType === "Other" && (
            <TextField label={T.otherSpecify} value={draft.articleTypeOther ?? ""} onChange={(v) => onChange({ articleTypeOther: v })} />
          )}
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis2}</h3>
        <div className="codingGrid">
          <CheckboxField label={T.bahrainInTitle} checked={draft.bahrainInTitle} onChange={(v) => onChange({ bahrainInTitle: v })} />
          <CheckboxField label={T.bahrainInBody} checked={draft.bahrainInBody} onChange={(v) => onChange({ bahrainInBody: v })} />
          <NumberField label={T.headlineMentions} value={draft.headlineMentions} onChange={(v) => onChange({ headlineMentions: v ?? 0, totalMentions: (v ?? 0) + draft.bodyMentions })} min={0} />
          <NumberField label={T.bodyMentions} value={draft.bodyMentions} onChange={(v) => onChange({ bodyMentions: v ?? 0, totalMentions: draft.headlineMentions + (v ?? 0) })} min={0} />
          <InfoField label={T.totalMentions} value={draft.totalMentions} />
          <SelectField
            label={T.bahrainCentrality}
            value={draft.bahrainCentrality}
            options={CENTRALITY_OPTIONS.map((o) => ({ value: o, label: CENTRALITY_LABELS_AR[o] }))}
            onChange={(v) => onChange({ bahrainCentrality: v as CodingDraft["bahrainCentrality"] })}
          />
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis3}</h3>
        <div className="codingGrid">
          <SelectField
            label={T.overallTone}
            value={draft.overallTone}
            options={OVERALL_TONE_OPTIONS.map((o) => ({ value: o, label: TONE_LABELS_AR[o] }))}
            onChange={(v) => onChange({ overallTone: v as CodingDraft["overallTone"] })}
          />
          <SelectField
            label={T.toneTowardBahrain}
            value={draft.toneTowardBahrain}
            options={BAHRAIN_TONE_OPTIONS.map((o) => ({ value: o, label: TONE_LABELS_AR[o] }))}
            onChange={(v) => onChange({ toneTowardBahrain: v as CodingDraft["toneTowardBahrain"] })}
          />
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis4}</h3>
        <div className="codingGrid">
          <SelectField
            label={T.dominantContext}
            value={draft.dominantContext}
            options={CONTEXT_OPTIONS.map((o) => ({ value: o, label: CONTEXT_LABELS_AR[o] }))}
            onChange={(v) => onChange({ dominantContext: v as CodingDraft["dominantContext"] })}
          />
          <SelectField
            label={T.dominantNewsFrame}
            value={draft.dominantNewsFrame}
            options={NEWS_FRAME_OPTIONS.map((o) => ({ value: o, label: NEWS_FRAME_LABELS_AR[o] }))}
            onChange={(v) => onChange({ dominantNewsFrame: v as CodingDraft["dominantNewsFrame"] })}
          />
          {draft.dominantNewsFrame === "Other" && (
            <TextField label={T.otherSpecify} value={draft.newsFrameOther ?? ""} onChange={(v) => onChange({ newsFrameOther: v })} />
          )}
          <SelectField
            label={T.centralActor}
            value={draft.centralActor}
            options={CENTRAL_ACTOR_OPTIONS.map((o) => ({ value: o, label: CENTRAL_ACTOR_LABELS_AR[o] }))}
            onChange={(v) => onChange({ centralActor: v as CodingDraft["centralActor"] })}
          />
          {draft.centralActor === "Other" && (
            <TextField label={T.otherSpecify} value={draft.centralActorOther ?? ""} onChange={(v) => onChange({ centralActorOther: v })} />
          )}
          <SelectField
            label={T.dominantImage}
            value={draft.dominantImage}
            options={IMAGE_OPTIONS.map((o) => ({ value: o, label: IMAGE_LABELS_AR[o] }))}
            onChange={(v) => onChange({ dominantImage: v as CodingDraft["dominantImage"] })}
          />
          {draft.dominantImage === "Other" && (
            <TextField label={T.otherSpecify} value={draft.imageOther ?? ""} onChange={(v) => onChange({ imageOther: v })} />
          )}
        </div>
      </section>

      <section className="reportSection codingForm">
        <h3>{T.axis5}</h3>
        <TextAreaField label={T.textExamples} value={draft.textExamples ?? ""} onChange={(v) => onChange({ textExamples: v })} />
        <TextAreaField label={T.notes} value={draft.notes ?? ""} onChange={(v) => onChange({ notes: v })} />
      </section>

      <div className="draftActions">
        <button type="button" className="primaryButton" disabled={!canSave || saving} onClick={onSave}>
          {saving ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
          <span>{saving ? "جارٍ الحفظ" : "حفظ"}</span>
        </button>
        <button type="button" className="secondaryButton" disabled={saving} onClick={onDiscard}>
          إلغاء
        </button>
      </div>
      {!canSave && <p className="fieldHint">اختر الموقع الإخباري وأدخل اسم المرمز قبل الحفظ.</p>}
    </article>
  );
}

function CodingBatchProgress({
  batch,
  retrying,
  onDismiss,
  onRetryFailed,
  onRetryItem,
  onOpen,
}: {
  batch: BatchDetail;
  retrying: boolean;
  onDismiss: () => void;
  onRetryFailed: () => void;
  onRetryItem: (itemId: string) => void;
  onOpen: (articleId: string) => void;
}) {
  const successCount = batch.items.filter((item) => item.status === "SUCCESS").length;
  const failedCount = batch.items.filter((item) => item.status === "FAILED").length;
  const pendingCount = batch.items.filter((item) => item.status === "PENDING").length;

  return (
    <div className="batchProgress">
      <div className="batchHeader">
        <div>
          <p className="eyebrow">{batch.fileName}</p>
          <h2>{batch.status === "RUNNING" ? "الدفعة قيد التشغيل" : "اكتملت الدفعة"}</h2>
          <p className="batchSummary">
            {successCount} نجحت · {failedCount} فشلت · {pendingCount} قيد الانتظار
          </p>
        </div>
        <div className="batchHeaderActions">
          {batch.status === "DONE" && failedCount > 0 && (
            <button type="button" className="secondaryButton" disabled={retrying} onClick={onRetryFailed}>
              {retrying ? "جارٍ إعادة المحاولة…" : `إعادة محاولة ${failedCount} فاشلة`}
            </button>
          )}
          <button type="button" className="secondaryButton" onClick={onDismiss}>
            إغلاق
          </button>
        </div>
      </div>

      <div className="batchList">
        {batch.items.map((item) => (
          <div key={item.id} className="batchItem">
            <span className={`batchStatus batchStatus--${item.status.toLowerCase()}`}>
              {item.status === "PENDING" && <Clock size={14} />}
              {item.status === "SUCCESS" && <CheckCircle2 size={14} />}
              {item.status === "FAILED" && <XCircle size={14} />}
            </span>
            <div className="batchItemBody">
              <span className="batchItemUrl">{item.url}</span>
              {item.error && <span className="batchItemError">{item.error}</span>}
            </div>
            {item.status === "SUCCESS" && item.articleId && (
              <button type="button" className="secondaryButton" onClick={() => onOpen(item.articleId!)}>
                عرض
              </button>
            )}
            {item.status === "FAILED" && (
              <button type="button" className="retryButton" disabled={retrying} onClick={() => onRetryItem(item.id)} aria-label="إعادة محاولة هذا الرابط">
                <RefreshCw size={14} />
                <span>إعادة المحاولة</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="codingField codingReadOnly">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="codingField">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="codingField">
      <span>{label}</span>
      <input type="date" value={value ? value.slice(0, 10) : ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="codingField">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="codingField codingCheckboxField">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="codingField">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="codingField codingTextArea">
      <span>{label}</span>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
