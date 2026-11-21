import styled from "styled-components";

// Slide toggle: a visually-hidden checkbox drives the track via the adjacent-
// sibling selector, so it stays keyboard- and form-native while looking like a
// switch.
export const SwitchInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
`;

export const SwitchTrack = styled.span`
  position: relative;
  display: inline-block;
  flex: none;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.hairlineStrong};
  transition: background 0.15s ease;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.canvas};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s ease;
  }

  ${SwitchInput}:checked + & {
    background: ${({ theme }) => theme.colors.positive};
  }

  ${SwitchInput}:checked + &::after {
    transform: translateX(18px);
  }

  ${SwitchInput}:focus-visible + & {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

export const SwitchControl = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
`;
