// Guards post-auth redirect targets against open-redirect. Only in-app,
// same-origin absolute paths are allowed through; everything else falls back to
// `fallback` ("/"). Rejected inputs:
//  - non-strings / missing (`FormData.get` returns null; URL params can repeat)
//  - values not starting with "/" (absolute URLs like `https://evil.com`, and
//    authority-escape tricks like `@evil.com` / `.evil.com` that break out of a
//    `${origin}${next}` concatenation)
//  - protocol-relative `//evil.com` and backslash `/\evil.com` — browsers
//    normalise "\" to "/" per the WHATWG URL parser, so both resolve to an
//    external authority.
//  - control-char smuggling like `/\t/evil.com` — the URL parser strips ASCII
//    tab/newline/CR anywhere in the URL before parsing, collapsing it to
//    `//evil.com`, so strip them first and validate what the browser resolves.
export function safeNext(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback;
  const path = raw.replace(/[\t\n\r]/g, "");
  if (!path.startsWith("/")) return fallback;
  if (path[1] === "/" || path[1] === "\\") return fallback;
  return path;
}
