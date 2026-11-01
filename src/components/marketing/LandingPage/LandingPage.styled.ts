import styled from "styled-components";

// Constrains the page to the 1240px container with page gutters.
export const Container = styled.div`
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};

  @media (max-width: 760px) {
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;
