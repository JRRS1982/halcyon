/**
 * Hides an element from sight while leaving it in the accessibility tree: a
 * column head the eye does not need but a screen reader announces, a field's
 * name where a placeholder already says it on screen. A plain string, like the
 * pointer helpers, so it drops into any styled template.
 */
export const visuallyHidden = `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
