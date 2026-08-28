"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Actions,
  Choice,
  Err,
  Field,
  Input,
  LinkLegend,
  LinkSection,
  Modal,
  Muted,
  Scrim,
  Select,
  Title,
} from "./AddRowDrawer.styled";
import { createPlanAsset } from "./actions";

const WRAPPERS = [
  { value: "PENSION", label: "Pension" },
  { value: "ISA", label: "ISA" },
  { value: "GIA", label: "General investment account" },
  { value: "CASH", label: "Cash" },
  { value: "PROPERTY", label: "Property" },
  { value: "DB_PENSION", label: "Defined benefit pension" },
  { value: "OTHER", label: "Other" },
] as const;

type Wrapper = (typeof WRAPPERS)[number]["value"];
type MortgageMode = "NONE" | "NEW" | "EXISTING";

/**
 * Adds an asset, and its mortgage when it is a property.
 *
 * The row is created once, on Add, from what is in this form — rather than
 * written as "New asset" with 0 in it and edited afterwards. A row that exists
 * with placeholder values cannot be told apart from one the user meant to
 * leave at zero.
 */
export function AddAssetDrawer({
  open,
  unlinkedMortgages,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Mortgages not already attached to a property — the link is one-to-one. */
  unlinkedMortgages: { id: string; label: string }[];
  onClose: () => void;
  onCreated: (assetId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [wrapper, setWrapper] = useState<Wrapper>("PENSION");
  // A string, not a number: "" means the user has not answered yet, which is
  // different from answering zero.
  const [value, setValue] = useState("");
  const [mortgage, setMortgage] = useState<MortgageMode>("NONE");
  const [mortgageId, setMortgageId] = useState<string>("");
  const [mortgageLabel, setMortgageLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes it, as every other dialog here does. Declared before the
  // early return so the hook order does not change with `open`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isProperty = wrapper === "PROPERTY";
  const complete =
    label.trim() !== "" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value)) &&
    (!isProperty ||
      ((mortgage !== "EXISTING" || mortgageId !== "") &&
        (mortgage !== "NEW" || mortgageLabel.trim() !== "")));

  const reset = () => {
    setLabel("");
    setWrapper("PENSION");
    setValue("");
    setMortgage("NONE");
    setMortgageId("");
    setMortgageLabel("");
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createPlanAsset({
        label: label.trim(),
        wrapper,
        openingValue: Number(value),
        mortgage: !isProperty
          ? undefined
          : mortgage === "EXISTING"
            ? { mode: "EXISTING", liabilityId: mortgageId }
            : mortgage === "NEW"
              ? { mode: "NEW", label: mortgageLabel.trim() }
              : { mode: "NONE" },
      });
      reset();
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the asset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Scrim
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Modal role="dialog" aria-label="Add an asset">
        <Title>Add an asset</Title>

        <Field>
          Name
          <Input
            autoFocus
            value={label}
            placeholder="Vanguard ISA"
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>

        <Field>
          Type
          <Select
            value={wrapper}
            onChange={(e) => setWrapper(e.target.value as Wrapper)}
          >
            {WRAPPERS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          Value today
          <Input
            inputMode="decimal"
            value={value}
            placeholder="0"
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>

        {isProperty && (
          <LinkSection>
            <LinkLegend>Mortgage</LinkLegend>
            <Choice>
              <input
                type="radio"
                name="mortgage"
                checked={mortgage === "NONE"}
                onChange={() => setMortgage("NONE")}
              />
              No mortgage
            </Choice>
            <Choice>
              <input
                type="radio"
                name="mortgage"
                checked={mortgage === "NEW"}
                onChange={() => setMortgage("NEW")}
              />
              Add a new one
            </Choice>
            <Choice>
              <input
                type="radio"
                name="mortgage"
                checked={mortgage === "EXISTING"}
                disabled={unlinkedMortgages.length === 0}
                onChange={() => setMortgage("EXISTING")}
              />
              Link one I already have
            </Choice>
            {mortgage === "NEW" && (
              <Field>
                Mortgage name
                <Input
                  value={mortgageLabel}
                  placeholder="Halifax mortgage"
                  onChange={(e) => setMortgageLabel(e.target.value)}
                />
              </Field>
            )}
            {mortgage === "EXISTING" && (
              <Select
                aria-label="Which mortgage"
                value={mortgageId}
                onChange={(e) => setMortgageId(e.target.value)}
              >
                <option value="">Choose a mortgage…</option>
                {unlinkedMortgages.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
            {unlinkedMortgages.length === 0 && (
              <Muted>
                Every mortgage you have is already attached to a property — one
                property carries one mortgage.
              </Muted>
            )}
          </LinkSection>
        )}

        {error && <Err>{error}</Err>}

        <Actions>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!complete || busy}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </Actions>
      </Modal>
    </Scrim>
  );
}
