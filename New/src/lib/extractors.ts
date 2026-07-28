import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import * as cheerio from "cheerio";
import mammoth from "mammoth";

export type ExtractedSource = {
  title?: string;
  text: string;
  url?: string;
  publishedAt?: string;
};

const maxSourceChars = Number(process.env.MAX_SOURCE_CHARS ?? "60000");
const fetchTimeoutMs = 15_000;
const maxRedirects = 5;

const supportedFileExtensions = new Set([".pdf", ".txt", ".md", ".markdown", ".docx"]);

export function normalizeText(text: string) {
  return text.replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function truncateForAnalysis(text: string) {
  return text.length > maxSourceChars ? text.slice(0, maxSourceChars) : text;
}

// Checks the hostname *and* the IP address it resolves to, so a public-looking
// domain that points at an internal address (DNS rebinding, redirect chains) is
// still rejected — not just literal "localhost"/"127.0.0.1" style URLs.
async function assertPublicHost(hostname: string) {
  if (isBlockedHostname(hostname)) {
    throw new Error("Local and private network URLs are not supported.");
  }

  let addresses: string[];
  try {
    addresses = (await dnsLookup(hostname, { all: true })).map((entry) => entry.address);
  } catch {
    throw new Error("Could not resolve this URL's hostname.");
  }

  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new Error("This URL resolves to a private or local network address, which is not supported.");
  }
}

async function fetchWithTimeout(url: URL, signal: AbortSignal) {
  try {
    return await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "user-agent": "ResearchAnalysisBot/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The URL took too long to respond.");
    }
    throw new Error("Could not reach this URL.");
  }
}

export async function extractFromUrl(rawUrl: string): Promise<ExtractedSource> {
  let url = new URL(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
  let response: Response;

  try {
    for (let redirectCount = 0; ; redirectCount++) {
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only http and https URLs are supported.");
      }
      await assertPublicHost(url.hostname);

      response = await fetchWithTimeout(url, controller.signal);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("The URL redirected without a destination.");
        if (redirectCount >= maxRedirects) throw new Error("Too many redirects.");
        url = new URL(location, url);
        continue;
      }
      break;
    }
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`The URL returned ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error("The URL did not return an HTML article page.");
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Read the publish date (meta tags / <time> / JSON-LD) before stripping <script>
  // tags below — JSON-LD lives in <script type="application/ld+json">, so extracting
  // it after removal would always find nothing.
  const publishedAt = extractPublishedDate($, url.pathname);

  $("script, style, noscript, svg, nav, footer, header, aside, form").remove();

  const title =
    $('meta[property="og:title"]').attr("content") ??
    $("title").first().text() ??
    $("h1").first().text() ??
    url.hostname;

  const articleText =
    $("article").text() ||
    $("main").text() ||
    $('[role="main"]').text() ||
    $("body").text();

  const text = normalizeText(articleText);
  if (text.length < 200) {
    throw new Error("Could not extract enough readable text from this URL.");
  }

  return {
    title: normalizeText(title),
    text: truncateForAnalysis(text),
    url: url.toString(),
    publishedAt,
  };
}

export async function extractFromFile(fileName: string, mimeType: string, bytes: Buffer) {
  const extension = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  if (!supportedFileExtensions.has(extension)) {
    throw new Error("Unsupported file type. Upload PDF, DOCX, TXT, or Markdown.");
  }

  if (extension === ".pdf" || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(bytes);
    const text = normalizeText(parsed.text ?? "");
    if (text.length < 50) {
      throw new Error("No readable text was found in this PDF. Scanned PDF OCR is not supported yet.");
    }
    return { title: fileName, text: truncateForAnalysis(text) };
  }

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer: bytes });
    const text = normalizeText(result.value);
    if (text.length < 20) {
      throw new Error("No readable text was found in this DOCX file.");
    }
    return { title: fileName, text: truncateForAnalysis(text) };
  }

  const text = normalizeText(bytes.toString("utf8"));
  if (text.length < 20) {
    throw new Error("The file does not contain enough readable text.");
  }

  return { title: fileName, text: truncateForAnalysis(text) };
}

export function extractFromPlainText(text: string) {
  const normalized = normalizeText(text);
  if (normalized.length < 20) {
    throw new Error("Paste at least 20 characters of text to analyze.");
  }

  return {
    title: normalized.split("\n").find(Boolean)?.slice(0, 90) ?? "Pasted text",
    text: truncateForAnalysis(normalized),
  };
}

function tryDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
    return d.toISOString();
  }
  return undefined;
}

function extractPublishedDate($: ReturnType<typeof cheerio.load>, urlPath: string): string | undefined {
  // 1. Meta tags — ordered from most to least reliable
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[property="og:article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    'meta[name="publish-date"]',
    'meta[name="pub_date"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]',
    'meta[name="DC.date"]',
    'meta[name="DC.Date"]',
    'meta[name="DC.date.issued"]',
    'meta[name="creation_date"]',
    'meta[name="cXenseParse:recs:publishtime"]',
    'meta[name="sailthru.date"]',
    'meta[name="parsely-pub-date"]',
  ];

  for (const sel of metaSelectors) {
    const result = tryDate($( sel).attr("content"));
    if (result) return result;
  }

  // 2. <time datetime="..."> elements
  let timeResult: string | undefined;
  $("time[datetime]").each((_, el) => {
    if (timeResult) return;
    timeResult = tryDate($(el).attr("datetime"));
  });
  if (timeResult) return timeResult;

  // 3. JSON-LD structured data (handles nested @graph arrays)
  let jsonLdResult: string | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdResult) return;
    try {
      const raw = JSON.parse($(el).text()) as unknown;
      const candidates = Array.isArray(raw) ? raw : [raw];
      for (const node of candidates) {
        if (!node || typeof node !== "object") continue;
        const obj = node as Record<string, unknown>;
        // Handle @graph wrapper
        const items = Array.isArray(obj["@graph"]) ? obj["@graph"] : [obj];
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const n = item as Record<string, unknown>;
          for (const key of ["datePublished", "dateCreated", "dateModified"]) {
            const r = tryDate(typeof n[key] === "string" ? n[key] as string : undefined);
            if (r) { jsonLdResult = r; break; }
          }
          if (jsonLdResult) break;
        }
        if (jsonLdResult) break;
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });
  if (jsonLdResult) return jsonLdResult;

  // 4. Fall back to date pattern in the URL path (e.g. /2024/03/15/ or /20240315/)
  const slashDate = urlPath.match(/[\/\-_](\d{4})[\/\-_](0[1-9]|1[0-2])[\/\-_](0[1-9]|[12]\d|3[01])/);
  if (slashDate) {
    const r = tryDate(`${slashDate[1]}-${slashDate[2]}-${slashDate[3]}`);
    if (r) return r;
  }

  const compactDate = urlPath.match(/[\/\-_](20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[\/\-_]|$)/);
  if (compactDate) {
    const r = tryDate(`${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`);
    if (r) return r;
  }

  return undefined;
}

export function isBlockedHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower === "0.0.0.0" ||
    lower.startsWith("127.") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)
  );
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) || // link-local, includes cloud metadata (169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  return true; // not a recognizable IP — reject rather than risk letting it through
}
