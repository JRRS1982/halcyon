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
import { createPlanLiability } from "./actions";

type PropertyMode = "NONE" | "NEW" | "EXISTING";

/**
 * Adds a liability, and the property behind it when it is a mortgage.
 *
 * The mirror of AddAssetDrawer: a mortgage is a liability that names the
 * property it is secured on, so the same choice appears from this side.
 */
export function AddLiabilityDrawer({
  open,
  unmortgagedProperties,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Properties without a mortgage — the link is one-to-one. */
  unmortgagedProperties: { id: string; label: string }[];
  onClose: () => void;
  onCreated: (created: {
    liabilityId: string;
    linkedAssetId: string | null;
  }) => void;
}) {
  const [label, setLabel] = useState("");
  // "" means unanswered, which is not the same as zero.
  const [balance, setBalance] = useState("");
  const [isMortgage, setIsMortgage] = useState(false);
  const [property, setProperty] = useState<PropertyMode>("NEW");
  const [propertyId, setPropertyId] = useState("");
  const [propertyLabel, setPropertyLabel] = useState("");
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

  const complete =
    label.trim() !== "" &&
    balance.trim() !== "" &&
    Number.isFinite(Number(balance)) &&
    (!isMortgage ||
      ((property !== "EXISTING" || propertyId !== "") &&
        (property !== "NEW" || propertyLabel.trim() !== "")));

  const reset = () => {
    setLabel("");
    setBalance("");
    setIsMortgage(false);
    setProperty("NEW");
    setPropertyId("");
    setPropertyLabel("");
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createPlanLiability({
        label: label.trim(),
        openingBalance: Number(balance),
        property: !isMortgage
          ? undefined
          : property === "EXISTING"
            ? { mode: "EXISTING", assetId: propertyId }
            : { mode: "NEW", label: propertyLabel.trim() },
      });
      reset();
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the liability");
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
      <Modal role="dialog" aria-label="Add a liability">
        <Title>Add a liability</Title>

        <Field>
          Name
          <Input
            autoFocus
            value={label}
            placeholder="Halifax mortgage"
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>

        <Field>
          Balance owed today
          <Input
            inputMode="decimal"
            value={balance}
            placeholder="0"
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>

        <Choice>
          <input
            type="checkbox"
            checked={isMortgage}
            onChange={(e) => setIsMortgage(e.target.checked)}
          />
          This is a mortgage on a property
        </Choice>

        {isMortgage && (
          <LinkSection>
            <LinkLegend>Property</LinkLegend>
            <Choice>
              <input
                type="radio"
                name="property"
                checked={property === "NEW"}
                onChange={() => setProperty("NEW")}
              />
              Add a new one
            </Choice>
            <Choice>
              <input
                type="radio"
                name="property"
                checked={property === "EXISTING"}
                disabled={unmortgagedProperties.length === 0}
                onChange={() => setProperty("EXISTING")}
              />
              Link one I already have
            </Choice>
            {property === "NEW" && (
              <Field>
                Property name
                <Input
                  value={propertyLabel}
                  placeholder="12 Rose Street"
                  onChange={(e) => setPropertyLabel(e.target.value)}
                />
              </Field>
            )}
            {property === "EXISTING" && (
              <Select
                aria-label="Which property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                <option value="">Choose a property…</option>
                {unmortgagedProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
            {unmortgagedProperties.length === 0 && (
              <Muted>
                Every property you have already has a mortgage — one property
                carries one mortgage.
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
