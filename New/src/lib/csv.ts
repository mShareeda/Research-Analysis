// Extracts the URLs to analyze out of an uploaded CSV file.
// Assumes URLs are in the first column; an optional header row is detected and skipped.

function firstField(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    if (end !== -1) return trimmed.slice(1, end).trim();
  }
  const commaIndex = trimmed.indexOf(",");
  return (commaIndex === -1 ? trimmed : trimmed.slice(0, commaIndex)).trim();
}

export function parseUrlsFromCsv(content: string): string[] {
  const lines = content.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const field = firstField(line);
    if (!/^https?:\/\//i.test(field)) continue; // skips header rows and blank/invalid cells
    if (seen.has(field)) continue;
    seen.add(field);
    urls.push(field);
  }

  return urls;
}
