"use client";

import { useState, useTransition } from "react";
import styled from "styled-components";
import { Switch } from "@/components/ui/Switch";
import { DASHBOARD_CHARTS } from "@/lib/dashboard/charts";
import { setChartVisibility } from "./actions";
import { SectionHeading, SettingsCard } from "./SectionHeading";

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]};
  /* DESIGN.md → Layout → Grid & Container: gutters drop to 16px on mobile. */
  @media (max-width: 767px) {
    padding-left: ${({ theme }) => theme.spacing.lg};
    padding-right: ${({ theme }) => theme.spacing.lg};
  }
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
      <SettingsCard>
        <SectionHeading>Dashboard</SectionHeading>
        <Lead>Choose which charts appear on your dashboard.</Lead>
        {DASHBOARD_CHARTS.map((chart) => (
          <ToggleRow key={chart.key}>
            {chart.label}
            <Switch
              checked={!hidden.has(chart.key)}
              disabled={pending}
              onChange={(event) => toggle(chart.key, event.target.checked)}
            />
          </ToggleRow>
        ))}
      </SettingsCard>
    </Shell>
  );
}
