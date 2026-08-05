"use client";

import {
  SkeletonHeader,
  SkeletonPage,
  SkeletonPanel,
  SkeletonPanelStack,
} from "@/components/ui/Skeleton";

export default function PlanLoading() {
  return (
    <SkeletonPage label="your plan">
      <SkeletonHeader />
      <SkeletonPanelStack>
        <SkeletonPanel bodyHeight={300} />
        <SkeletonPanel bodyHeight={200} />
      </SkeletonPanelStack>
    </SkeletonPage>
  );
}
