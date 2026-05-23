import styled from "styled-components";

// The Sheet is the bordered grid container. Rows inside it lay out with the
// same 6-column template, so amount columns align top-to-bottom across the
// entire sheet.
export const SheetContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-top: none;
  border-radius: 0 0 ${({ theme }) => theme.rounded.sm}
    ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  overflow: hidden;
`;
