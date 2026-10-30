import Link from "next/link";
import styled from "styled-components";

export const FooterBar = styled.footer`
  border-top: 1px solid ${({ theme }) => theme.colors.ink};
  padding: ${({ theme }) => theme.spacing["2xl"]} ${({ theme }) => theme.spacing["5xl"]};
  display: flex;
  gap: ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 767px) {
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  }
  flex-wrap: wrap;
`;

export const FooterLink = styled(Link)`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.ink};
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
    text-decoration: underline;
  }
`;

export const Copy = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;
