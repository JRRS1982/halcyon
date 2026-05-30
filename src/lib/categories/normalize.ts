// Pure helpers for category label identity.
//
// `categoryKey` is the comparison key used for conservative dedup (at the
// ship migration) and find-or-create (when a budget row is free-typed). Two
// labels are "the same category" when their keys match. `cleanLabel` is the
// stored display form — tidied, but case preserved.

export function cleanLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export function categoryKey(label: string): string {
  return cleanLabel(label).toLowerCase();
}

export type LabelGroup = {
  key: string;
  label: string;
  count: number;
};

// Groups raw labels by their comparison key, preserving first-appearance order
// of the keys. The canonical `label` is the most frequent cleaned form, ties
// broken by first appearance. Callers partition by type/bucket before calling
// so a group never mixes income with expense.
export function dedupeLabels(labels: string[]): LabelGroup[] {
  // Map preserves insertion order, so iterating it yields first-appearance
  // order of the keys for free. `variants` counts each cleaned display form so
  // we can pick the most frequent (ties → first seen, which Map order gives).
  type Group = { count: number; variants: Map<string, number> };
  const groups = new Map<string, Group>();

  for (const raw of labels) {
    const key = categoryKey(raw);
    const display = cleanLabel(raw);
    const group: Group = groups.get(key) ?? { count: 0, variants: new Map() };
    group.count += 1;
    group.variants.set(display, (group.variants.get(display) ?? 0) + 1);
    groups.set(key, group);
  }

  const result: LabelGroup[] = [];
  groups.forEach((group, key) => {
    let label = "";
    let best = -1;
    group.variants.forEach((count, variant) => {
      if (count > best) {
        best = count;
        label = variant;
      }
    });
    result.push({ key, label, count: group.count });
  });
  return result;
}
