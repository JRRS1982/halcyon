/** @jest-environment jsdom */
import { theme } from "@/lib/theme";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { EventFields, EventsTable } from "./EventsTable";

const updatePlanEvent = jest.fn().mockResolvedValue(undefined);
const createPlanEvent = jest.fn().mockResolvedValue("ev-2");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("./actions", () => ({
  updatePlanEvent: (...a: unknown[]) => updatePlanEvent(...a),
  createPlanEvent: (...a: unknown[]) => createPlanEvent(...a),
}));

const manualEvent = {
  id: "ev-1",
  label: "Wedding",
  age: 40,
  direction: "OUTFLOW" as const,
  amount: 5000,
  kind: "MANUAL" as const,
  assetId: null,
};

const properties = [{ id: "home", label: "Home" }];

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe("EventFields", () => {
  it("switching an event to Property sale saves kind PROPERTY_SALE", async () => {
    renderWithTheme(
      <EventFields event={manualEvent} properties={properties} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: /type/i }), {
      target: { value: "PROPERTY_SALE" },
    });
    fireEvent.blur(screen.getByRole("combobox", { name: /type/i }));
    await waitFor(() =>
      expect(updatePlanEvent).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "PROPERTY_SALE" }),
      ),
    );
  });

  it("shows a property picker and hides Amount for a sale event", () => {
    renderWithTheme(
      <EventFields
        event={{ ...manualEvent, kind: "PROPERTY_SALE", assetId: "home" }}
        properties={properties}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: /property/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^amount$/i)).not.toBeInTheDocument();
  });

  it("shows Direction and Amount for a MANUAL event", () => {
    renderWithTheme(
      <EventFields event={manualEvent} properties={properties} />,
    );
    expect(screen.getByText(/direction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^amount$/i)).toBeInTheDocument();
  });

  it("committing the property picker saves assetId", async () => {
    renderWithTheme(
      <EventFields
        event={{ ...manualEvent, kind: "PROPERTY_SALE", assetId: null }}
        properties={properties}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: /property/i }), {
      target: { value: "home" },
    });
    await waitFor(() =>
      expect(updatePlanEvent).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "PROPERTY_SALE", assetId: "home" }),
      ),
    );
  });

  it("shows a hint when there are no properties to sell", () => {
    renderWithTheme(
      <EventFields
        event={{ ...manualEvent, kind: "PROPERTY_SALE", assetId: null }}
        properties={[]}
      />,
    );
    expect(screen.getByText(/add a property first/i)).toBeInTheDocument();
  });

  it("does not offer Property sale as a Type option when there are no properties", () => {
    renderWithTheme(<EventFields event={manualEvent} properties={[]} />);
    const select = screen.getByRole("combobox", {
      name: /type/i,
    }) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["MANUAL"]);
    expect(updatePlanEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ assetId: null, kind: "PROPERTY_SALE" }),
    );
  });

  it("still shows the hint for an existing sale event when properties is empty", () => {
    renderWithTheme(
      <EventFields
        event={{ ...manualEvent, kind: "PROPERTY_SALE", assetId: "home" }}
        properties={[]}
      />,
    );
    expect(screen.getByText(/add a property first/i)).toBeInTheDocument();
  });
});

describe("EventsTable", () => {
  it("labels a property sale row with the property label instead of the amount", () => {
    renderWithTheme(
      <EventsTable
        events={[
          {
            id: "ev-1",
            label: "Downsize",
            age: 65,
            direction: "INFLOW",
            amount: 0,
            kind: "PROPERTY_SALE",
            assetId: "home",
          },
        ]}
        currency="GBP"
        numberFormat="COMMA_0"
        properties={properties}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByText(/sale of home/i)).toBeInTheDocument();
  });

  it("keeps the ± amount for a MANUAL row", () => {
    renderWithTheme(
      <EventsTable
        events={[manualEvent]}
        currency="GBP"
        numberFormat="COMMA_0"
        properties={properties}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByText(/−.*5,000/)).toBeInTheDocument();
  });
});
