import type { InputHTMLAttributes } from "react";
import { SwitchControl, SwitchInput, SwitchTrack } from "./Switch.styled";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** For a setting that takes effect the moment it is flipped; a tick box is for a choice that waits for Apply or Save. */
export function Switch(props: SwitchProps) {
  return (
    <SwitchControl>
      <SwitchInput type="checkbox" {...props} />
      <SwitchTrack />
    </SwitchControl>
  );
}
