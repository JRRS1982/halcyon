// src/app/plan/CreatePlanForm.tsx
"use client";

import { useState, useTransition } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createPlan } from "./actions";

// Empty state for /plan: one centred card asking only for the date of birth.
// Every other assumption (retirement age included) is seeded with a default and
// edited afterwards in the Assumptions panel, which is what drives the charts.
const Shell = styled.main`
  display: grid;
  justify-items: center;
  padding: ${({ theme }) => theme.spacing["4xl"]} ${({ theme }) => theme.spacing["2xl"]};
`;
const Panel = styled(Card)`
  width: 100%;
  max-width: 420px;
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;
const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.displayXl.size};
  font-weight: ${({ theme }) => theme.typography.displayXl.weight};
  letter-spacing: ${({ theme }) => theme.typography.displayXl.letterSpacing};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Intro = styled.p`
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  line-height: ${({ theme }) => theme.typography.bodyMd.lineHeight};
  color: ${({ theme }) => theme.colors.body};
  margin: 0;
`;
const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  text-align: left;
`;
const Field = styled.label`
  display: grid;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.body};
`;
const Input = styled.input`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
`;

export function CreatePlanForm() {
  const [pending, startTransition] = useTransition();
  const [dob, setDob] = useState("");

  return (
    <Shell>
      <Panel>
        <Title>Start your plan</Title>
        <Intro>
          We&apos;ll build a first forecast from your latest budget and balance.
          Retirement age and every other assumption can be adjusted once the
          plan exists.
        </Intro>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => {
              createPlan({ dateOfBirth: dob });
            });
          }}
        >
          <Field>
            Date of birth
            <Input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" disabled={pending || !dob}>
            Create my plan
          </Button>
        </Form>
      </Panel>
    </Shell>
  );
}
