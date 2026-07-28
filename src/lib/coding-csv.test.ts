import { describe, expect, it } from "vitest";
import { parseCodingBatchRows } from "./coding-csv";

describe("parseCodingBatchRows", () => {
  it("extracts a URL-only row with no date/year", () => {
    const csv = "https://a.com/1";
    expect(parseCodingBatchRows(csv)).toEqual([{ url: "https://a.com/1", publicationDate: undefined, year: undefined }]);
  });

  it("extracts publication date and year from columns 2/3", () => {
    const csv = "https://a.com/1,2023-03-04,2023";
    const [row] = parseCodingBatchRows(csv);
    expect(row.url).toBe("https://a.com/1");
    expect(row.publicationDate).toBe(new Date("2023-03-04").toISOString());
    expect(row.year).toBe(2023);
  });

  it("accepts a date with only column 2 present, deriving nothing extra for year", () => {
    const csv = "https://a.com/1,2023-03-04";
    const [row] = parseCodingBatchRows(csv);
    expect(row.publicationDate).toBe(new Date("2023-03-04").toISOString());
    expect(row.year).toBeUndefined();
  });

  it("ignores an unparseable date and a malformed year", () => {
    const csv = "https://a.com/1,not-a-date,20xy";
    const [row] = parseCodingBatchRows(csv);
    expect(row.publicationDate).toBeUndefined();
    expect(row.year).toBeUndefined();
  });

  it("skips a header row that isn't a URL", () => {
    const csv = "url,publication_date,year\nhttps://a.com/1,2023-03-04,2023";
    expect(parseCodingBatchRows(csv)).toHaveLength(1);
  });

  it("deduplicates repeated URLs, keeping the first occurrence", () => {
    const csv = "https://a.com/1,2023-03-04,2023\nhttps://a.com/1,2024-01-01,2024";
    const rows = parseCodingBatchRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2023);
  });

  it("handles a quoted URL field containing a comma", () => {
    const csv = '"https://a.com/1?x=1,2",2023-03-04';
    const [row] = parseCodingBatchRows(csv);
    expect(row.url).toBe("https://a.com/1?x=1,2");
  });

  it("skips blank lines and rows without an http(s) URL", () => {
    const csv = "https://a.com/1\n\nnot-a-url,2023-03-04\nhttps://b.com/2";
    expect(parseCodingBatchRows(csv).map((r) => r.url)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });
});
