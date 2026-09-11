import { readDesignDoc } from "@/lib/design/source";

// The design system as a file, at a URL.
//
// /design is the page a person reads; this is the thing you hand to Claude,
// Cursor or anything else that would otherwise be given a pasted copy that
// goes stale the same afternoon. Same file, so the two can never disagree.
//
// Prerendered: the read happens once at build rather than on every request,
// and the file changes only when the repository does.
export const dynamic = "force-static";

export const GET = async () => {
  const doc = await readDesignDoc();

  return new Response(doc, {
    headers: {
      // text/markdown so a browser shows it rather than downloading it, and
      // so a fetching tool does not have to guess.
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'inline; filename="DESIGN.md"',
    },
  });
};
