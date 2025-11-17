# Design System Standards

> Tech: TypeScript • React • Tailwind CSS • pnpm
> Scope: Personal project, being used for self development and learning but aiming for “professional-grade” standards.

---

## 1. Design Principles

1. **Clarity over cleverness**
   - UI should be obvious, predictable, and readable.
2. **Consistency by default**
   - Use shared components and tokens; avoid one-off styles.
3. **Accessibility as a baseline**
   - Every interactive element must be keyboard-usable and screen-reader-friendly.
4. **Composition over configuration**
   - Prefer small, composable components instead of giant prop bags.
5. **Restraint**
   - Minimal variants, minimal colors, minimal sizes until proven otherwise.

---

## 2. Foundations (Design Tokens)

Foundations are expressed as Tailwind config (theme) + CSS variables where needed.

### 2.1 Color

- Use semantic color tokens in Tailwind (via `extend.theme.colors`), not raw hex values in components.
- Example semantic names:
  - `bg`: `bg-surface`, `bg-subtle`, `bg-elevated`
  - `text`: `text-primary`, `text-muted`, `text-inverted`
  - `border`: `border-subtle`, `border-strong`
  - `intent`: `primary`, `secondary`, `success`, `warning`, `danger`
- Dark mode handled via `class` strategy (`.dark`) with parallel tokens.
- All text and interactive elements must meet **WCAG AA** contrast.

Usage rule:

- Components reference **semantic** tokens (e.g. `bg-primary`, `text-muted`), never raw Tailwind colors like `bg-blue-500` directly in JSX.

### 2.2 Typography

- Tailwind-driven type scale; only use predefined text classes.
- Type scale (example): `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`.
- Font weights: `normal`, `medium`, `semibold`, `bold` only.
- No inline `style` for font sizes; use Tailwind classes or variant system.

### 2.3 Spacing & Layout

- Spacing on a **4px base grid** via Tailwind:
  - Allowed: `0, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 12` (i.e. `0–48px` typical).
- Use spacing tokens consistently:
  - `p-*` for internal padding, `m-*` for outer margins.
  - Prefer `gap-*` for flex/grid spacing over manual margins.
- No random inline spacing; layout should be predictable and token-driven.

### 2.4 Radius, Shadow, and Borders

- Radius scale (example): `none`, `sm`, `md`, `lg`, `xl`, `full`.
- Usage:
  - Buttons, inputs: `rounded-md`
  - Cards, surfaces: `rounded-lg` or `rounded-xl`
- Shadow:
  - Use a small set: `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`.
  - No custom shadow inline styles.

### 2.5 Motion

- Motion used sparingly; defaults:
  - Duration: `150–250ms`
  - Easing: Tailwind defaults (`ease-out`, `ease-in-out`).
- Respect `prefers-reduced-motion`: no essential info conveyed by motion only.

---

## 3. Component Standards

All components follow a consistent pattern.

### 3.1 General Rules

- Implement as **function components** in TypeScript with explicit props types.
- Use Tailwind for styling; centralise complex variants using a `cva` / `clsx` utility pattern.
- Components live in `src/components/<ComponentName>/` or `src/components/ui/` depending on scale.
- Avoid inline styles unless absolutely necessary.

### 3.2 Props & API

- Props interfaces named `<ComponentName>Props`.
- Use these standard props where applicable:
  - `variant?: "primary" | "secondary" | "ghost" | "destructive"` (component-specific allowed)
  - `size?: "sm" | "md" | "lg"`
  - `disabled?: boolean`
  - `loading?: boolean` (for buttons etc.)
  - `aria-label` / `aria-labelledby` for icon-only or non-text controls.
- Don’t leak implementation details in prop names. Keep them semantic.

### 3.3 States

Every interactive component must define and support:

- `default`
- `hover`
- `focus-visible` (keyboard focus specifically)
- `active`
- `disabled`
- `error` (for form inputs)
- `loading` (where relevant)

Visual differences must be obvious (border, background, shadow, or underline) and accessible.

### 3.4 Composition

- Prefer compositions like:

  - `FormField` = `Label` + `Input`/`Select` + `HelperText` + `ErrorText`.
  - `Card` = `CardHeader` + `CardBody` + `CardFooter`.

- Avoid duplicated patterns; promote frequently repeated combinations into shared components.

---

## 4. Accessibility Standards

Accessibility is non-optional.

### 4.1 Keyboard

- All interactive elements must be reachable and operable via keyboard.
  - No custom `div`-as-button; use `<button>`, `<a>`, or `role="button"` + `tabIndex={0}` only when justified.
- Use `:focus-visible` styling for focus; it must be clearly visible.

### 4.2 ARIA & Semantics

- Use semantic HTML first: `button`, `nav`, `main`, `header`, `footer`, `section`, `form`, `label`, `input`, `ul/li`, etc.
- Use ARIA attributes only when needed:
  - `aria-expanded`, `aria-controls`, `aria-describedby`, `aria-invalid`, etc.
- Components such as modals, dialogs, and menus must:
  - Trap focus when open.
  - Restore focus when closed.
  - Provide proper roles (`role="dialog"` etc.) and labelling.

### 4.3 Color & Contrast

- Meet **WCAG AA** contrast for text and UI controls.
- Avoid conveying meaning by color alone; pair with icon, text, or pattern.

### 4.4 Reduced Motion

- Respect `prefers-reduced-motion` using Tailwind / CSS where animations are applied.
- Any essential state change should be visible without relying solely on animation.

---

## 5. Content & Language Standards

- Clear, concise, and concrete copy.
- Button labels:
  - Use action verbs: “Save changes”, “Create budget”, “Delete”.
  - Avoid generic “Submit” where more specificity is possible.
- Error messages:
  - Structure: **what happened** + **why** (if known) + **how to fix**.
  - Example: “Couldn’t save your budget. Your session expired — please refresh and try again.”
- Use sentence case for UI text (e.g. “Budget overview” not “Budget Overview”).

---

## 6. Tailwind & Styling Standards

- Use Tailwind utility classes for layout, spacing, typography, and color.
- Extract shared patterns into:
  - Component-level class helpers.
  - Shared `ui` components for repeated patterns (e.g. `Button`, `Input`, `Badge`, `Card`).
- Avoid:
  - Arbitrary values unless justified (`mt-[7px]` etc.).
  - Mixing many custom CSS classes when Tailwind utilities suffice.
- If custom CSS is needed:
  - Place it in a dedicated file (e.g. `globals.css` or component-specific module).
  - Use CSS variables tied to design tokens where appropriate.

---

## 7. File & Folder Structure (High-Level)

Subject to iteration but initial standard:

- `src/app` – Next.js / app routes (if using Next)
- `src/components/ui` – Reusable design-system components
- `src/components/features/<feature>` – Feature-specific compositions
- `src/styles` – Tailwind config, globals, token definitions
- `src/lib` – Utilities (e.g. `cn`/`clsx`, API helpers, hooks)

Component files:

- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Card.tsx`
- etc.

---

## 8. Testing & Quality

- All design-system components must have:
  - Unit tests for behaviour (props, events, conditional rendering).
  - Basic accessibility checks where feasible (e.g. testing roles, labels).
- Visual regressions:
  - Optional initially, but aim for story-based snapshots (Storybook or equivalent) when the system grows.

---

## 9. Versioning & Change Management

Even for a personal project, changes should be deliberate.

- Treat `src/components/ui` as a versioned surface:
  - Breaking changes to component APIs should be rare and documented in a `CHANGELOG.md` or commit messages.
  - Prefer additive changes (new props, new variants) over breaking ones.
- When changing a foundational token (e.g. primary color), verify:
  - Contrast and accessibility.
  - Impact on all key screens.

---

## 10. Initial Core Components

These components form the baseline of the design system:

- `Button`
- `IconButton`
- `Input`
- `Textarea`
- `Select` / `Combobox` (if needed)
- `Checkbox`
- `Radio`
- `Switch`
- `Card`
- `Badge`
- `Alert` / `Banner`
- `Modal` / `Dialog`
- `Tooltip`
- `Toast` / `Notification`

Each must be documented with:

- Purpose and usage
- Props API
- Examples (default, variants, sizes)
- Accessibility notes

---

By default, any new UI should first ask:
**“Can this be expressed using existing components and tokens?”**
If not, new components or tokens must fit into these standards rather than bypass them.
