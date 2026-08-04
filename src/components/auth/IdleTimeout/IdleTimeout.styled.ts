import styled from "styled-components";

// Unlike `src/app/plan/PlanDrawer.tsx` — a side sheet that deliberately avoids
// showModal() so the page stays usable behind it — this one is opened with
// showModal(). A session about to end is exactly the case where the page
// should stop being usable, and the UA gives us the backdrop, the top layer
// and focus containment for free.
export const Sheet = styled.dialog`
  padding: 0;
  width: min(420px, 94vw);
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: 0 24px 64px rgba(15, 17, 22, 0.22);
  color: ${({ theme }) => theme.colors.ink};

  &::backdrop {
    background: rgba(15, 17, 22, 0.22);
  }
`;

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xl};
`;

export const Eyebrow = styled.p`
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  font-weight: ${({ theme }) => theme.typography.monoCaps.weight};
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.bodyMuted};
  margin: 0;
`;

export const Title = styled.h2`
  font-family: ${({ theme }) => theme.typography.displayLg.family};
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  line-height: ${({ theme }) => theme.typography.displayLg.lineHeight};
  letter-spacing: ${({ theme }) => theme.typography.displayLg.letterSpacing};
  margin: 0;
`;

export const Message = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: ${({ theme }) => theme.typography.bodyMd.lineHeight};
  color: ${({ theme }) => theme.colors.body};
  margin: 0;
`;

export const Countdown = styled.span`
  font-family: ${({ theme }) => theme.typography.amountStrong.family};
  font-weight: ${({ theme }) => theme.typography.amountStrong.weight};
  color: ${({ theme }) => theme.colors.ink};
  font-variant-numeric: tabular-nums;
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
  border-top: 1px solid ${({ theme }) => theme.colors.hairline};
`;
