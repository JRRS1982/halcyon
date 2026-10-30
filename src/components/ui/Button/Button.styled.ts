import styled, { css } from "styled-components";

export type ButtonVariant = "primary" | "outline" | "destructive";

const variantStyles = {
  primary: css`
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.onPrimary};
    border: 1px solid ${({ theme }) => theme.colors.primary};

    &:hover:not(:disabled) {
      opacity: 0.85;
    }
  `,
  outline: css`
    background: ${({ theme }) => theme.colors.canvas};
    color: ${({ theme }) => theme.colors.ink};
    border: 1px solid ${({ theme }) => theme.colors.ink};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.canvasSoft};
    }
  `,
  destructive: css`
    background: ${({ theme }) => theme.colors.canvas};
    color: ${({ theme }) => theme.colors.negative};
    border: 1px solid ${({ theme }) => theme.colors.hairline};

    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.negative};
    }
  `,
};

export const StyledButton = styled.button<{ $variant: ButtonVariant }>`
  ${({ theme }) => css`
    font-family: ${theme.typography.bodyMdStrong.family};
    font-size: 14px;
    font-weight: 600;
    line-height: 1.15;

    border-radius: ${theme.rounded.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.lg};
    /* A button label never wraps — wrapping changes the button's height when
       flex containers squeeze it (e.g. the nav bar on narrow screens). */
    white-space: nowrap;
    cursor: pointer;
    transition: opacity 100ms, border-color 100ms;
  `}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  ${({ $variant }) => variantStyles[$variant]}
`;
