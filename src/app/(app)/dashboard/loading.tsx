"use client";

import {
  SkeletonHeader,
  SkeletonPage,
  SkeletonPanel,
  SkeletonPanelGrid,
  SkeletonPanelStack,
} from "@/components/ui/Skeleton";

// The dashboard pulls twelve months of periods with their items and balance
// items before it can render anything, so this is the longest wait in the app.
// One tall panel (cash flow) over a grid of category panels, matching
// DashboardView.
export default function DashboardLoading() {
  return (
    <SkeletonPage label="your dashboard">
      <SkeletonHeader />
      <SkeletonPanelStack>
        <SkeletonPanel bodyHeight={320} />
        <SkeletonPanelGrid>
          <SkeletonPanel bodyHeight={180} />
          <SkeletonPanel bodyHeight={180} />
          <SkeletonPanel bodyHeight={180} />
        </SkeletonPanelGrid>
      </SkeletonPanelStack>
    </SkeletonPage>
  );
}
