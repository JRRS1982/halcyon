"use client";

// styled-components SSR registry for Next 14 App Router.
// Collects styles during streaming render and flushes them into the HTML
// stream so the first paint has all rules in place (no flash of unstyled
// content / hydration warnings).
//
// Pattern from https://styled-components.com/docs/advanced#with-other-css-frameworks-1
// and https://nextjs.org/docs/app/building-your-application/styling/css-in-js#styled-components.

import { useServerInsertedHTML } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  ServerStyleSheet,
  StyleSheetManager,
  ThemeProvider,
} from "styled-components";
import { theme } from "@/lib/theme";

export function StyledComponentsRegistry({ children }: { children: ReactNode }) {
  const [sheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = sheet.getStyleElement();
    sheet.instance.clearTag();
    return <>{styles}</>;
  });

  if (typeof window !== "undefined")
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;

  return (
    <StyleSheetManager sheet={sheet.instance}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </StyleSheetManager>
  );
}
