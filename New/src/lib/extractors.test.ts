import { describe, expect, it } from "vitest";
import { isBlockedHostname, isPrivateIp, normalizeText, truncateForAnalysis } from "./extractors";

describe("normalizeText", () => {
  it("converts a lone CR to LF", () => {
    expect(normalizeText("line one\rline two")).toBe("line one\nline two");
  });

  it("turns a CRLF into a blank-line paragraph break (the leftover \\n after \\r\\u2192\\n stacks with the original \\n)", () => {
    expect(normalizeText("line one\r\nline two")).toBe("line one\n\nline two");
  });

  it("strips trailing whitespace before line breaks", () => {
    expect(normalizeText("line one   \nline two")).toBe("line one\nline two");
  });

  it("collapses three or more blank lines down to one blank line", () => {
    expect(normalizeText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeText("  \n hello \n  ")).toBe("hello");
  });
});

describe("truncateForAnalysis", () => {
  it("leaves short text untouched", () => {
    expect(truncateForAnalysis("short text")).toBe("short text");
  });

  it("truncates text longer than the configured max", () => {
    const long = "x".repeat(70_000);
    const result = truncateForAnalysis(long);
    expect(result.length).toBe(60_000);
  });
});

describe("isBlockedHostname", () => {
  it("blocks localhost variants", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("LOCALHOST")).toBe(true);
    expect(isBlockedHostname("foo.localhost")).toBe(true);
  });

  it("blocks common private IP prefixes", () => {
    expect(isBlockedHostname("127.0.0.1")).toBe(true);
    expect(isBlockedHostname("10.0.0.5")).toBe(true);
    expect(isBlockedHostname("192.168.1.1")).toBe(true);
    expect(isBlockedHostname("172.16.0.1")).toBe(true);
    expect(isBlockedHostname("172.31.255.255")).toBe(true);
    expect(isBlockedHostname("0.0.0.0")).toBe(true);
  });

  it("does not block a public hostname or a 172.x address outside the private range", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("172.32.0.1")).toBe(false);
    expect(isBlockedHostname("172.15.0.1")).toBe(false);
  });
});

describe("isPrivateIp", () => {
  it("flags IPv4 loopback, private, and link-local ranges", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("172.20.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true); // cloud metadata endpoint
  });

  it("allows a normal public IPv4 address", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("93.184.216.34")).toBe(false);
  });

  it("flags IPv6 loopback and unique-local/link-local ranges", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("rejects a value that isn't a recognizable IP at all", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});
