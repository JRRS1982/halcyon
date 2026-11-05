import styled from "styled-components";

export const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 17, 22, 0.35);
  display: grid;
  place-items: center;
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const Modal = styled.div`
  width: 100%;
  max-width: 420px;
  background: ${({ theme }) => theme.colors.canvas};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  box-shadow: rgba(15, 17, 22, 0.18) 0px 10px 30px 0px;
  padding: ${({ theme }) => theme.spacing.xl};
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

// Set as every other dialog's title is (see components/ui/Drawer).
export const Title = styled.h2`
  font-family: ${({ theme }) => theme.typography.amountXl.family};
  font-size: ${({ theme }) => theme.typography.amountXl.size};
  font-weight: ${({ theme }) => theme.typography.amountXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.amountXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;

export const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.control.family};
  font-size: ${({ theme }) => theme.typography.control.size};
  font-weight: ${({ theme }) => theme.typography.control.weight};
  color: ${({ theme }) => theme.colors.body};
`;

export const Input = styled.input`
  min-height: 36px;
  border: 1px solid ${({ theme }) => theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-weight: 400;
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
`;

export const Select = styled.select`
  min-height: 36px;
  border: 1px solid ${({ theme }) => theme.colors.fieldBorder};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-weight: 400;
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
`;

// The link section only appears for the kinds that can carry one, so it needs
// to read as part of the form rather than as something that jumped in.
export const LinkSection = styled.fieldset`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.md};
  margin: 0;
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const LinkLegend = styled.legend`
  padding: 0 ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

export const Choice = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ink};
`;

export const Muted = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.bodyMuted};
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const Err = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.negative};
`;
