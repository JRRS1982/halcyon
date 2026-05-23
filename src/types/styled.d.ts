// Augment styled-components' DefaultTheme with our theme shape so
// `styled.div<{}>` template literals get full token autocomplete.

import type { Theme } from "@/lib/theme";

declare module "styled-components" {
  // biome-ignore lint/suspicious/noEmptyInterface: module augmentation pattern
  export interface DefaultTheme extends Theme {}
}
