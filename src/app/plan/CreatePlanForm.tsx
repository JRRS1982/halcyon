// src/app/plan/CreatePlanForm.tsx
"use client";

import { Button } from "@/components/ui/Button";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { createPlan } from "./actions";

const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  max-width: 320px;
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
  const [retirementAge, setRetirementAge] = useState(67);

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => {
          createPlan({ dateOfBirth: dob, retirementAge });
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
      <Field>
        Target retirement age
        <Input
          type="number"
          min={40}
          max={90}
          value={retirementAge}
          onChange={(e) => setRetirementAge(Number(e.target.value))}
          required
        />
      </Field>
      <Button type="submit" disabled={pending || !dob}>
        Create my plan
      </Button>
    </Form>
  );
}
