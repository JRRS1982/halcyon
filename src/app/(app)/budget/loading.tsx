"use client";

import {
  SkeletonHeader,
  SkeletonPage,
  SkeletonSheet,
  SkeletonToolbar,
} from "@/components/ui/Skeleton";
import { StatusPip } from "@/components/ui/StatusPip";

// Shown while the period lookup and its items resolve. Mirrors BudgetSheet's
// layout — header, toolbar, sheet — so the real sheet drops into the same
// footprint instead of shunting the page around.
export default function BudgetLoading() {
  return (
    <SkeletonPage label="your budget">
      <SkeletonHeader
        actions={<StatusPip state="saving">Loading…</StatusPip>}
      />
      <SkeletonToolbar />
      <SkeletonSheet rows={8} />
    </SkeletonPage>
  );
}
