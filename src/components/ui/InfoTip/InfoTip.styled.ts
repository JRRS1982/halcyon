import styled from "styled-components";

export const Button = styled.button`
  ${({ theme }) => `
    width: 16px;
    height: 16px;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.rounded.full};
    border: 1px solid ${theme.colors.hairlineStrong};
    background: ${theme.colors.canvas};
    color: ${theme.colors.body};
    font-family: ${theme.typography.bodyMd.family};
    font-size: 10px;
    font-weight: 600;
    font-style: italic;
    line-height: 1;
    text-transform: none;
    letter-spacing: normal;
    cursor: pointer;

    &:hover {
      border-color: ${theme.colors.ink};
      color: ${theme.colors.ink};
    }
  `}
`;

// Fixed-position, so a parent with overflow:hidden cannot clip it. Anchored to
// the icon's bounding rect at open time.
export const Popover = styled.div`
  ${({ theme }) => `
    position: fixed;
    z-index: 50;
    max-width: 280px;
    background: ${theme.colors.canvas};
    border: 1px solid ${theme.colors.hairline};
    border-radius: ${theme.rounded.sm};
    box-shadow: rgba(15, 17, 22, 0.12) 0px 6px 16px 0px;
    padding: ${theme.spacing.md};
    text-transform: none;
    letter-spacing: normal;
  `}
`;

export const Title = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMdStrong.family};
    font-size: ${theme.typography.bodyMdStrong.size};
    font-weight: ${theme.typography.bodyMdStrong.weight};
    color: ${theme.colors.ink};
    margin-bottom: ${theme.spacing.xs};
  `}
`;

export const Body = styled.div`
  ${({ theme }) => `
    font-family: ${theme.typography.bodyMd.family};
    font-size: ${theme.typography.bodyMd.size};
    line-height: ${theme.typography.bodyMd.lineHeight};
    color: ${theme.colors.body};
  `}
`;
