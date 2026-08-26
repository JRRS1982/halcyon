import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { rowMarkerProps, SyncMarker } from "@/app/(app)/plan/SyncMarker";
import type { SyncPlan } from "@/lib/plan/sync";
import { theme } from "@/lib/theme";

describe("SyncMarker", () => {
  test("each of the four states renders a distinct accessible name", () => {
    render(
      <ThemeProvider theme={theme}>
        <SyncMarker indicator="synced" />
        <SyncMarker indicator="changed" sourceFigure="£81,002" />
        <SyncMarker indicator="plan-only" />
        <SyncMarker indicator="attached" />
      </ThemeProvider>,
    );

    const names = screen
      .getAllByRole("img")
      .map((el) => el.getAttribute("aria-label"));

    expect(names).toHaveLength(4);
    for (const name of names) {
      expect(name).toBeTruthy();
    }
    // Distinct, not merely present — two states sharing a label would leave a
    // screen-reader user unable to tell "changed" from "plan-only" apart, or
    // "plan-only" from "attached", which share the ◇ glyph on purpose.
    expect(new Set(names).size).toBe(4);
  });

  // A dragged row's marker must not claim the row is missing from the balance
  // sheet: a mortgage going only because its property went is still on it.
  test("a dragged row's marker says it goes with something, not that it is plan-only", () => {
    const plan: SyncPlan = {
      updates: [],
      additions: [],
      removals: [
        { id: "a1", label: "The house", reason: "gone", dependsOn: null },
        {
          id: "l1",
          label: "Halifax mortgage",
          reason: "cascade",
          dependsOn: "a1",
        },
      ],
      unchanged: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker {...rowMarkerProps("l1", plan, "GBP", "COMMA_0")} />
      </ThemeProvider>,
    );

    expect(screen.getByRole("img").getAttribute("aria-label")).not.toMatch(
      /not on your balance sheet/i,
    );
  });

  test("the changed marker shows the source figure from plan.updates", () => {
    const plan: SyncPlan = {
      updates: [
        {
          id: "p1",
          value: 81002,
          label: "AJ Bell SIPP",
          wrapper: null,
          flow: 0,
        },
      ],
      additions: [],
      removals: [],
      unchanged: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker {...rowMarkerProps("p1", plan, "GBP", "COMMA_0")} />
      </ThemeProvider>,
    );

    expect(screen.getByText("£81,002")).toBeInTheDocument();
  });

  test("the synced marker shows no figure", () => {
    const plan: SyncPlan = {
      updates: [],
      additions: [],
      removals: [],
      unchanged: ["p3"],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker {...rowMarkerProps("p3", plan, "GBP", "COMMA_0")} />
      </ThemeProvider>,
    );

    // Nothing to compare against — a stray number here would be misleading.
    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });

  test("the plan-only marker shows no figure", () => {
    const plan: SyncPlan = {
      updates: [],
      additions: [],
      removals: [
        { id: "p2", label: "Buy-to-let", reason: "plan-only", dependsOn: null },
      ],
      unchanged: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker {...rowMarkerProps("p2", plan, "GBP", "COMMA_0")} />
      </ThemeProvider>,
    );

    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });
});
