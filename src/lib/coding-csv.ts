// Extracts rows for the F1 GP coding batch pipeline. Unlike the sentiment
// pipeline's CSV (URL-only), a row here may carry a user-supplied publication
// date and year in columns 2/3 — Publication Date and Year are never
// auto-extracted from the article, so this is the only way to set them for a
// batch row. Both extra columns are optional; a plain single-column, URL-only
// CSV still works exactly as before.

export type CodingBatchRow = { url: string; publicationDate?: string; year?: number };

function splitCsvFields(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCodingBatchRows(content: string): CodingBatchRow[] {
  const lines = content.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  const rows: CodingBatchRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const fields = splitCsvFields(line);
    const url = fields[0] ?? "";
    if (!/^https?:\/\//i.test(url)) continue; // skips header rows and blank/invalid cells
    if (seen.has(url)) continue;
    seen.add(url);

    const dateField = fields[1];
    const parsedDate = dateField ? new Date(dateField) : undefined;
    const publicationDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : undefined;

    const yearField = fields[2];
    const year = yearField && /^\d{4}$/.test(yearField) ? Number(yearField) : undefined;

    rows.push({ url, publicationDate, year });
  }

  return rows;
}
