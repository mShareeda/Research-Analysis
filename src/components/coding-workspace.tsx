"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  LinkIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import type { CodedArticle } from "@/lib/coding-schemas";
import {
  ARTICLE_TYPE_LABELS_AR,
  CENTRALITY_LABELS_AR,
  CONTEXT_LABELS_AR,
  LIFE_CYCLE_LABELS_AR,
  IMAGE_LABELS_AR,
  NEWS_FRAME_LABELS_AR,
  TONE_LABELS_AR,
  UI_LABELS,
  translateEnum,
} from "@/lib/coding-labels";
import { formatDate, formatDateTime } from "@/lib/format";

type SourceMode = "url" | "csv";
type ViewLang = "en" | "ar";

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
  url: { label: "URL", icon: LinkIcon },
  csv: { label: "CSV", icon: FileSpreadsheet },
};

export function CodingWorkspace() {
  const [mode, setMode] = useState<SourceMode>("url");
  const [url, setUrl] = useState("");
  const [publicationDateInput, setPublicationDateInput] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [history, setHistory] = useState<CodedArticle[]>([]);
  const [selected, setSelected] = useState<DetailResponse | null>(null);
  const [viewLang, setViewLang] = useState<ViewLang>("en");
  const [activeBatch, setActiveBatch] = useState<BatchDetail | null>(null);
  const [retryingBatch, setRetryingBatch] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");

  const t = UI_LABELS[viewLang];
  const direction = viewLang === "ar" ? "rtl" : "ltr";

  const loadDetail = useCallback(async (id: string) => {
    setError("");
    const response = await fetch(`/api/coding/${id}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "Could not load this coded article.");
    }
    const detail = (await response.json()) as DetailResponse;
    setSelected(detail);
    setViewLang("en");
  }, []);

  const loadHistory = useCallback(async (selectFirst = false) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyQuery.trim()) params.set("q", historyQuery.trim());
      const response = await fetch(`/api/coding${params.toString() ? `?${params}` : ""}`);
      if (!response.ok) throw new Error("Could not load coded articles.");
      const data = (await response.json()) as CodedArticle[];
      setHistory(data);
      if (selectFirst && data[0]?.id) {
        await loadDetail(data[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load coded articles.");
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
    if (!response.ok) throw new Error("Could not load batch progress.");
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
        .catch((batchError) => setError(batchError instanceof Error ? batchError.message : "Batch polling failed."));
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBatch, fetchBatch, loadHistory]);

  async function deleteArticle(id: string) {
    const response = await fetch(`/api/coding/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not delete this coded article.");
      return;
    }
    if (selected?.id === id) setSelected(null);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }

  function submitAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "csv") return submitBatch();
    return runCode();
  }

  async function runCode() {
    setError("");
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.set("url", url);
      if (publicationDateInput) formData.set("publicationDate", publicationDateInput);
      if (yearInput) formData.set("year", yearInput);

      const response = await fetch("/api/coding", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Coding failed.");

      await loadHistory();
      await loadDetail(body.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Coding failed.");
    } finally {
      setAnalyzing(false);
    }
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
      if (!response.ok) throw new Error(body.error ?? "Could not start the batch.");

      setCsvFile(null);
      setActiveBatch(await fetchBatch(body.id));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not start the batch.");
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
      if (!response.ok) throw new Error(body.error ?? "Could not retry failed items.");
      setActiveBatch(await fetchBatch(activeBatch.id));
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Could not retry failed items.");
    } finally {
      setRetryingBatch(false);
    }
  }

  const canSubmit = useMemo(() => {
    if (analyzing) return false;
    if (mode === "url") return url.trim().length > 0;
    return Boolean(csvFile);
  }, [analyzing, csvFile, mode, url]);

  return (
    <section className="workspace">
      <aside className="sourcePanel">
        <form onSubmit={submitAnalysis}>
          <div className="segmented codingSegmented" aria-label="Source type">
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

          {mode === "url" && (
            <>
              <label className="field">
                <span>Article URL</span>
                <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/f1-bahrain-story" type="url" />
              </label>
              <div className="codingGrid codingDateFields">
                <label className="codingField">
                  <span>Publication date (optional)</span>
                  <input type="date" value={publicationDateInput} onChange={(event) => setPublicationDateInput(event.target.value)} />
                </label>
                <label className="codingField">
                  <span>Year (optional)</span>
                  <input type="number" min={2021} max={2025} value={yearInput} onChange={(event) => setYearInput(event.target.value)} placeholder="2023" />
                </label>
              </div>
              <p className="fieldHint">Not auto-extracted — enter these yourself if you know them.</p>
            </>
          )}

          {mode === "csv" && (
            <>
              <label className="dropzone">
                <Upload size={22} />
                <span>{csvFile ? csvFile.name : "Upload a CSV with one article URL per row"}</span>
                <input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} />
              </label>
              <p className="fieldHint">Columns: url, publication date (optional), year (optional). Not auto-extracted.</p>
            </>
          )}

          <button className="primaryButton" disabled={!canSubmit} type="submit">
            {analyzing ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            <span>{analyzing ? "Starting" : mode === "csv" ? "Run batch" : "Code article"}</span>
          </button>

          {error && (
            <div className="error">
              <p>{error}</p>
              {mode === "csv" && csvFile && !activeBatch && (
                <button type="button" className="secondaryButton" onClick={() => void submitBatch()}>
                  Retry
                </button>
              )}
            </div>
          )}
        </form>

        <div className="historyHeader">
          <h2>Coded articles</h2>
          <span>{loadingHistory ? "Loading" : `${history.length} coded`}</span>
        </div>

        <div className="historyFilters">
          <input
            className="historySearch"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Search title or URL"
            type="search"
            aria-label="Search coded articles"
          />
        </div>

        <button
          type="button"
          className="secondaryButton exportCsvLink"
          onClick={() => {
            window.location.href = "/api/coding/export";
          }}
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>

        <div className="historyList">
          {history.map((item) => (
            <div key={item.id} className={selected?.id === item.id ? "historyItem selected" : "historyItem"}>
              <button type="button" className="historyItemMain" onClick={() => void loadDetail(item.id).catch((detailError) => setError(detailError.message))}>
                <div className="historyPills">
                  <span className="pill neutral">{item.site}</span>
                  <span className={`pill ${item.overallTone.toLowerCase()}`}>{item.overallTone}</span>
                </div>
                <strong>{item.articleTitle}</strong>
                <small>{formatDate(item.createdAt)}</small>
              </button>
              <button type="button" className="deleteButton" aria-label="Delete coded article" onClick={() => void deleteArticle(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!loadingHistory && history.length === 0 && <p className="empty">No articles coded yet.</p>}
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
        ) : !selected ? (
          <div className="emptyState">
            <Search size={34} />
            <h2>No article selected</h2>
            <p>Submit an article URL or a CSV batch to code it against the study guide.</p>
          </div>
        ) : (
          <article dir={direction}>
            <div className="resultHeader">
              <div>
                <p className="eyebrow">{selected.url ?? "Untitled source"}</p>
                <h2>{selected.articleTitle}</h2>
              </div>
              <div className="resultMeta">
                <div className="segmented langSegmented" aria-label="Result language">
                  <button type="button" className={viewLang === "en" ? "active" : ""} onClick={() => setViewLang("en")}>
                    <span>EN</span>
                  </button>
                  <button type="button" className={viewLang === "ar" ? "active" : ""} onClick={() => setViewLang("ar")}>
                    <span>عربي</span>
                  </button>
                </div>
                <p className="analysedDate">{formatDateTime(selected.createdAt)}</p>
              </div>
            </div>

            <section className="reportSection codingForm">
              <h3>{t.articleInformation}</h3>
              <div className="codingGrid">
                <InfoField label={t.website} value={selected.site === "Other" ? (selected.siteOther ?? selected.site) : selected.site} />
                <InfoField label={t.articleTitle} value={selected.articleTitle} />
                <InfoField label={t.url} value={selected.url ?? "—"} />
                <InfoField label={t.publicationDate} value={selected.publicationDate ? formatDate(selected.publicationDate) : "—"} />
                <InfoField label={t.year} value={selected.year ?? "—"} />
                <InfoField label={t.lifeCycle} value={translateEnum(LIFE_CYCLE_LABELS_AR, selected.lifeCycle, viewLang)} />
                <InfoField label={t.articleType} value={translateEnum(ARTICLE_TYPE_LABELS_AR, selected.articleType, viewLang)} />
              </div>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.bahrainMentions}</h3>
              <div className="codingGrid">
                <InfoField label={t.bahrainInTitle} value={selected.bahrainInTitle ? t.yes : t.no} />
                <InfoField label={t.headlineMentions} value={selected.headlineMentions} />
                <InfoField label={t.bodyMentions} value={selected.bodyMentions} />
              </div>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.bahrainCentrality}</h3>
              <p>{translateEnum(CENTRALITY_LABELS_AR, selected.bahrainCentrality, viewLang)}</p>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.overallTone}</h3>
              <p className={`pill ${selected.overallTone.toLowerCase()}`}>{translateEnum(TONE_LABELS_AR, selected.overallTone, viewLang)}</p>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.toneTowardBahrain}</h3>
              <p className={`pill ${selected.toneTowardBahrain.toLowerCase()}`}>{translateEnum(TONE_LABELS_AR, selected.toneTowardBahrain, viewLang)}</p>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.dominantContext}</h3>
              <p>{translateEnum(CONTEXT_LABELS_AR, selected.dominantContext, viewLang)}</p>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.dominantNewsFrame}</h3>
              <p>
                {translateEnum(NEWS_FRAME_LABELS_AR, selected.dominantNewsFrame, viewLang)}
                {selected.dominantNewsFrame === "Other" && selected.newsFrameOther ? ` — ${selected.newsFrameOther}` : ""}
              </p>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.dominantImage}</h3>
              <p>
                {translateEnum(IMAGE_LABELS_AR, selected.dominantImage, viewLang)}
                {selected.dominantImage === "Other" && selected.imageOther ? ` — ${selected.imageOther}` : ""}
              </p>
            </section>

            <section className="reportSection codingForm">
              <h3>{t.notes}</h3>
              <p>{(viewLang === "ar" ? selected.notes?.ar : selected.notes?.en) || t.noNotes}</p>
            </section>

            <details className="sourcePreview">
              <summary>Source text preview</summary>
              <pre>{selected.extractedTextPreview}</pre>
            </details>
          </article>
        )}
      </section>
    </section>
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
          <h2>{batch.status === "RUNNING" ? "Running batch" : "Batch complete"}</h2>
          <p className="batchSummary">
            {successCount} succeeded · {failedCount} failed · {pendingCount} pending
          </p>
        </div>
        <div className="batchHeaderActions">
          {batch.status === "DONE" && failedCount > 0 && (
            <button type="button" className="secondaryButton" disabled={retrying} onClick={onRetryFailed}>
              {retrying ? "Retrying…" : `Retry ${failedCount} failed`}
            </button>
          )}
          <button type="button" className="secondaryButton" onClick={onDismiss}>
            Close
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
                View
              </button>
            )}
            {item.status === "FAILED" && (
              <button type="button" className="retryButton" disabled={retrying} onClick={() => onRetryItem(item.id)} aria-label="Retry this URL">
                <RefreshCw size={14} />
                <span>Retry</span>
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
