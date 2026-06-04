import Link from "next/link";
import styled from "styled-components";

export const FooterBar = styled.footer`
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing["2xl"]};
  display: flex;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xl};
  flex-wrap: wrap;
`;

export const FooterLink = styled(Link)`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export const Copy = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;
