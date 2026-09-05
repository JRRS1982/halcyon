import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { rowMarkerProps, SyncMarker } from "@/app/(app)/plan/SyncMarker";
import { emptyRowTerms } from "@/lib/plan/rowTerms";
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
        <SyncMarker
          {...rowMarkerProps("l1", plan, "GBP", "COMMA_0", {
            value: 250000,
            flow: 1250,
          })}
        />
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

          terms: emptyRowTerms(),
        },
      ],
      additions: [],
      removals: [],
      unchanged: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker
          {...rowMarkerProps("p1", plan, "GBP", "COMMA_0", {
            value: 70000,
            flow: 0,
          })}
        />
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
        <SyncMarker
          {...rowMarkerProps("p3", plan, "GBP", "COMMA_0", {
            value: 70000,
            flow: 0,
          })}
        />
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
        <SyncMarker
          {...rowMarkerProps("p2", plan, "GBP", "COMMA_0", {
            value: 70000,
            flow: null,
          })}
        />
      </ThemeProvider>,
    );

    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });
  // The documented mitigation for this branch's one deliberate behaviour
  // change is this marker: a hand-typed monthlyRepayment with no REPAYMENT
  // budget row resets to 0 on the next Sync, and the ● is the only warning.
  // Showing the row's own £250,000 back at it made that warning useless —
  // nothing on screen had changed.
  test("when only the flow differs, the figure shown is the flow", () => {
    const plan: SyncPlan = {
      updates: [
        {
          id: "l1",
          value: 250000,
          label: "Halifax mortgage",
          wrapper: null,
          flow: 0,

          terms: emptyRowTerms(),
        },
      ],
      additions: [],
      removals: [],
      unchanged: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker
          {...rowMarkerProps("l1", plan, "GBP", "COMMA_0", {
            value: 250000,
            flow: 1250,
          })}
        />
      </ThemeProvider>,
    );

    expect(screen.queryByText("£250,000")).not.toBeInTheDocument();
    expect(screen.getByText("£0")).toBeInTheDocument();
    // And the name says what it is: the flow comes from the budget sheet, not
    // the balance sheet the default name names.
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
      /budget sheet/i,
    );
  });

  test("when both differ, the value is the figure shown", () => {
    const plan: SyncPlan = {
      updates: [
        {
          id: "l1",
          value: 240000,
          label: "Halifax mortgage",
          wrapper: null,
          flow: 0,

          terms: emptyRowTerms(),
        },
      ],
      additions: [],
      removals: [],
      unchanged: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker
          {...rowMarkerProps("l1", plan, "GBP", "COMMA_0", {
            value: 250000,
            flow: 1250,
          })}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("£240,000")).toBeInTheDocument();
  });

  // A label-only rename is a real update, and neither figure moved. Printing
  // the row's own value beside it would be the same false statement.
  test("when neither figure differs, no figure is shown", () => {
    const plan: SyncPlan = {
      updates: [
        {
          id: "p1",
          value: 70000,
          label: "AJ Bell SIPP",
          wrapper: null,
          flow: 0,

          terms: emptyRowTerms(),
        },
      ],
      additions: [],
      removals: [],
      unchanged: [],
    };

    render(
      <ThemeProvider theme={theme}>
        <SyncMarker
          {...rowMarkerProps("p1", plan, "GBP", "COMMA_0", {
            value: 70000,
            flow: 0,
          })}
        />
      </ThemeProvider>,
    );

    expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  });
});
