import { render, screen } from "@testing-library/react";
import type { LegendPayload } from "recharts";
import { ChartLegend } from "@/app/(app)/dashboard/ChartLegend";

const payload: LegendPayload[] = [
  {
    value: "Income",
    type: "rect",
    color: "#1F8A4C",
    payload: {},
  },
  {
    value: "Net",
    type: "line",
    color: "#1E5BC6",
    payload: {},
  },
  {
    value: "Savings rate",
    type: "line",
    color: "#D97706",
    payload: { strokeDasharray: "4 4" },
  },
];

describe("ChartLegend", () => {
  test("renders one entry per series", () => {
    render(<ChartLegend payload={payload} />);
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
    expect(screen.getByText("Savings rate")).toBeInTheDocument();
  });

  test("bar series get a filled swatch in the series colour", () => {
    const { container } = render(<ChartLegend payload={payload} />);
    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#1F8A4C");
  });

  test("dashed series carry their dash pattern into the icon", () => {
    const { container } = render(<ChartLegend payload={payload} />);
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toHaveAttribute("stroke-dasharray");
    expect(lines[1]).toHaveAttribute("stroke-dasharray", "4 4");
  });

  test("renders nothing without a payload", () => {
    const { container } = render(<ChartLegend payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
