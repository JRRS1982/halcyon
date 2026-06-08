import styled from "styled-components";

// Constrains the in-flow sections to the 1240px container with page gutters.
// Full-bleed sections (DetailGrid band, CtaBand) render their own background
// edge-to-edge and place a Container inside themselves where needed.
export const Container = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 760px) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

export const FeaturesIntro = styled.section`
  padding: ${({ theme }) => `${theme.spacing.section} 0 0`};
`;
