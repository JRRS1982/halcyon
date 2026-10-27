import { z } from "zod";

// One Content-Security-Policy violation, reduced to what decides whether the
// policy is safe to enforce: which rule would have fired, and what it would
// have blocked. Nothing personal survives — the blocked resource keeps only
// its host or keyword, and the page keeps only its path.
export type CspViolation = {
  directive: string;
  blocked: string;
  page: string;
};

// Browsers send one of two shapes. Firefox and Safari use the older
// `report-uri` body; Chromium uses the Reporting API, an array of reports.
const legacyReport = z.object({
  "csp-report": z.object({
    "effective-directive": z.string().optional(),
    "violated-directive": z.string().optional(),
    "blocked-uri": z.string().optional(),
    "document-uri": z.string().optional(),
  }),
});

const reportingApiReport = z.array(
  z.object({
    type: z.string(),
    body: z
      .object({
        effectiveDirective: z.string().optional(),
        blockedURL: z.string().optional(),
        documentURL: z.string().optional(),
      })
      .optional(),
  }),
);

// Keys end up in Redis and in logs, so they are kept short and plain.
const tidy = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.:\-/]/g, "")
    .slice(0, 100);

// A URL keeps its host only; `inline`, `eval`, `data`, `blob` and the like
// arrive as bare keywords and stay as they are.
const blockedSource = (raw: string | undefined): string => {
  if (!raw) return "unknown";
  try {
    const url = new URL(raw);
    return tidy(url.host || url.protocol.replace(":", ""));
  } catch {
    return tidy(raw) || "unknown";
  }
};

const pagePath = (raw: string | undefined): string => {
  if (!raw) return "unknown";
  try {
    return tidy(new URL(raw).pathname) || "/";
  } catch {
    return "unknown";
  }
};

// "script-src-elem 'self'" and "script-src-elem" both name the same rule.
const directiveName = (raw: string | undefined): string =>
  tidy(raw?.split(" ")[0] ?? "") || "unknown";

/** Parses a violation report body in either browser format; [] if it is neither. */
export const parseCspReport = (body: unknown): CspViolation[] => {
  const legacy = legacyReport.safeParse(body);
  if (legacy.success) {
    const report = legacy.data["csp-report"];
    return [
      {
        directive: directiveName(
          report["effective-directive"] ?? report["violated-directive"],
        ),
        blocked: blockedSource(report["blocked-uri"]),
        page: pagePath(report["document-uri"]),
      },
    ];
  }

  const modern = reportingApiReport.safeParse(body);
  if (!modern.success) return [];
  return modern.data
    .filter((report) => report.type === "csp-violation" && report.body)
    .map(({ body }) => ({
      directive: directiveName(body?.effectiveDirective),
      blocked: blockedSource(body?.blockedURL),
      page: pagePath(body?.documentURL),
    }));
};
