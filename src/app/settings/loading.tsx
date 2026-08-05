"use client";

import {
  SkeletonHeader,
  SkeletonPage,
  SkeletonPanel,
  SkeletonPanelStack,
} from "@/components/ui/Skeleton";

// Five stacked sections: preferences, chart visibility, categories, accounts,
// data & privacy. The category and account managers each run their own
// grouped counts, so the whole page waits on the slowest.
export default function SettingsLoading() {
  return (
    <SkeletonPage label="your settings" maxWidth="720px">
      <SkeletonHeader />
      <SkeletonPanelStack>
        <SkeletonPanel bodyHeight={160} />
        <SkeletonPanel bodyHeight={120} />
        <SkeletonPanel bodyHeight={200} />
        <SkeletonPanel bodyHeight={120} />
      </SkeletonPanelStack>
    </SkeletonPage>
  );
}
