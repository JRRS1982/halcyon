// src/__tests__/marketing/SectionHeading.test.tsx

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { theme } from "@/lib/theme";

const renderit = (props: { eyebrow: string; title: string; lead?: string }) =>
  render(
    <ThemeProvider theme={theme}>
      <SectionHeading {...props} />
    </ThemeProvider>,
  );

describe("SectionHeading", () => {
  test("renders eyebrow, title and optional lead", () => {
    renderit({ eyebrow: "Features", title: "Big claim", lead: "Some lead." });
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Big claim" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Some lead.")).toBeInTheDocument();
  });

  test("omits the lead when not provided", () => {
    renderit({ eyebrow: "Features", title: "Big claim" });
    expect(screen.queryByText("Some lead.")).not.toBeInTheDocument();
  });
});
