import styled from "styled-components";

// The Sheet is the bordered grid container. Rows inside it lay out with the
// same 6-column template, so amount columns align top-to-bottom across the
// entire sheet.
//
// Below the tablet breakpoint the amount columns no longer fit beside a usable
// category column, so the container becomes the horizontal scroller and rows
// hold their full width inside it (DESIGN.md → Responsive Strategy →
// Collapsing Strategy → Sheet). The category cell stays sticky-left; see
// SheetRow.styled.
export const SheetContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-top: none;
  border-radius: 0 0 ${({ theme }) => theme.rounded.sm}
    ${({ theme }) => theme.rounded.sm};
  background: ${({ theme }) => theme.colors.canvas};
  overflow: hidden;

  @media (max-width: 991px) {
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
  }
`;
