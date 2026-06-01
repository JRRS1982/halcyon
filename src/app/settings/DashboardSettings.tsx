"use client";

import { DASHBOARD_CHARTS } from "@/lib/dashboard/charts";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { SectionHeading } from "./SectionHeading";
import { setChartVisibility } from "./actions";

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]}
    ${({ theme }) => theme.spacing["5xl"]};
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;
`;

const SwitchInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
`;

const SwitchTrack = styled.span`
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

const SwitchControl = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
`;

export function DashboardSettings({
  hiddenCharts,
}: {
  hiddenCharts: string[];
}) {
  const [hidden, setHidden] = useState(new Set(hiddenCharts));
  const [pending, startTransition] = useTransition();

  const toggle = (key: string, visible: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
    startTransition(async () => {
      await setChartVisibility({ key, visible });
    });
  };

  return (
    <Shell>
      <SectionHeading>Dashboard</SectionHeading>
      <Lead>Choose which charts appear on your dashboard.</Lead>
      {DASHBOARD_CHARTS.map((chart) => (
        <ToggleRow key={chart.key}>
          {chart.label}
          <SwitchControl>
            <SwitchInput
              type="checkbox"
              checked={!hidden.has(chart.key)}
              disabled={pending}
              onChange={(event) => toggle(chart.key, event.target.checked)}
            />
            <SwitchTrack />
          </SwitchControl>
        </ToggleRow>
      ))}
    </Shell>
  );
}
