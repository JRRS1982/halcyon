# Balanced Money Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/` route with a public marketing/landing page for **Balanced Money** that educates visitors and demos the real features, faithful to `DESIGN.md`.

**Architecture:** A set of small, presentational styled-components under `src/components/marketing/`, composed by a pure `LandingPage` component. `src/app/page.tsx` becomes an auth-aware server component that redirects signed-in users to `/dashboard` and otherwise renders `<LandingPage />`. The globally-rendered `NavBar` gains a signed-out "Get started" pill + homepage-only anchor links and loses its redundant "Home" item; the global `Footer` hides itself on `/` so the richer `MarketingFooter` can take over. Product screenshots render through a `MarketingShot` component that shows a labelled placeholder until real captures are dropped into `public/marketing/`.

**Tech Stack:** Next.js 14 App Router (server + client components), TypeScript, styled-components (theme in `src/lib/theme.ts`, augmented in `src/types/styled.d.ts`), `next/image`, Jest + React Testing Library (unit), Playwright (e2e + screenshot capture). Spec: `docs/superpowers/specs/2026-06-07-balanced-landing-page-design.md`.

---

## Conventions (read once before starting)

- **Styled components pattern:** each component is a folder with `index.tsx` (the React component) + `Name.styled.ts` (the styled definitions). See `src/components/ui/Button/` and `src/components/ui/NavBar/` for the exact idiom: `styled.x\`${({ theme }) => css\`...\`}\``.
- **Theme tokens** (from `src/lib/theme.ts`): colours `primary, onPrimary, ink, inkSoft, body, bodyMuted, dim, hairline, hairlineStrong, canvas, canvasSoft, canvasDark, surfaceDarkSoft, onDark, bodyOnDark, accent`; typography `displayXl (28), displayLg (18), bodyMd (14), bodyMdStrong (14), monoCaps (11)`; spacing `xxs..5xl, section`; rounded `none, sm, full`. **There is no `bodySm` token — use `bodyMd` for body copy and `monoCaps` for labels.** Spacing keys with a leading digit are bracket-accessed: `theme.spacing["2xl"]`.
- **Test render helper:** components that consume the theme must be rendered inside `<ThemeProvider theme={theme}>`. Copy the `renderit` helper pattern from `src/__tests__/settings/DataPrivacy.test.tsx`.
- **Unit tests live in** `src/__tests__/marketing/` (Jest only scans `src/`).
- **Run a single test file:** `pnpm test -- --testPathPattern=marketing/Hero`
- **Commit after each task.** You are on branch `feat/landing-page`.

## File structure

Create:
- `src/components/marketing/SectionHeading/{index.tsx,SectionHeading.styled.ts}` — centred eyebrow + h2 + optional lead.
- `src/components/marketing/MarketingShot/{index.tsx,MarketingShot.styled.ts}` — 16:9 framed screenshot slot with placeholder fallback.
- `src/components/marketing/Hero/{index.tsx,Hero.styled.ts}` — hero (eyebrow, h1, lead, two CTAs, shot).
- `src/components/marketing/HowItWorks/{index.tsx,HowItWorks.styled.ts}` — the branched tree.
- `src/components/marketing/FeatureShowcase/{index.tsx,FeatureShowcase.styled.ts}` — reusable alternating image/copy row with optional bullet list.
- `src/components/marketing/DetailGrid/{index.tsx,DetailGrid.styled.ts}` — the "details that matter" 3×2 grid.
- `src/components/marketing/CtaBand/{index.tsx,CtaBand.styled.ts}` — dark closing CTA band.
- `src/components/marketing/MarketingFooter/{index.tsx,MarketingFooter.styled.ts}` — Product/Legal/brand footer.
- `src/components/marketing/LandingPage/index.tsx` — pure composition of all sections.
- `src/__tests__/marketing/*.test.tsx` — one test file per component above + the page redirect.
- `public/marketing/.gitkeep` — holds captured screenshots later.
- `scripts/capture-shots.mjs` — Playwright screenshot-capture helper (manual, local).
- `e2e/landing.spec.ts` — landing-page e2e smoke test.

Modify:
- `src/components/ui/NavBar/index.tsx` + `NavBar.styled.ts` — brand rename, Get-started pill, homepage anchor links, drop "Home".
- `src/components/ui/Footer/index.tsx` — return `null` on `/`.
- `src/app/layout.tsx` — metadata title/description → Balanced Money.
- `src/app/page.tsx` — auth gate + redirect + `<LandingPage />`.
- `README.md` — short note on capturing marketing screenshots (Task 16).

---

## Phase 1 — Branding & chrome

### Task 1: NavBar — brand rename, Get-started pill, homepage links, drop "Home"

**Files:**
- Modify: `src/components/ui/NavBar/NavBar.styled.ts`
- Modify: `src/components/ui/NavBar/index.tsx`
- Test: `src/__tests__/marketing/NavBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/NavBar.test.tsx
import { NavBar } from "@/components/ui/NavBar";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

let mockPathname = "/";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));
jest.mock("@/app/actions", () => ({ signOut: jest.fn() }));

const renderit = (props: { signedIn: boolean; transactionsEnabled: boolean }) =>
  render(
    <ThemeProvider theme={theme}>
      <NavBar {...props} />
    </ThemeProvider>,
  );

describe("NavBar", () => {
  test("brand reads 'Balanced Money'", () => {
    mockPathname = "/";
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(screen.getByText("Balanced Money")).toBeInTheDocument();
  });

  test("signed-out homepage shows marketing anchors + Get started", () => {
    mockPathname = "/";
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(screen.getByRole("link", { name: /how it works/i })).toHaveAttribute("href", "#how");
    expect(screen.getByRole("link", { name: /features/i })).toHaveAttribute("href", "#features");
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: /^sign in$/i })).toHaveAttribute("href", "/sign-in");
  });

  test("signed-out non-home hides anchors but keeps Get started", () => {
    mockPathname = "/sign-in";
    renderit({ signedIn: false, transactionsEnabled: false });
    expect(screen.queryByRole("link", { name: /how it works/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
  });

  test("signed-in shows app links without 'Home' and a Sign out button", () => {
    mockPathname = "/dashboard";
    renderit({ signedIn: true, transactionsEnabled: false });
    expect(screen.queryByRole("link", { name: /^home$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/NavBar`
Expected: FAIL — brand still "Halcyon", no "Get started" link, "Home" link present.

- [ ] **Step 3: Add the pill + right-group styled components**

Append to `src/components/ui/NavBar/NavBar.styled.ts`:

```ts
export const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const PillLink = styled(Link)`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    background: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    white-space: nowrap;
    text-decoration: none;
    transition: opacity 100ms;

    &:hover {
      opacity: 0.85;
    }
  `}
`;
```

- [ ] **Step 4: Rewrite `src/components/ui/NavBar/index.tsx`**

```tsx
"use client";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { usePathname } from "next/navigation";
import {
  Bar,
  Brand,
  Links,
  NavLink,
  PillLink,
  RightGroup,
  Spacer,
} from "./NavBar.styled";

type NavBarProps = {
  signedIn: boolean;
  transactionsEnabled: boolean;
};

type NavItem = { href: string; label: string };

// Signed-in app links. "Home" is intentionally absent: signed-in users are
// redirected away from "/" to "/dashboard", so a Home tab would only point at
// a redirect. Transactions is opt-in and slots in before Settings.
const SIGNED_IN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/budget", label: "Budget" },
  { href: "/balance", label: "Balance" },
  { href: "/settings", label: "Settings" },
];

const TRANSACTIONS_ITEM: NavItem = { href: "/transactions", label: "Transactions" };

// Homepage-only in-page anchors (the sections only exist on "/").
const MARKETING_ITEMS: NavItem[] = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#details", label: "Details" },
];

export function NavBar({ signedIn, transactionsEnabled }: NavBarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const items = transactionsEnabled
    ? [
        ...SIGNED_IN_ITEMS.slice(0, -1),
        TRANSACTIONS_ITEM,
        ...SIGNED_IN_ITEMS.slice(-1),
      ]
    : SIGNED_IN_ITEMS;

  return (
    <Bar>
      <Brand href="/">Balanced Money</Brand>

      {signedIn ? (
        <Links>
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} $active={pathname === item.href}>
              {item.label}
            </NavLink>
          ))}
        </Links>
      ) : isHome ? (
        <Links>
          {MARKETING_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} $active={false}>
              {item.label}
            </NavLink>
          ))}
        </Links>
      ) : null}

      <Spacer />

      {signedIn ? (
        <form action={signOut}>
          <Button type="submit">Sign out</Button>
        </form>
      ) : (
        <RightGroup>
          <NavLink href="/sign-in" $active={pathname === "/sign-in"}>
            Sign in
          </NavLink>
          <PillLink href="/sign-up">Get started</PillLink>
        </RightGroup>
      )}
    </Bar>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/NavBar`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/NavBar/ src/__tests__/marketing/NavBar.test.tsx
git commit -m "feat(nav): Balanced Money brand, Get-started pill, homepage anchors"
```

---

### Task 2: Footer hides on the landing page

**Files:**
- Modify: `src/components/ui/Footer/index.tsx`
- Test: `src/__tests__/marketing/Footer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/Footer`
Expected: FAIL — Footer renders its links on `/`.

- [ ] **Step 3: Add the pathname guard**

Rewrite `src/components/ui/Footer/index.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Copy, FooterBar, FooterLink } from "./Footer.styled";

export function Footer() {
  const pathname = usePathname();
  // The landing page ("/") supplies its own MarketingFooter, so the global
  // footer steps aside there to avoid a double footer.
  if (pathname === "/") return null;

  return (
    <FooterBar>
      <Copy>Balanced Money</Copy>
      <FooterLink href="/privacy">Privacy</FooterLink>
      <FooterLink href="/terms">Terms</FooterLink>
    </FooterBar>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/Footer`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Footer/index.tsx src/__tests__/marketing/Footer.test.tsx
git commit -m "feat(footer): hide global footer on landing page; rebrand copy"
```

---

### Task 3: Layout metadata → Balanced Money

**Files:**
- Modify: `src/app/layout.tsx:12-15`

- [ ] **Step 1: Edit metadata**

Replace the `metadata` export in `src/app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "Balanced Money",
  description: "Personal finance, made clear. Track what you have, understand where it goes.",
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "chore(meta): set site title/description to Balanced Money"
```

---

## Phase 2 — Marketing primitives

### Task 4: SectionHeading

**Files:**
- Create: `src/components/marketing/SectionHeading/SectionHeading.styled.ts`
- Create: `src/components/marketing/SectionHeading/index.tsx`
- Test: `src/__tests__/marketing/SectionHeading.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/SectionHeading.test.tsx
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

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
    expect(screen.getByRole("heading", { name: "Big claim" })).toBeInTheDocument();
    expect(screen.getByText("Some lead.")).toBeInTheDocument();
  });

  test("omits the lead when not provided", () => {
    renderit({ eyebrow: "Features", title: "Big claim" });
    expect(screen.queryByText("Some lead.")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/SectionHeading`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/SectionHeading/SectionHeading.styled.ts`:

```ts
import styled, { css } from "styled-components";

export const Wrap = styled.div`
  max-width: 62ch;
  margin: 0 auto;
  text-align: center;
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    margin: 0;
  `}
`;

export const Title = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-size: ${theme.typography.displayXl.size};
    font-weight: ${theme.typography.displayXl.weight};
    line-height: ${theme.typography.displayXl.lineHeight};
    letter-spacing: ${theme.typography.displayXl.letterSpacing};
    color: ${theme.colors.ink};
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const Lead = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.md} auto 0;
  `}
`;
```

`src/components/marketing/SectionHeading/index.tsx`:

```tsx
import { Eyebrow, Lead, Title, Wrap } from "./SectionHeading.styled";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  lead?: string;
};

export function SectionHeading({ eyebrow, title, lead }: SectionHeadingProps) {
  return (
    <Wrap>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      {lead ? <Lead>{lead}</Lead> : null}
    </Wrap>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/SectionHeading`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/SectionHeading/ src/__tests__/marketing/SectionHeading.test.tsx
git commit -m "feat(marketing): SectionHeading primitive"
```

---

### Task 5: MarketingShot (16:9 screenshot slot with placeholder)

**Files:**
- Create: `src/components/marketing/MarketingShot/MarketingShot.styled.ts`
- Create: `src/components/marketing/MarketingShot/index.tsx`
- Test: `src/__tests__/marketing/MarketingShot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/MarketingShot.test.tsx
import { MarketingShot } from "@/components/marketing/MarketingShot";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = (props: Parameters<typeof MarketingShot>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <MarketingShot {...props} />
    </ThemeProvider>,
  );

describe("MarketingShot", () => {
  test("shows a labelled placeholder when no src is given", () => {
    renderit({ label: "Dashboard", caption: "Four charts", alt: "Dashboard" });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Four charts")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("renders an image with alt text when src is given", () => {
    renderit({ src: "/marketing/dashboard.png", label: "Dashboard", alt: "Balanced dashboard" });
    expect(screen.getByRole("img", { name: "Balanced dashboard" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/MarketingShot`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/MarketingShot/MarketingShot.styled.ts`:

```ts
import styled, { css } from "styled-components";

export const Frame = styled.div`
  ${({ theme }) => css`
    position: relative;
    aspect-ratio: 16 / 9;
    width: 100%;
    background: ${theme.colors.canvasSoft};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    overflow: hidden;
  `}
`;

export const Placeholder = styled.div`
  ${({ theme }) => css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing.sm};
    text-align: center;
    padding: 0 ${theme.spacing.lg};
  `}
`;

export const Label = styled.span`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
  `}
`;

export const Caption = styled.span`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    color: ${theme.colors.dim};
  `}
`;
```

`src/components/marketing/MarketingShot/index.tsx`:

```tsx
import Image from "next/image";
import { Caption, Frame, Label, Placeholder } from "./MarketingShot.styled";

type MarketingShotProps = {
  /** Public path e.g. "/marketing/dashboard.png". Omit to show a placeholder. */
  src?: string;
  /** Alt text for the captured screenshot. */
  alt: string;
  /** Mono-caps label shown in the placeholder. */
  label: string;
  /** Optional supporting line in the placeholder. */
  caption?: string;
};

export function MarketingShot({ src, alt, label, caption }: MarketingShotProps) {
  return (
    <Frame>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(max-width: 760px) 100vw, 50vw" style={{ objectFit: "cover" }} />
      ) : (
        <Placeholder>
          <Label>{label}</Label>
          {caption ? <Caption>{caption}</Caption> : null}
        </Placeholder>
      )}
    </Frame>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/MarketingShot`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/MarketingShot/ src/__tests__/marketing/MarketingShot.test.tsx
git commit -m "feat(marketing): MarketingShot 16:9 slot with placeholder"
```

---

## Phase 3 — Marketing sections

### Task 6: Hero

**Files:**
- Create: `src/components/marketing/Hero/Hero.styled.ts`
- Create: `src/components/marketing/Hero/index.tsx`
- Test: `src/__tests__/marketing/Hero.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/Hero.test.tsx
import { Hero } from "@/components/marketing/Hero";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <Hero />
    </ThemeProvider>,
  );

describe("Hero", () => {
  test("renders the headline as the page h1", () => {
    renderit();
    expect(
      screen.getByRole("heading", { level: 1, name: /make sense of your money/i }),
    ).toBeInTheDocument();
  });

  test("renders both CTAs pointing at sign-up and sign-in", () => {
    renderit();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/Hero`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/Hero/Hero.styled.ts`:

```ts
import Link from "next/link";
import styled, { css } from "styled-components";

export const Section = styled.section`
  padding: ${({ theme }) => `${theme.spacing.section} 0`};
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: ${({ theme }) => theme.spacing.section};
  align-items: center;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing["3xl"]};
  }
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    margin: 0;
  `}
`;

export const Title = styled.h1`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-size: ${theme.typography.displayXl.size};
    font-weight: ${theme.typography.displayXl.weight};
    line-height: ${theme.typography.displayXl.lineHeight};
    letter-spacing: ${theme.typography.displayXl.letterSpacing};
    color: ${theme.colors.ink};
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const Lead = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    max-width: 50ch;
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const CtaRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing["3xl"]};
`;

const buttonBase = css`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    white-space: nowrap;
    text-decoration: none;
  `}
`;

export const PrimaryLink = styled(Link)`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
`;

export const OutlineLink = styled(Link)`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.canvas};
  color: ${({ theme }) => theme.colors.ink};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
`;
```

`src/components/marketing/Hero/index.tsx`:

```tsx
import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  CtaRow,
  Eyebrow,
  Grid,
  Lead,
  OutlineLink,
  PrimaryLink,
  Section,
  Title,
} from "./Hero.styled";

export function Hero() {
  return (
    <Section>
      <Grid>
        <div>
          <Eyebrow>Personal finance, made clear</Eyebrow>
          <Title>Make sense of your money.</Title>
          <Lead>
            Balanced takes the place of the messy spreadsheet you&apos;ve been
            meaning to keep. It gives you the structure — and the gentle guidance
            — to track what you have, understand where it goes, and learn how you
            really spend.
          </Lead>
          <CtaRow>
            <PrimaryLink href="/sign-up">Get started</PrimaryLink>
            <OutlineLink href="/sign-in">Sign in</OutlineLink>
          </CtaRow>
        </div>
        <MarketingShot
          label="Dashboard"
          caption="Spending by category, cash flow, balance trend, net worth — at a glance"
          alt="The Balanced dashboard showing spending and net-worth charts"
        />
      </Grid>
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/Hero`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/Hero/ src/__tests__/marketing/Hero.test.tsx
git commit -m "feat(marketing): Hero section"
```

---

### Task 7: HowItWorks (branched tree)

**Files:**
- Create: `src/components/marketing/HowItWorks/HowItWorks.styled.ts`
- Create: `src/components/marketing/HowItWorks/index.tsx`
- Test: `src/__tests__/marketing/HowItWorks.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/HowItWorks.test.tsx
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <HowItWorks />
    </ThemeProvider>,
  );

describe("HowItWorks", () => {
  test("has a #how anchor for the nav link", () => {
    const { container } = renderit();
    expect(container.querySelector("#how")).toBeInTheDocument();
  });

  test("renders both paths and the converge step", () => {
    renderit();
    expect(screen.getByText(/let your statements do the work/i)).toBeInTheDocument();
    expect(screen.getByText(/type the figures in yourself/i)).toBeInTheDocument();
    expect(screen.getByText(/see where you stand/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/HowItWorks`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/HowItWorks/HowItWorks.styled.ts`:

```ts
import styled, { css } from "styled-components";

export const Section = styled.section`
  padding: ${({ theme }) => `${theme.spacing.section} 0`};
`;

export const Tree = styled.div`
  margin-top: ${({ theme }) => theme.spacing["4xl"]};
  text-align: center;
`;

export const Node = styled.div<{ $solid?: boolean }>`
  ${({ theme, $solid }) => css`
    display: inline-block;
    text-align: left;
    max-width: 480px;
    border: 1px solid ${$solid ? theme.colors.canvasDark : theme.colors.hairline};
    background: ${$solid ? theme.colors.canvasDark : theme.colors.canvas};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.lg} ${theme.spacing.xl};
  `}
`;

export const NodeKey = styled.p<{ $onDark?: boolean }>`
  ${({ theme, $onDark }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${$onDark ? theme.colors.onDark : theme.colors.ink};
    margin: 0;
  `}
`;

export const NodeText = styled.p<{ $onDark?: boolean }>`
  ${({ theme, $onDark }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${$onDark ? theme.colors.bodyOnDark : theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const Stem = styled.div`
  width: 1px;
  height: ${({ theme }) => theme.spacing["2xl"]};
  background: ${({ theme }) => theme.colors.hairlineStrong};
  margin: 0 auto;
`;

export const Fork = styled.div`
  ${({ theme }) => css`
    width: 62%;
    height: ${theme.spacing["2xl"]};
    border-top: 1px solid ${theme.colors.hairlineStrong};
    border-left: 1px solid ${theme.colors.hairlineStrong};
    border-right: 1px solid ${theme.colors.hairlineStrong};
    margin: 0 auto;

    @media (max-width: 760px) {
      display: none;
    }
  `}
`;

export const Merge = styled.div`
  ${({ theme }) => css`
    width: 62%;
    height: ${theme.spacing["2xl"]};
    border-bottom: 1px solid ${theme.colors.hairlineStrong};
    border-left: 1px solid ${theme.colors.hairlineStrong};
    border-right: 1px solid ${theme.colors.hairlineStrong};
    margin: 0 auto;

    @media (max-width: 760px) {
      display: none;
    }
  `}
`;

export const Branch = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing["4xl"]};
  width: 62%;
  margin: 0 auto;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    width: 100%;
  }
`;

export const BranchCard = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.xl};
    text-align: left;
  `}
`;

export const Badge = styled.span<{ $accent?: boolean }>`
  ${({ theme, $accent }) => css`
    display: inline-block;
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${$accent ? theme.colors.accent : theme.colors.ink};
    border: 1px solid ${$accent ? theme.colors.accent : theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.xxs} ${theme.spacing.sm};
    margin-bottom: ${theme.spacing.sm};
  `}
`;

export const BranchTitle = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-size: ${theme.typography.displayLg.size};
    font-weight: ${theme.typography.displayLg.weight};
    line-height: ${theme.typography.displayLg.lineHeight};
    letter-spacing: ${theme.typography.displayLg.letterSpacing};
    color: ${theme.colors.ink};
    margin: 0;
  `}
`;

export const BranchText = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;
```

`src/components/marketing/HowItWorks/index.tsx`:

```tsx
import { SectionHeading } from "@/components/marketing/SectionHeading";
import {
  Badge,
  Branch,
  BranchCard,
  BranchText,
  BranchTitle,
  Fork,
  Merge,
  Node,
  NodeKey,
  NodeText,
  Section,
  Stem,
  Tree,
} from "./HowItWorks.styled";

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading
        eyebrow="How it works"
        title="One simple path. You pick how hands-on."
        lead="Set things up once, then choose how your numbers get in. Balanced guides you either way — and you can switch whenever you like."
      />
      <Tree>
        <Node>
          <NodeKey>Step 1 · Set up</NodeKey>
          <NodeText>
            Add your accounts and the categories that match how you actually
            spend. Balanced suggests a sensible starting set.
          </NodeText>
        </Node>
        <Stem />
        <Node>
          <NodeKey>Step 2 · Enter your values — two ways</NodeKey>
          <NodeText>
            Choose the approach that suits you. Both fill in the same budget and
            balance, so the rest of the app just works.
          </NodeText>
        </Node>
        <Stem />
        <Fork />
        <Branch>
          <BranchCard>
            <Badge $accent>Option A · Transactions on</Badge>
            <BranchTitle>Let your statements do the work</BranchTitle>
            <BranchText>
              Import a bank statement and Balanced sorts every transaction into
              categories, then fills your budget actuals and balances for you.
              &ldquo;Where did it all go?&rdquo; answers itself.
            </BranchText>
          </BranchCard>
          <BranchCard>
            <Badge>Option B · Manual</Badge>
            <BranchTitle>Type the figures in yourself</BranchTitle>
            <BranchText>
              Prefer to stay hands-on, or not connect a bank? Enter your numbers
              straight into the budget and balance sheets. No imports — just a
              clean, guided place to keep them.
            </BranchText>
          </BranchCard>
        </Branch>
        <Merge />
        <Stem />
        <Node $solid>
          <NodeKey $onDark>Step 3 · See where you stand</NodeKey>
          <NodeText $onDark>
            Either way, the same dashboard lights up: your spending breakdown,
            cash flow, budget variance and net worth — all kept up to date for
            you.
          </NodeText>
        </Node>
      </Tree>
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/HowItWorks`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/HowItWorks/ src/__tests__/marketing/HowItWorks.test.tsx
git commit -m "feat(marketing): HowItWorks branched-tree section"
```

---

### Task 8: FeatureShowcase (reusable alternating row)

**Files:**
- Create: `src/components/marketing/FeatureShowcase/FeatureShowcase.styled.ts`
- Create: `src/components/marketing/FeatureShowcase/index.tsx`
- Test: `src/__tests__/marketing/FeatureShowcase.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/FeatureShowcase.test.tsx
import { FeatureShowcase } from "@/components/marketing/FeatureShowcase";
import { theme } from "@/lib/theme";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const baseProps = {
  eyebrow: "Budget",
  title: "Budget headline",
  body: "Budget body copy.",
  shot: { label: "Budget", alt: "Budget screenshot" },
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
    expect(screen.getByRole("heading", { name: "Budget headline" })).toBeInTheDocument();
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
    expect(within(firstChild).getByRole("heading", { name: "Budget headline" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/FeatureShowcase`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/FeatureShowcase/FeatureShowcase.styled.ts`:

```ts
import styled, { css } from "styled-components";

export const Row = styled.section`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.section};
  align-items: center;
  padding: ${({ theme }) => `${theme.spacing["5xl"]} 0`};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing["3xl"]};
  }
`;

export const Copy = styled.div`
  max-width: 44ch;
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    margin: 0;
  `}
`;

export const Title = styled.h3`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayLg.family};
    font-size: ${theme.typography.displayLg.size};
    font-weight: ${theme.typography.displayLg.weight};
    line-height: ${theme.typography.displayLg.lineHeight};
    letter-spacing: ${theme.typography.displayLg.letterSpacing};
    color: ${theme.colors.ink};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const Body = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const BulletList = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.spacing.lg} 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const Bullet = styled.li`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
  `}
`;

export const BulletKey = styled.span`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.ink};
    margin-right: ${theme.spacing.sm};
  `}
`;
```

`src/components/marketing/FeatureShowcase/index.tsx`:

```tsx
import { MarketingShot } from "@/components/marketing/MarketingShot";
import {
  Body,
  Bullet,
  BulletKey,
  BulletList,
  Copy,
  Eyebrow,
  Row,
  Title,
} from "./FeatureShowcase.styled";

type Bullet = { key: string; text: string };

type Shot = { src?: string; alt: string; label: string; caption?: string };

type FeatureShowcaseProps = {
  eyebrow: string;
  title: string;
  body: string;
  shot: Shot;
  imageSide: "left" | "right";
  bullets?: Bullet[];
};

export function FeatureShowcase({
  eyebrow,
  title,
  body,
  shot,
  imageSide,
  bullets,
}: FeatureShowcaseProps) {
  const copy = (
    <Copy>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <Body>{body}</Body>
      {bullets && bullets.length > 0 ? (
        <BulletList>
          {bullets.map((b) => (
            <Bullet key={b.key}>
              <BulletKey>{b.key}</BulletKey>
              {b.text}
            </Bullet>
          ))}
        </BulletList>
      ) : null}
    </Copy>
  );

  const image = <MarketingShot {...shot} />;

  return (
    <Row>
      {imageSide === "left" ? (
        <>
          {image}
          {copy}
        </>
      ) : (
        <>
          {copy}
          {image}
        </>
      )}
    </Row>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/FeatureShowcase`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/FeatureShowcase/ src/__tests__/marketing/FeatureShowcase.test.tsx
git commit -m "feat(marketing): reusable FeatureShowcase row"
```

---

### Task 9: DetailGrid

**Files:**
- Create: `src/components/marketing/DetailGrid/DetailGrid.styled.ts`
- Create: `src/components/marketing/DetailGrid/index.tsx`
- Test: `src/__tests__/marketing/DetailGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/DetailGrid.test.tsx
import { DetailGrid } from "@/components/marketing/DetailGrid";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <DetailGrid />
    </ThemeProvider>,
  );

describe("DetailGrid", () => {
  test("has a #details anchor", () => {
    const { container } = renderit();
    expect(container.querySelector("#details")).toBeInTheDocument();
  });

  test("renders the six detail items including transfers and live-sync", () => {
    renderit();
    expect(screen.getByText("Transfers aren't spending")).toBeInTheDocument();
    expect(screen.getByText("Live & in sync")).toBeInTheDocument();
    expect(screen.getByText("Your data, yours")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/DetailGrid`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/DetailGrid/DetailGrid.styled.ts`:

```ts
import styled, { css } from "styled-components";

export const Section = styled.section`
  ${({ theme }) => css`
    background: ${theme.colors.canvasSoft};
    border-top: 1px solid ${theme.colors.hairline};
    border-bottom: 1px solid ${theme.colors.hairline};
    padding: ${theme.spacing.section} 0;
  `}
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: ${({ theme }) => theme.colors.hairline};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  overflow: hidden;
  margin-top: ${({ theme }) => theme.spacing["4xl"]};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

export const Cell = styled.div`
  background: ${({ theme }) => theme.colors.canvas};
  padding: ${({ theme }) => `${theme.spacing.xl} ${theme.spacing.lg}`};
`;

export const Key = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.ink};
    margin: 0;
  `}
`;

export const Text = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    margin: ${theme.spacing.sm} 0 0;
  `}
`;
```

`src/components/marketing/DetailGrid/index.tsx`:

```tsx
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Cell, Grid, Key, Section, Text } from "./DetailGrid.styled";

const DETAILS: { key: string; text: string }[] = [
  {
    key: "Transfers aren't spending",
    text: "Move money between your own accounts and Balanced treats it as a transfer, not spending — so your expenditure stays honest and you don't look poorer or richer than you are.",
  },
  {
    key: "Live & in sync",
    text: 'Edit or import a transaction and every chart, total and budget recalculates instantly — no refresh, no stale numbers, no "recalculate" button.',
  },
  {
    key: "Duplicate-safe imports",
    text: "Re-import an overlapping statement and Balanced spots the rows you already have, so nothing gets counted twice.",
  },
  {
    key: "Reversible imports",
    text: "Imported the wrong file? Undo the entire import in one action — the ledger snaps back to exactly where it was.",
  },
  {
    key: "Notes & original detail",
    text: "Add a note to any transaction and keep the original statement details beside the tidy, categorised version.",
  },
  {
    key: "Your data, yours",
    text: "Export everything to a file, clear your data, or delete your account outright — no dark patterns, no hostage-taking.",
  },
];

export function DetailGrid() {
  return (
    <Section id="details">
      <SectionHeading
        eyebrow="The details"
        title="It's the small things that make it tick."
        lead='The thoughtful touches that turn "a place to type numbers" into something that actually tells the truth about your money.'
      />
      <Grid>
        {DETAILS.map((d) => (
          <Cell key={d.key}>
            <Key>{d.key}</Key>
            <Text>{d.text}</Text>
          </Cell>
        ))}
      </Grid>
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/DetailGrid`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/DetailGrid/ src/__tests__/marketing/DetailGrid.test.tsx
git commit -m "feat(marketing): DetailGrid section"
```

---

### Task 10: CtaBand

**Files:**
- Create: `src/components/marketing/CtaBand/CtaBand.styled.ts`
- Create: `src/components/marketing/CtaBand/index.tsx`
- Test: `src/__tests__/marketing/CtaBand.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/CtaBand.test.tsx
import { CtaBand } from "@/components/marketing/CtaBand";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <CtaBand />
    </ThemeProvider>,
  );

describe("CtaBand", () => {
  test("renders the closing headline and a Get started link to sign-up", () => {
    renderit();
    expect(screen.getByRole("heading", { name: /put the spreadsheet down/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/CtaBand`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/CtaBand/CtaBand.styled.ts`:

```ts
import Link from "next/link";
import styled, { css } from "styled-components";

export const Band = styled.section`
  ${({ theme }) => css`
    background: ${theme.colors.canvasDark};
    color: ${theme.colors.onDark};
    text-align: center;
    padding: ${theme.spacing.section} 0;
  `}
`;

export const Eyebrow = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.bodyOnDark};
    margin: 0;
  `}
`;

export const Title = styled.h2`
  ${({ theme }) => css`
    font-family: ${theme.typography.displayXl.family};
    font-size: ${theme.typography.displayXl.size};
    font-weight: ${theme.typography.displayXl.weight};
    line-height: ${theme.typography.displayXl.lineHeight};
    letter-spacing: ${theme.typography.displayXl.letterSpacing};
    color: ${theme.colors.onDark};
    margin: ${theme.spacing.md} 0 0;
  `}
`;

export const Text = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.bodyOnDark};
    max-width: 48ch;
    margin: ${theme.spacing.md} auto 0;
  `}
`;

// On the dark band the primary CTA inverts to a white fill / ink text — the
// only place this inversion occurs (see DESIGN.md §6).
export const InvertedCta = styled(Link)`
  ${({ theme }) => css`
    display: inline-block;
    margin-top: ${theme.spacing["3xl"]};
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    background: ${theme.colors.canvas};
    color: ${theme.colors.ink};
    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    text-decoration: none;
    white-space: nowrap;
  `}
`;
```

`src/components/marketing/CtaBand/index.tsx`:

```tsx
import { Band, Eyebrow, InvertedCta, Text, Title } from "./CtaBand.styled";

export function CtaBand() {
  return (
    <Band>
      <Eyebrow>Get started</Eyebrow>
      <Title>Put the spreadsheet down.</Title>
      <Text>
        Create a free account and let Balanced give your money the structure
        it&apos;s been missing — and guide you to what matters.
      </Text>
      <InvertedCta href="/sign-up">Get started</InvertedCta>
    </Band>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/CtaBand`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/CtaBand/ src/__tests__/marketing/CtaBand.test.tsx
git commit -m "feat(marketing): closing CtaBand"
```

---

### Task 11: MarketingFooter

**Files:**
- Create: `src/components/marketing/MarketingFooter/MarketingFooter.styled.ts`
- Create: `src/components/marketing/MarketingFooter/index.tsx`
- Test: `src/__tests__/marketing/MarketingFooter.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/MarketingFooter.test.tsx
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <MarketingFooter />
    </ThemeProvider>,
  );

describe("MarketingFooter", () => {
  test("renders brand and legal links", () => {
    renderit();
    expect(screen.getByText("Balanced Money")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /terms of service/i })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /data privacy/i })).toHaveAttribute("href", "/privacy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/MarketingFooter`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement styled + component**

`src/components/marketing/MarketingFooter/MarketingFooter.styled.ts`:

```ts
import Link from "next/link";
import styled, { css } from "styled-components";

export const Foot = styled.footer`
  ${({ theme }) => css`
    background: ${theme.colors.canvas};
    border-top: 1px solid ${theme.colors.hairline};
    padding: ${theme.spacing.section} 0;
  `}
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: ${({ theme }) => theme.spacing["4xl"]};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing["3xl"]};
  }
`;

export const Brand = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.ink};
    margin: 0;
  `}
`;

export const Blurb = styled.p`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
    max-width: 30ch;
    margin: ${theme.spacing.sm} 0 0;
  `}
`;

export const ColTitle = styled.h4`
  ${({ theme }) => css`
    font-family: ${theme.typography.monoCaps.family};
    font-size: ${theme.typography.monoCaps.size};
    font-weight: ${theme.typography.monoCaps.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.monoCaps.letterSpacing};
    color: ${theme.colors.body};
    margin: 0 0 ${theme.spacing.md};
  `}
`;

export const FootLink = styled(Link)`
  ${({ theme }) => css`
    display: block;
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    color: ${theme.colors.ink};
    text-decoration: none;
    margin-bottom: ${theme.spacing.sm};
  `}
`;
```

`src/components/marketing/MarketingFooter/index.tsx`:

```tsx
import {
  Blurb,
  Brand,
  ColTitle,
  Foot,
  FootLink,
  Grid,
} from "./MarketingFooter.styled";

export function MarketingFooter() {
  return (
    <Foot>
      <Grid>
        <div>
          <Brand>Balanced Money</Brand>
          <Blurb>
            Personal finance, made clear. Track what you have, understand where
            it goes.
          </Blurb>
        </div>
        <div>
          <ColTitle>Product</ColTitle>
          <FootLink href="#how">How it works</FootLink>
          <FootLink href="#features">Features</FootLink>
          <FootLink href="#details">Details</FootLink>
        </div>
        <div>
          <ColTitle>Legal</ColTitle>
          <FootLink href="/terms">Terms of Service</FootLink>
          <FootLink href="/privacy">Data Privacy</FootLink>
        </div>
      </Grid>
    </Foot>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/MarketingFooter`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/MarketingFooter/ src/__tests__/marketing/MarketingFooter.test.tsx
git commit -m "feat(marketing): MarketingFooter"
```

---

## Phase 4 — Compose & route

### Task 12: LandingPage composition

**Files:**
- Create: `src/components/marketing/LandingPage/index.tsx`
- Create: `src/components/marketing/LandingPage/LandingPage.styled.ts`
- Test: `src/__tests__/marketing/LandingPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/LandingPage.test.tsx
import { LandingPage } from "@/components/marketing/LandingPage";
import { theme } from "@/lib/theme";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const renderit = () =>
  render(
    <ThemeProvider theme={theme}>
      <LandingPage />
    </ThemeProvider>,
  );

describe("LandingPage", () => {
  test("composes hero, how-it-works, features, details and CTA", () => {
    renderit();
    expect(screen.getByRole("heading", { level: 1, name: /make sense of your money/i })).toBeInTheDocument();
    expect(screen.getByText(/let your statements do the work/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /budget — then learn how you really spend/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /wealthy, or just spending/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /turn a bank statement into understanding/i })).toBeInTheDocument();
    expect(screen.getByText("Transfers aren't spending")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /put the spreadsheet down/i })).toBeInTheDocument();
  });

  test("features intro carries the #features anchor", () => {
    const { container } = renderit();
    expect(container.querySelector("#features")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/LandingPage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the composition**

`src/components/marketing/LandingPage/LandingPage.styled.ts`:

```ts
import styled from "styled-components";

// Constrains the in-flow sections to the 1240px container with page gutters.
// Full-bleed sections (DetailGrid band, CtaBand) render their own background
// edge-to-edge and place a Container inside themselves where needed.
export const Container = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 760px) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

export const FeaturesIntro = styled.section`
  padding: ${({ theme }) => `${theme.spacing.section} 0 0`};
`;
```

`src/components/marketing/LandingPage/index.tsx`:

```tsx
import { CtaBand } from "@/components/marketing/CtaBand";
import { DetailGrid } from "@/components/marketing/DetailGrid";
import { FeatureShowcase } from "@/components/marketing/FeatureShowcase";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Container, FeaturesIntro } from "./LandingPage.styled";

export function LandingPage() {
  return (
    <main>
      <Container>
        <Hero />
        <HowItWorks />

        <FeaturesIntro id="features">
          <SectionHeading
            eyebrow="Features"
            title="Structure where you'd otherwise wing it."
            lead="No more rolling your own tabs and formulas. Balanced gives every part of your money a proper home — and guides you to what actually matters."
          />
        </FeaturesIntro>

        <FeatureShowcase
          imageSide="left"
          eyebrow="Budget"
          title="Budget — then learn how you really spend."
          body="Set a budget for each category, then watch your categorised spending fill in beside it. The gap between the plan and the reality is the lesson: Balanced makes it impossible to ignore where your money is actually going."
          shot={{
            label: "Budget",
            alt: "The Balanced budget sheet showing budgeted vs actual by category",
            caption: "Budgeted vs. actual by category, once spending is sorted",
          }}
        />
        <FeatureShowcase
          imageSide="right"
          eyebrow="Balance"
          title="Wealthy, or just spending?"
          body="Your bank balance lies. Big pension contributions can leave you feeling broke while your net worth quietly climbs; a month of treats can feel rich while your assets go nowhere. Balanced sorts what you own and owe across short, medium and long-term horizons — so you can see whether you're truly getting ahead, and think past this month."
          shot={{
            label: "Balance",
            alt: "The Balanced balance sheet showing assets and liabilities by term",
            caption: "Assets & liabilities by short / medium / long term → net worth",
          }}
        />
        <FeatureShowcase
          imageSide="left"
          eyebrow="Transactions"
          title="Turn a bank statement into understanding."
          body="This is where Balanced earns its keep. Switch transactions on, drop in a statement, and a wall of cryptic bank rows becomes a clear, categorised picture of your month — and from there, every chart, budget and balance fills itself in."
          bullets={[
            { key: "Import", text: "Drop in a CSV statement and Balanced maps the columns for you." },
            { key: "Auto-sort", text: "Each transaction lands in the right category, ready to review." },
            { key: "Bulk edits", text: "Re-categorise or clear dozens of rows in one go — no row-by-row slog." },
            { key: "Safe by default", text: "Duplicate-aware on import, and any import can be reversed in one click." },
          ]}
          shot={{
            label: "Transactions",
            alt: "The Balanced transactions ledger with an imported statement sorted into categories",
            caption: "An imported statement, sorted into categories in the ledger",
          }}
        />
      </Container>

      <DetailGrid />
      <CtaBand />
      <MarketingFooter />
    </main>
  );
}
```

> Note: `DetailGrid`, `CtaBand` and `MarketingFooter` render their own full-bleed backgrounds, so they sit outside the `Container`. Their inner content currently spans the full width; if you want them capped at 1240px, wrap their children in `Container` inside those components in a follow-up — not required for this plan.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/LandingPage`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/LandingPage/ src/__tests__/marketing/LandingPage.test.tsx
git commit -m "feat(marketing): compose LandingPage"
```

---

### Task 13: Wire `/` — redirect signed-in users, render LandingPage

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/__tests__/marketing/home-route.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/marketing/home-route.test.tsx
import Home from "@/app/page";
import { theme } from "@/lib/theme";
import { render } from "@testing-library/react";
import { ThemeProvider } from "styled-components";

const getUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
const redirect = jest.fn();
jest.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

describe("Home route", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockReset();
  });

  test("renders the landing page for signed-out visitors", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const ui = await Home();
    const { getByRole } = render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
    expect(getByRole("heading", { level: 1, name: /make sense of your money/i })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects signed-in visitors to /dashboard", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await Home();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --testPathPattern=marketing/home-route`
Expected: FAIL — current `page.tsx` renders placeholder copy, no redirect.

- [ ] **Step 3: Rewrite `src/app/page.tsx`**

```tsx
import { LandingPage } from "@/components/marketing/LandingPage";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in users have full app nav; the marketing page is for prospects.
  if (user) redirect("/dashboard");

  return <LandingPage />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --testPathPattern=marketing/home-route`
Expected: PASS (2 tests).

- [ ] **Step 5: Full unit suite + typecheck**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck clean; all unit tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/__tests__/marketing/home-route.test.tsx
git commit -m "feat(home): redirect signed-in users; render Balanced landing page"
```

---

## Phase 5 — Screenshots & e2e

### Task 14: e2e smoke test for the landing page

**Files:**
- Create: `e2e/landing.spec.ts`

- [ ] **Step 1: Write the e2e test**

```ts
// e2e/landing.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("an unauthenticated visitor sees the marketing page", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /make sense of your money/i }),
    ).toBeVisible();
    // Both hero CTAs present
    await expect(page.getByRole("link", { name: /get started/i }).first()).toBeVisible();
  });

  test("Get started navigates to sign-up", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).first().click();
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("nav anchor scrolls to How it works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /how it works/i }).click();
    await expect(page).toHaveURL(/#how/);
    await expect(page.locator("#how")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `pnpm test:e2e -- landing`
Expected: PASS. (Playwright boots its own Next dev server on :3100 with the mock Supabase auth, so the visitor is unauthenticated by default — no redirect.)

- [ ] **Step 3: Commit**

```bash
git add e2e/landing.spec.ts
git commit -m "test(e2e): landing page smoke test"
```

---

### Task 15: Screenshot capture script + wiring (manual, local)

> Real screenshots depend on a **seeded local app** (the 18-month demo data) and a signed-in browser session. This task adds a repeatable Playwright capture script and wires the images in. The capture step is run **locally by hand** (not in CI). Until images exist, `MarketingShot` placeholders render — so the page already works without this task.

**Files:**
- Create: `public/marketing/.gitkeep`
- Create: `scripts/capture-shots.mjs`
- Modify: `src/components/marketing/Hero/index.tsx` (add `src`)
- Modify: `src/components/marketing/LandingPage/index.tsx` (add `src` to the three shots)

- [ ] **Step 1: Create the capture directory**

```bash
mkdir -p public/marketing && touch public/marketing/.gitkeep
```

- [ ] **Step 2: Add the capture script**

`scripts/capture-shots.mjs`:

```js
// Capture marketing screenshots from a LOCAL, SEEDED, SIGNED-IN app.
//
// Prerequisites (all local — never against production):
//   1. Local DB seeded with demo data:  make db-seed   (or: pnpm db:seed)
//   2. App running on :3210:            pnpm dev
//   3. A saved signed-in session state at .auth/state.json. To create it once:
//        npx playwright open --save-storage=.auth/state.json http://localhost:3210/sign-in
//      then sign in as the demo user in the opened browser and close it.
//
// Run:  node scripts/capture-shots.mjs
import { chromium } from "playwright";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3210";
const shots = [
  { path: "/dashboard", file: "dashboard.png" },
  { path: "/budget", file: "budget.png" },
  { path: "/balance", file: "balance.png" },
  { path: "/transactions", file: "transactions.png" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: ".auth/state.json",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

for (const shot of shots) {
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800); // let charts settle
  await page.screenshot({ path: `public/marketing/${shot.file}` });
  console.log(`captured ${shot.file}`);
}

await browser.close();
```

- [ ] **Step 3: Capture the images (local, manual)**

Run (locally, after the prerequisites in the script header):
```bash
node scripts/capture-shots.mjs
```
Expected: `public/marketing/dashboard.png`, `budget.png`, `balance.png`, `transactions.png` created.

> If a real signed-in session is impractical right now, **skip the capture** and leave the placeholders — the page still ships. Come back to this task when seed/auth are ready.

- [ ] **Step 4: Wire the images into the components**

In `src/components/marketing/Hero/index.tsx`, add `src` to the `MarketingShot`:
```tsx
<MarketingShot
  src="/marketing/dashboard.png"
  label="Dashboard"
  caption="Spending by category, cash flow, balance trend, net worth — at a glance"
  alt="The Balanced dashboard showing spending and net-worth charts"
/>
```

In `src/components/marketing/LandingPage/index.tsx`, add `src` to each `shot` object:
```tsx
shot={{ src: "/marketing/budget.png", label: "Budget", alt: "...", caption: "..." }}
// balance → src: "/marketing/balance.png"
// transactions → src: "/marketing/transactions.png"
```

- [ ] **Step 5: Verify the page renders images**

Run: `pnpm dev` and open `http://localhost:3210/` — confirm the four screenshots render in their 16:9 frames. Then `pnpm test` (the `src`-present branch of `MarketingShot` is already covered).

- [ ] **Step 6: Commit**

```bash
git add public/marketing scripts/capture-shots.mjs src/components/marketing/Hero/index.tsx src/components/marketing/LandingPage/index.tsx
git commit -m "feat(marketing): capture script + wire real screenshots"
```

> Note: add `/.auth/` to `.gitignore` if you created a session-state file — never commit auth state.

---

## Phase 6 — Final verification

### Task 16: Full pre-flight + README note

**Files:**
- Modify: `README.md` (add a short "Marketing screenshots" note pointing at `scripts/capture-shots.mjs`)

- [ ] **Step 1: Add a README note**

Add a short section to `README.md` documenting that landing-page screenshots live in `public/marketing/` and are regenerated with `node scripts/capture-shots.mjs` against a seeded local app — and **must be re-captured when the dashboard/budget/balance/transactions UI changes.**

- [ ] **Step 2: Run the full local pre-flight**

Run: `pnpm verify`
Expected: `typecheck && check && test` all green. Fix any Biome formatting issues with `pnpm lint:fix && pnpm format` and re-run.

- [ ] **Step 3: Run e2e**

Run: `pnpm test:e2e -- landing`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: note marketing screenshot capture workflow"
```

- [ ] **Step 5: Manual visual check (recommended)**

Run `pnpm dev`, open `http://localhost:3210/`, and eyeball against the approved mockup `.superpowers/brainstorm/224495-1780857475/content/mockup-a4.html`: hero, branched tree, three showcase rows (alternating), details grid, dark CTA, marketing footer. Confirm no global footer double-renders and the nav shows the Get-started pill + anchors.

---

## Self-Review

**Spec coverage (against `docs/superpowers/specs/2026-06-07-balanced-landing-page-design.md`):**
- §4.1 Nav (brand, anchors, Get started, drop Home) → Task 1 ✓
- §4.2 Hero → Task 6 ✓
- §4.3 How it works tree → Task 7 ✓
- §4.4 Features intro → Task 12 ✓
- §4.5 Showcase rows (Budget/Balance/Transactions, alternating, transactions bullets) → Tasks 8 + 12 ✓
- §4.6 Details grid (six items, no "lock the month") → Task 9 ✓
- §4.7 Dark CTA band (inverted pill) → Task 10 ✓
- §4.8 Footer (no wordmark) → Task 11; global footer hidden on `/` → Task 2 ✓
- §5 Screenshots (Playwright capture into `public/marketing/`, placeholders meanwhile) → Tasks 5 + 15 ✓
- §6 Design-system mapping (tokens, mono-caps, inverted CTA) → all component tasks ✓
- §7 Components/files → file structure ✓
- §8 Behaviour (public `/`, signed-in redirect, drop Home, responsive) → Tasks 1 + 13; responsive media queries in styled files ✓
- §8 Accessibility (one h1, alt text, anchors) → Hero h1, MarketingShot alt, anchor ids ✓
- §10 Testing (unit per component + page; e2e landing) → all tasks + Task 14 ✓

**Placeholder scan:** No "TBD"/"handle edge cases" — every step has concrete code/commands. The only deliberately-deferred item is the *manual local* screenshot capture (Task 15), which the page gracefully degrades around via `MarketingShot` placeholders.

**Type consistency:** `MarketingShot` props (`src?`, `alt`, `label`, `caption?`) are used identically in Hero (Task 6/15) and FeatureShowcase `shot` (Task 8/12). `FeatureShowcase` `bullets: {key,text}[]` matches the data passed in Task 12. `NavBar` keeps its existing `{ signedIn, transactionsEnabled }` props. `Home()` is async and awaited in its test (Task 13).
