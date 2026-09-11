import { headers } from "next/headers";
import { parseMarkdown } from "@/lib/design/markdown";
import { readDesignDoc, splitDesignDoc } from "@/lib/design/source";
import { DesignSystem } from "./DesignSystem";

export const metadata = {
  title: "Design system — Balanced Money",
  description:
    "Balanced Money's design system: colour tokens, type scale, spacing, component and section patterns, rendered from the repository's DESIGN.md.",
};

// The raw-file URL is printed on the page for anyone pointing a tool at it, so
// it has to be the origin the reader actually reached — localhost in
// development, the deployed host in production. Read from the request rather
// than from an env var: there is one fewer thing to keep in step, and it is
// right on preview deployments too.
const requestOrigin = async () => {
  const head = await headers();
  const host = head.get("host") ?? "balanced.money";
  const protocol =
    head.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
};

export default async function DesignPage() {
  const { contract, prose } = splitDesignDoc(await readDesignDoc());
  const origin = await requestOrigin();

  return (
    <DesignSystem
      blocks={parseMarkdown(prose)}
      contract={contract}
      rawUrl={`${origin}/design.md`}
    />
  );
}
