"use client";

import {
  SkeletonHeader,
  SkeletonPage,
  SkeletonSheet,
  SkeletonToolbar,
} from "@/components/ui/Skeleton";
import { StatusPip } from "@/components/ui/StatusPip";

export default function BalanceLoading() {
  return (
    <SkeletonPage label="your balance sheet">
      <SkeletonHeader
        actions={<StatusPip state="saving">Loading…</StatusPip>}
      />
      <SkeletonToolbar chips={8} />
      <SkeletonSheet rows={7} />
    </SkeletonPage>
  );
}
