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
  MessageSquareText,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import type { AnalysisReport, ViewLang } from "@/lib/schemas";
import { isBilingualReport, resolveReportLanguage } from "@/lib/schemas";
import { exportAnalysisPdf } from "@/lib/export-pdf";
import { formatDate, formatDateTime } from "@/lib/format";

type SourceMode = "url" | "text" | "file" | "csv";

type BatchItem = {
  id: string;
  url: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  error: string | null;
  sourceId: string | null;
};

type BatchDetail = {
  id: string;
  fileName: string;
  status: "RUNNING" | "DONE";
  items: BatchItem[];
};

type HistoryItem = {
  id: string;
  sourceId: string;
  title: string;
  sourceType: "URL" | "TEXT" | "FILE";
  language: string;
  createdAt: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  bahrainSentiment: string | null;
  confidence: number;
  summary: string;
};

type DetailResponse = {
  source: {
    id: string;
    title: string | null;
    url: string | null;
    fileName: string | null;
    language: string;
    extractedTextPreview: string;
  };
  result: {
    id: string;
    sentiment: string;
    confidence: number;
    summary: string;
    analysisJson: AnalysisReport;
    model: string;
    createdAt: string;
  };
};

const modeConfig = {
  url: { label: "URL", icon: LinkIcon },
  text: { label: "Text", icon: MessageSquareText },
  file: { label: "File", icon: FileText },
  csv: { label: "CSV", icon: FileSpreadsheet },
};

export function ResearchWorkspace() {
  const [mode, setMode] = useState<SourceMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<DetailResponse | null>(null);
  const [activeBatch, setActiveBatch] = useState<BatchDetail | null>(null);
  const [retryingBatch, setRetryingBatch] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [duplicateNotice, setDuplicateNotice] = useState<{ analyzedAt: string } | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySentiment, setHistorySentiment] = useState("");
  const [viewLang, setViewLang] = useState<ViewLang>("en");

  const selectedReport = selected?.result.analysisJson;
  const bilingual = selectedReport ? isBilingualReport(selectedReport) : false;
  const flatReport = selectedReport ? resolveReportLanguage(selectedReport, viewLang) : null;
  const direction = viewLang === "ar" ? "rtl" : "ltr";

  const loadDetail = useCallback(async (id: string) => {
    setError("");
    const response = await fetch(`/api/analyses/${id}`);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "Could not load this analysis.");
    }
    const detail = (await response.json()) as DetailResponse;
    setSelected(detail);
    setViewLang(detail.source.language === "ar" ? "ar" : "en");
  }, []);

  const loadHistory = useCallback(async (selectFirst = false) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historyQuery.trim()) params.set("q", historyQuery.trim());
      if (historySentiment) params.set("sentiment", historySentiment);

      const response = await fetch(`/api/analyses${params.toString() ? `?${params}` : ""}`);
      if (!response.ok) throw new Error("Could not load saved analyses.");
      const data = (await response.json()) as HistoryItem[];
      setHistory(data.filter((item) => item.id));
      if (selectFirst && data[0]?.id) {
        await loadDetail(data[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load saved analyses.");
    } finally {
      setLoadingHistory(false);
    }
  }, [historyQuery, historySentiment, loadDetail]);

  useEffect(() => {
    // Initial data synchronization with the persisted local research history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory(true);
  }, [loadHistory]);

  const fetchBatch = useCallback(async (batchId: string) => {
    const response = await fetch(`/api/batches/${batchId}`);
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

  async function deleteAnalysis(id: string) {
    const response = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not delete this analysis.");
      return;
    }
    if (selected?.result.id === id) setSelected(null);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }

  function submitAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "csv") return submitBatch();
    return runAnalyze(false);
  }

  async function runAnalyze(force: boolean) {
    setError("");
    setDuplicateNotice(null);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      if (mode === "url") formData.set("url", url);
      if (mode === "text") formData.set("text", text);
      if (mode === "file" && file) formData.set("file", file);
      if (force) formData.set("force", "true");

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Analysis failed.");

      if (body.duplicate) setDuplicateNotice({ analyzedAt: body.analyzedAt });

      await loadHistory();
      await loadDetail(body.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Analysis failed.");
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

      const response = await fetch("/api/batches", {
        method: "POST",
        body: formData,
      });

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
      const response = await fetch(`/api/batches/${activeBatch.id}/retry`, {
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
    if (mode === "text") return text.trim().length >= 20;
    if (mode === "csv") return Boolean(csvFile);
    return Boolean(file);
  }, [analyzing, csvFile, file, mode, text, url]);

  return (
    <section className="workspace">
        <aside className="sourcePanel">
          <form onSubmit={submitAnalysis}>
            <div className="segmented" aria-label="Source type">
              {(Object.entries(modeConfig) as Array<[SourceMode, (typeof modeConfig)[SourceMode]]>).map(
                ([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={mode === key ? "active" : ""}
                      onClick={() => {
                        setMode(key);
                        setDuplicateNotice(null);
                      }}
                    >
                      <Icon size={16} />
                      <span>{config.label}</span>
                    </button>
                  );
                },
              )}
            </div>

            {mode === "url" && (
              <label className="field">
                <span>Story URL</span>
                <input
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setDuplicateNotice(null);
                  }}
                  placeholder="https://example.com/story"
                  type="url"
                />
              </label>
            )}

            {mode === "text" && (
              <label className="field">
                <span>Source text</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Paste an article, statement, transcript, or research note."
                />
              </label>
            )}

            {mode === "file" && (
              <label className="dropzone">
                <Upload size={22} />
                <span>{file ? file.name : "Upload PDF, DOCX, TXT, or Markdown"}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            )}

            {mode === "csv" && (
              <label className="dropzone">
                <Upload size={22} />
                <span>{csvFile ? csvFile.name : "Upload a CSV with one URL per row"}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                />
              </label>
            )}

            <button className="primaryButton" disabled={!canSubmit} type="submit">
              {analyzing ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
              <span>{analyzing ? "Starting" : mode === "csv" ? "Run batch" : "Analyze source"}</span>
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

            {duplicateNotice && (
              <div className="notice">
                <p>Already analyzed on {formatDateTime(duplicateNotice.analyzedAt)} — showing the existing result.</p>
                <button type="button" className="secondaryButton" onClick={() => void runAnalyze(true)}>
                  Re-analyze anyway
                </button>
              </div>
            )}
          </form>

          <div className="historyHeader">
            <h2>History</h2>
            <span>{loadingHistory ? "Loading" : `${history.length} saved`}</span>
          </div>

          <div className="historyFilters">
            <input
              className="historySearch"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search title or URL"
              type="search"
              aria-label="Search saved analyses"
            />
            <select
              value={historySentiment}
              onChange={(event) => setHistorySentiment(event.target.value)}
              aria-label="Filter by sentiment"
            >
              <option value="">All sentiment</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          <div className="historyList">
            {history.map((item) => (
              <div
                key={item.id}
                className={selected?.result.id === item.id ? "historyItem selected" : "historyItem"}
              >
                <button
                  type="button"
                  className="historyItemMain"
                  onClick={() => void loadDetail(item.id).catch((detailError) => setError(detailError.message))}
                >
                  <div className="historyPills">
                    <span className={`pill ${item.sentiment.toLowerCase()}`}>
                      📰 {item.sentiment.toLowerCase()}
                    </span>
                    {item.bahrainSentiment && (
                      <span className={`pill ${item.bahrainSentiment.toLowerCase()}`}>
                        🇧🇭 {item.bahrainSentiment.toLowerCase()}
                      </span>
                    )}
                  </div>
                  <strong>{item.title}</strong>
                  <small>{formatDate(item.createdAt)}</small>
                </button>
                <button
                  type="button"
                  className="deleteButton"
                  aria-label="Delete analysis"
                  onClick={() => void deleteAnalysis(item.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!loadingHistory && history.length === 0 && <p className="empty">No analyses saved yet.</p>}
          </div>
        </aside>

        <section className="analysisPanel">
          {activeBatch ? (
            <BatchProgress
              batch={activeBatch}
              retrying={retryingBatch}
              onDismiss={() => setActiveBatch(null)}
              onRetryFailed={() => void retryFailedBatchItems()}
              onRetryItem={(itemId) => void retryFailedBatchItems(itemId)}
              onOpen={(sourceId) => {
                setActiveBatch(null);
                void loadDetail(sourceId).catch((detailError) => setError(detailError.message));
              }}
            />
          ) : !selected || !flatReport ? (
            <div className="emptyState">
              <Search size={34} />
              <h2>No analysis selected</h2>
              <p>Submit a source to create an evidence-based sentiment report.</p>
            </div>
          ) : (
            <article dir={direction}>
              <div className="resultHeader">
                <div>
                  <p className="eyebrow">{selected.source.url ?? selected.source.fileName ?? "Pasted text"}</p>
                  <h2>{selected.source.title ?? "Untitled source"}</h2>
                </div>
                <div className="resultMeta">
                  {bilingual && (
                    <div className="segmented langSegmented" aria-label="Result language">
                      <button type="button" className={viewLang === "en" ? "active" : ""} onClick={() => setViewLang("en")}>
                        <span>EN</span>
                      </button>
                      <button type="button" className={viewLang === "ar" ? "active" : ""} onClick={() => setViewLang("ar")}>
                        <span>عربي</span>
                      </button>
                    </div>
                  )}
                  <div className="scoreTrack">
                    <div className={`score ${flatReport.sentiment}`}>
                      <span className="scoreIcon" aria-hidden="true">📰</span>
                      <span className="scoreLabel">{flatReport.sentiment}</span>
                      <span className="scoreConfidence">{Math.round(flatReport.confidence * 100)}% confidence</span>
                    </div>
                    {flatReport.bahrainSentiment && (
                      <div className={`score ${flatReport.bahrainSentiment}`}>
                        <span className="scoreIcon" aria-hidden="true">🇧🇭</span>
                        <span className="scoreLabel">{flatReport.bahrainSentiment}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="exportButton"
                    onClick={() =>
                      exportAnalysisPdf({
                        title: selected.source.title,
                        url: selected.source.url,
                        fileName: selected.source.fileName,
                        model: selected.result.model,
                        createdAt: selected.result.createdAt,
                        report: flatReport,
                      })
                    }
                  >
                    <Download size={14} />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>

              <section className="reportSection">
                <h3>Summary</h3>
                <p>{flatReport.summary}</p>
              </section>

              {flatReport.bahrainHeaderMentions !== undefined && (
                <div className="bahrainCard">
                  <h3>🇧🇭 Bahrain analysis</h3>
                  <div className="bahrainMeta">
                    <div className="bahrainRow">
                      <span className="bahrainLabel">Mentions</span>
                      <span>
                        Title:{" "}
                        <strong>
                          {flatReport.bahrainHeaderMentions}{" "}
                          {flatReport.bahrainHeaderMentions === 1 ? "time" : "times"}
                        </strong>
                        {" · "}
                        Body:{" "}
                        <strong>
                          {flatReport.bahrainBodyMentions}{" "}
                          {flatReport.bahrainBodyMentions === 1 ? "time" : "times"}
                        </strong>
                      </span>
                    </div>
                    {flatReport.bahrainContext && flatReport.bahrainContext.length > 0 && (
                      <div className="bahrainRow">
                        <span className="bahrainLabel">Context</span>
                        {flatReport.bahrainContext.map((ctx) => (
                          <span key={ctx} className="tag tagContext">
                            {ctx}
                          </span>
                        ))}
                      </div>
                    )}
                    {flatReport.bahrainProminence && (
                      <div className="bahrainRow">
                        <span className="bahrainLabel">Prominence</span>
                        <span
                          className={`tag tagProminence tagProminence--${flatReport.bahrainProminence.toLowerCase()}`}
                        >
                          {flatReport.bahrainProminence}
                        </span>
                      </div>
                    )}
                  </div>
                  {flatReport.bahrainClassificationBasis && (
                    <div className="bahrainSection">
                      <p className="bahrainSectionLabel">Framing</p>
                      <p className="bahrainSectionText">{flatReport.bahrainClassificationBasis}</p>
                    </div>
                  )}
                  {flatReport.bahrainSentimentKeywords && flatReport.bahrainSentimentKeywords.length > 0 && (
                    <div className="bahrainSection">
                      <p className="bahrainSectionLabel">Keywords</p>
                      <div className="sentimentKeywords">
                        {flatReport.bahrainSentimentKeywords.map((kw, i) => (
                          <span key={i} className="keyword">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <section className="reportSection">
                <h3>Classification basis</h3>
                <p>{flatReport.classificationBasis}</p>
                {flatReport.sentimentKeywords && flatReport.sentimentKeywords.length > 0 && (
                  <div className="sentimentKeywords">
                    {flatReport.sentimentKeywords.map((kw, i) => (
                      <span key={i} className="keyword">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="reportSection">
                <h3>Evidence</h3>
                <div className="evidenceGrid">
                  {flatReport.supportingEvidence.map((item, index) => (
                    <figure key={`${item.quote}-${index}`}>
                      <blockquote>{item.quote}</blockquote>
                      <figcaption>{item.explanation}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>

              <div className="reportColumns">
                <ListSection title="Key claims" items={flatReport.keyClaims} />
                <ListSection title="Tone signals" items={flatReport.toneSignals} />
              </div>

              <details className="sourcePreview">
                <summary>Source text preview</summary>
                <pre>{selected.source.extractedTextPreview}</pre>
              </details>
            </article>
          )}
        </section>
    </section>
  );
}

function BatchProgress({
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
  onOpen: (sourceId: string) => void;
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
            {item.status === "SUCCESS" && item.sourceId && (
              <button type="button" className="secondaryButton" onClick={() => onOpen(item.sourceId!)}>
                View
              </button>
            )}
            {item.status === "FAILED" && (
              <button
                type="button"
                className="retryButton"
                disabled={retrying}
                onClick={() => onRetryItem(item.id)}
                aria-label="Retry this URL"
              >
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

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="miniSection">
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
