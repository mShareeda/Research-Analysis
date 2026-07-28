import { describe, expect, it } from "vitest";
import { parseUrlsFromCsv } from "./csv";

describe("parseUrlsFromCsv", () => {
  it("extracts URLs from a simple one-column CSV", () => {
    const csv = "https://a.com/1\nhttps://b.com/2\nhttps://c.com/3";
    expect(parseUrlsFromCsv(csv)).toEqual(["https://a.com/1", "https://b.com/2", "https://c.com/3"]);
  });

  it("skips a header row that isn't a URL", () => {
    const csv = "url\nhttps://a.com/1\nhttps://b.com/2";
    expect(parseUrlsFromCsv(csv)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("skips blank lines", () => {
    const csv = "https://a.com/1\n\n\nhttps://b.com/2\n";
    expect(parseUrlsFromCsv(csv)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("skips rows whose first field isn't an http(s) URL", () => {
    const csv = "not-a-url\nftp://a.com/1\nhttps://b.com/2";
    expect(parseUrlsFromCsv(csv)).toEqual(["https://b.com/2"]);
  });

  it("only reads the first column when there are extra columns", () => {
    const csv = "https://a.com/1,Title A,2026-01-01\nhttps://b.com/2,Title B,2026-01-02";
    expect(parseUrlsFromCsv(csv)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("handles a quoted first field", () => {
    const csv = '"https://a.com/1?x=1,2",Title A\nhttps://b.com/2';
    expect(parseUrlsFromCsv(csv)).toEqual(["https://a.com/1?x=1,2", "https://b.com/2"]);
  });

  it("deduplicates repeated URLs, keeping the first occurrence", () => {
    const csv = "https://a.com/1\nhttps://b.com/2\nhttps://a.com/1";
    expect(parseUrlsFromCsv(csv)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });

  it("returns an empty array when nothing looks like a URL", () => {
    const csv = "name,date\nfoo,bar";
    expect(parseUrlsFromCsv(csv)).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const csv = "https://a.com/1\r\nhttps://b.com/2\r\n";
    expect(parseUrlsFromCsv(csv)).toEqual(["https://a.com/1", "https://b.com/2"]);
  });
});
