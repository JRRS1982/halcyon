"use client";

import {
  Skeleton,
  SkeletonHeader,
  SkeletonPage,
  SkeletonPanel,
  SkeletonPanelStack,
  SkeletonSheet,
} from "@/components/ui/Skeleton";

// Import panel above, ledger below — the ledger page runs four queries in
// parallel (accounts, categories, the page of rows, the uncategorised count).
export default function TransactionsLoading() {
  return (
    <SkeletonPage label="your transactions" maxWidth="960px">
      <SkeletonHeader actions={<Skeleton width={180} height={30} />} />
      <SkeletonPanelStack>
        <SkeletonPanel bodyHeight={80} />
        <SkeletonSheet rows={10} />
      </SkeletonPanelStack>
    </SkeletonPage>
  );
}
