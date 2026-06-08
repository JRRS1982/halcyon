// src/__tests__/marketing/Footer.test.tsx
import { Footer } from "@/components/ui/Footer";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <Footer />
    </ThemeProvider>,
  );

describe("Footer", () => {
  test("renders on app pages", () => {
    mockPathname = "/dashboard";
    renderit();
    expect(screen.getByText(/privacy/i)).toBeInTheDocument();
  });

  test("hides itself on the landing page", () => {
    mockPathname = "/";
    const { container } = renderit();
    expect(container).toBeEmptyDOMElement();
  });
});
