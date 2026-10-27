import { parseCspReport } from "@/lib/site/cspReport";

describe("parseCspReport", () => {
  // Firefox and Safari: the older report-uri body.
  it("reads the report-uri format", () => {
    expect(
      parseCspReport({
        "csp-report": {
          "document-uri": "https://www.balanced.money/budget?month=2026-10",
          "effective-directive": "script-src-elem",
          "blocked-uri": "https://evil.example/x.js?user=me@example.com",
        },
      }),
    ).toEqual([
      {
        directive: "script-src-elem",
        blocked: "evil.example",
        page: "/budget",
      },
    ]);
  });

  // Chromium: the Reporting API, an array that can mix report types.
  it("reads the Reporting API format and skips other report types", () => {
    expect(
      parseCspReport([
        {
          type: "csp-violation",
          body: {
            documentURL: "https://www.balanced.money/",
            effectiveDirective: "style-src-elem",
            blockedURL: "https://cdn.example/a.css",
          },
        },
        { type: "deprecation", body: {} },
      ]),
    ).toEqual([
      { directive: "style-src-elem", blocked: "cdn.example", page: "/" },
    ]);
  });

  // Counts are keyed on this, so a query string or token in a URL must never
  // reach Redis or the logs.
  it("keeps only the host of a blocked URL and the path of the page", () => {
    const [violation] = parseCspReport({
      "csp-report": {
        "document-uri":
          "https://www.balanced.money/reset-password?token_hash=secret",
        "violated-directive": "img-src 'self'",
        "blocked-uri": "https://tracker.example/p.gif?id=secret",
      },
    });

    expect(JSON.stringify(violation)).not.toContain("secret");
    expect(violation).toEqual({
      directive: "img-src",
      blocked: "tracker.example",
      page: "/reset-password",
    });
  });

  it("keeps keywords such as inline and eval as they are", () => {
    const [violation] = parseCspReport({
      "csp-report": {
        "effective-directive": "script-src",
        "blocked-uri": "eval",
      },
    });

    expect(violation?.blocked).toBe("eval");
  });

  it("returns nothing for a body that is neither format", () => {
    expect(parseCspReport({ hello: "world" })).toEqual([]);
    expect(parseCspReport("not a report")).toEqual([]);
  });
});
