import styled from "styled-components";

export const Card = styled.div`
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: ${({ theme }) => theme.typography.bodyMd.lineHeight};
  color: ${({ theme }) => theme.colors.ink};
`;
