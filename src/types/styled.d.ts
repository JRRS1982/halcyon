// Augment styled-components' DefaultTheme with our theme shape so
// `styled.div<{}>` template literals get full token autocomplete.
//
// Module augmentation requires `interface extends` — a type alias here
// would replace rather than merge with styled-components' own DefaultTheme.

import type { Theme } from "@/lib/theme";

declare module "styled-components" {
  export interface DefaultTheme extends Theme {
    _brand?: never;
  }
}
