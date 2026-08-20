// src/__tests__/marketing/FeatureShowcase.test.tsx

import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { FeatureShowcase } from "@/components/marketing/FeatureShowcase";
import { theme } from "@/lib/theme";

const baseProps = {
  eyebrow: "Budget",
  title: "Budget headline",
  body: "Budget body copy.",
  shot: { label: "Budget screenshot", alt: "Budget screenshot" },
};

const renderit = (props: Parameters<typeof FeatureShowcase>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <FeatureShowcase {...props} />
    </ThemeProvider>,
  );

describe("FeatureShowcase", () => {
  test("renders eyebrow, title, body", () => {
    renderit({ ...baseProps, imageSide: "left" });
    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Budget headline" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Budget body copy.")).toBeInTheDocument();
  });

  test("renders bullets when provided", () => {
    renderit({
      ...baseProps,
      imageSide: "left",
      bullets: [{ key: "Import", text: "Drop in a CSV." }],
    });
    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("Drop in a CSV.")).toBeInTheDocument();
  });

  test("imageSide=right puts the copy column first in DOM order", () => {
    const { container } = renderit({ ...baseProps, imageSide: "right" });
    const row = container.querySelector("section");
    const firstChild = row?.firstElementChild as HTMLElement;
    // copy column contains the heading
    expect(
      within(firstChild).getByRole("heading", { name: "Budget headline" }),
    ).toBeInTheDocument();
  });
});
