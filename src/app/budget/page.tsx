import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureCurrentPeriod } from "./actions";
import { BudgetSheet, type SerializedItem, type SerializedPeriod } from "./BudgetSheet";

export default async function BudgetPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=/budget");
  }

  const period = await ensureCurrentPeriod();

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

  return <BudgetSheet period={serializedPeriod} initialItems={serializedItems} />;
}
