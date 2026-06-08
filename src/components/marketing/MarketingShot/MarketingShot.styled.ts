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
