/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/lib/theme";
import { MortgageBadge } from "./MortgageBadge";

describe("MortgageBadge", () => {
  it("renders its label", () => {
    render(
      <ThemeProvider theme={theme}>
        <MortgageBadge>Mortgage</MortgageBadge>
      </ThemeProvider>,
    );
    expect(screen.getByText("Mortgage")).toBeInTheDocument();
  });
});
