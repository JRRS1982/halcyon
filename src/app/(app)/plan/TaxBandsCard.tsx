"use client";

import { Fragment } from "react";
import styled from "styled-components";
import { LATEST_YEAR } from "@/lib/tax/bands";
import { publishedRates } from "@/lib/tax/published";
import type { Regime } from "@/lib/tax/types";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Sub = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  margin: 0;
`;
const Rows = styled.dl`
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
  margin: 0;
  font-size: 13px;
`;
const Name = styled.dt`
  color: ${({ theme }) => theme.colors.body};
`;
const Rate = styled.dd`
  margin: 0;
  color: ${({ theme }) => theme.colors.ink};
  font-variant-numeric: tabular-nums;
`;
const Range = styled.dd`
  margin: 0;
  color: ${({ theme }) => theme.colors.body};
  font-variant-numeric: tabular-nums;
  text-align: right;
`;
const Note = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  margin: 0;
`;

const REGIME_NAME: Record<Regime, string> = {
  RUK: "England, Wales and Northern Ireland",
  SCOTLAND: "Scotland",
};

const money = (n: number) => `£${n.toLocaleString("en-GB")}`;

/**
 * What the chosen regime actually means, in the figures HMRC publishes.
 *
 * The projection's accuracy rests on a table the user never sees and cannot
 * edit, which is the right call — bands are a public fact, not a preference —
 * but it does mean taking the number on trust. This is the table, shown.
 */
export function TaxBandsCard({ regime }: { regime: Regime }) {
  const rates = publishedRates(LATEST_YEAR.year, regime);

  return (
    <Panel aria-label="Income tax bands">
      <Heading>Income tax</Heading>
      <Sub>
        {REGIME_NAME[regime]} · {rates.year}
      </Sub>
      <Rows>
        <Name>Personal allowance</Name>
        <Rate>0%</Rate>
        <Range>up to {money(rates.personalAllowance)}</Range>
        {rates.bands.map((band) => (
          <Fragment key={band.name}>
            <Name>{band.name}</Name>
            <Rate>{band.ratePct}%</Rate>
            <Range>
              {band.to === null
                ? `over ${money(band.from - 1)}`
                : `${money(band.from)} – ${money(band.to)}`}
            </Range>
          </Fragment>
        ))}
      </Rows>
      {rates.taper && (
        <Note>
          Your allowance falls £1 for every £{rates.taper.perPounds} earned over{" "}
          {money(rates.taper.from)}, so it is gone by{" "}
          {money(
            rates.taper.from + rates.personalAllowance * rates.taper.perPounds,
          )}
          .
        </Note>
      )}
    </Panel>
  );
}
