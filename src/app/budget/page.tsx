import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  BudgetSheet,
  type SerializedItem,
  type SerializedPeriod,
} from "./BudgetSheet";
import { ensureCurrentPeriod } from "./actions";

type PageProps = {
  searchParams: { period?: string };
};

export default async function BudgetPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/budget");
  }

  // ?period=<id> — load that specific period if it exists and belongs to the
  // signed-in user. Otherwise fall back to the current month (creating if
  // necessary).
  let period = null;
  if (searchParams.period) {
    period = await prisma.financialPeriod.findFirst({
      where: {
        id: searchParams.period,
        userId: user.id,
        deletedAt: null,
      },
    });
  }
  if (!period) {
    period = await ensureCurrentPeriod();
  }

  const items = await prisma.financialItem.findMany({
    where: { periodId: period.id, deletedAt: null },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  // Serialize Decimal + Date for the client component (Next.js can't pass
  // those over the RSC boundary directly).
  const serializedPeriod: SerializedPeriod = {
    id: period.id,
    label: period.label,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
  };

  const serializedItems: SerializedItem[] = items.map((i) => ({
    id: i.id,
    type: i.type,
    parentItemId: i.parentItemId,
    label: i.label,
    budget: Number(i.budget),
    actual: Number(i.actual),
    sortOrder: i.sortOrder,
  }));

  return (
    <BudgetSheet period={serializedPeriod} initialItems={serializedItems} />
  );
}
