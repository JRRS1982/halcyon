import styled, { css } from "styled-components";
import { Frame } from "@/components/marketing/MarketingShot/MarketingShot.styled";

// The front page's lead article: what Balanced is and the way in, beside the
// product doing it. The lead picture is two plates, the page as a desktop
// shows it and as a phone does, each legible at the size it is shown.
export const Section = styled.section`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: ${theme.spacing["3xl"]};
    align-items: center;
    padding: ${theme.spacing["2xl"]} 0 ${theme.spacing["3xl"]};

    @media (max-width: 1023px) {
      grid-template-columns: 1fr;
      gap: ${theme.spacing["2xl"]};
    }
  `}
`;

export const Shot = styled(Frame)`
  aspect-ratio: 2464 / 1736;

  @media (max-width: 760px) {
    aspect-ratio: 1170 / 1608;
    max-width: 420px;
  }
`;
