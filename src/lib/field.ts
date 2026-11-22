import { theme } from "@/lib/theme";

/**
 * A boxed form field — input, select or textarea — as DESIGN.md → Forms and
 * Inputs sets it: 36px tall at least, 8px by 12px padding, body-md type, the
 * field fill and its 3:1 edge, 2px corners. A plain string, like the pointer
 * helpers, so it drops into any styled template.
 *
 * One definition because each form used to restate it, and they drifted: a
 * settings section put a 13px, 4px-padded select beside a 14px, 8px-padded
 * input, and the pair stood at different heights on the same line.
 */
export const boxedField = `
  min-height: 36px;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border: 1px solid ${theme.colors.fieldBorder};
  border-radius: ${theme.rounded.sm};
  background-color: ${theme.colors.field};
  color: ${theme.colors.ink};
  font-family: ${theme.typography.bodyMd.family};
  font-size: ${theme.typography.bodyMd.size};
`;
