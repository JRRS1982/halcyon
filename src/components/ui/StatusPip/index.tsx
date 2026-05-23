import { PipDot, type StatusPipState, PipWrapper } from "./StatusPip.styled";

export type StatusPipProps = {
  state: StatusPipState;
  children: React.ReactNode;
};

export function StatusPip({ state, children }: StatusPipProps) {
  return (
    <PipWrapper>
      <PipDot $state={state} />
      <span>{children}</span>
    </PipWrapper>
  );
}

export type { StatusPipState };
