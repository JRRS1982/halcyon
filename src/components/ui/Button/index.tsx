import type { ButtonHTMLAttributes } from "react";
import { type ButtonVariant, StyledButton } from "./Button.styled";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "primary", ...rest }: ButtonProps) {
  return <StyledButton $variant={variant} {...rest} />;
}
