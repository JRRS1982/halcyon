import styled, { css } from "styled-components";

// The shape is a CSS aspect ratio; a phone variant takes its own below 761px.
export const Frame = styled.div<{ $aspect?: string; $phoneAspect?: string }>`
  ${({ theme, $aspect, $phoneAspect }) => css`
    position: relative;
    width: 100%;
    background: ${theme.colors.canvasSoft};
    border: 1px solid ${theme.colors.hairlineStrong};
    overflow: hidden;
    ${$aspect && `aspect-ratio: ${$aspect};`}

    ${
      $phoneAspect &&
      css`
      @media (max-width: 760px) {
        aspect-ratio: ${$phoneAspect};
      }
    `
    }
  `}
`;

// Light and dark plates both sit in the frame; the one that does not match the
// page is display:none, so it is neither shown nor (being lazy) downloaded.
// The selectors mirror themeCss: the OS decides unless a stored choice says
// otherwise.
export const Scheme = styled.span<{ $scheme: "light" | "dark" }>`
  ${({ $scheme }) => {
    const onLightPage = $scheme === "light" ? "contents" : "none";
    const onDarkPage = $scheme === "light" ? "none" : "contents";
    return css`
      display: ${onLightPage};

      @media (prefers-color-scheme: dark) {
        :root:not(:has([data-theme="light"])) & {
          display: ${onDarkPage};
        }
      }

      :root:has([data-theme="dark"]) & {
        display: ${onDarkPage};
      }
    `;
  }}
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
    font-family: ${theme.typography.kicker.family};
    font-size: ${theme.typography.kicker.size};
    font-weight: ${theme.typography.kicker.weight};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.kicker.letterSpacing};
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
