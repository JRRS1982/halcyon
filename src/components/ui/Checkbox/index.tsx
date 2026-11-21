"use client";

import { type InputHTMLAttributes, useEffect, useRef } from "react";
import { StyledCheckbox } from "./Checkbox.styled";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  /** Some, but not all, of what this box stands for is ticked. */
  indeterminate?: boolean;
};

export function Checkbox({ indeterminate = false, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  // Indeterminate is a DOM property with no HTML attribute, so it is set here.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return <StyledCheckbox ref={ref} type="checkbox" {...rest} />;
}
