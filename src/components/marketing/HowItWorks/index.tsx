import { SectionHeading } from "@/components/marketing/SectionHeading";
import {
  Badge,
  FinaleCard,
  FinaleKey,
  FinaleText,
  Flow,
  Loop,
  LoopList,
  Marker,
  OptionCard,
  OptionText,
  OptionTitle,
  Options,
  ReturnLabel,
  ReturnPath,
  Section,
  SetupStep,
  Step,
  StepKey,
  StepText,
} from "./HowItWorks.styled";

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading
        eyebrow="How it works"
        title="Set up once. Then a few minutes a month."
        lead="Balanced is built around a monthly habit: enter what happened, see what it means, adjust. The loop below is the whole method."
      />
      <Flow>
        <SetupStep>
          <Marker $outline aria-hidden>
            00
          </Marker>
          <div>
            <StepKey>Setup · once</StepKey>
            <StepText>
              Add your accounts, the categories that match how you spend, the
              budget you want to hold yourself to, and the assets and debts you
              want to watch. Balanced seeds a sensible starting set — refine it
              as you go.
            </StepText>
          </div>
        </SetupStep>
        <Loop>
          <ReturnPath aria-hidden>
            <ReturnLabel>Repeat monthly</ReturnLabel>
          </ReturnPath>
          <LoopList>
            <Step>
              <Marker aria-hidden>01</Marker>
              <div>
                <StepKey>Step 1 · Enter your month — two ways</StepKey>
                <StepText>
                  Get the month&apos;s numbers in however suits you. When
                  something doesn&apos;t fit, add a category on the spot — the
                  sheet learns the shape of your spending.
                </StepText>
                <Options>
                  <OptionCard>
                    <Badge $accent>Option A · Transactions on</Badge>
                    <OptionTitle>Let your statements do the work</OptionTitle>
                    <OptionText>
                      Import a bank statement and Balanced sorts every
                      transaction into categories, then fills your budget
                      actuals for you.
                    </OptionText>
                  </OptionCard>
                  <OptionCard>
                    <Badge>Option B · Manual</Badge>
                    <OptionTitle>Type the figures in yourself</OptionTitle>
                    <OptionText>
                      Prefer to stay hands-on, or not connect a bank? Enter your
                      numbers straight into the budget sheet — no imports.
                    </OptionText>
                  </OptionCard>
                </Options>
              </div>
            </Step>
            <Step>
              <Marker aria-hidden>02</Marker>
              <div>
                <StepKey>Step 2 · Compare plan to reality</StepKey>
                <StepText>
                  Your categorised spending lands beside the budget you set. The
                  overspends are impossible to miss — and that gap is the
                  lesson.
                </StepText>
              </div>
            </Step>
            <Step>
              <Marker aria-hidden>03</Marker>
              <div>
                <StepKey>Step 3 · Update your balances</StepKey>
                <StepText>
                  Tick through the assets and debts you track — a few minutes to
                  a fresh net worth on the balance sheet.
                </StepText>
              </div>
            </Step>
            <Step>
              <Marker aria-hidden>04</Marker>
              <FinaleCard>
                <FinaleKey>Step 4 · See where you stand</FinaleKey>
                <FinaleText>
                  The dashboard tells the month&apos;s story — spending, cash
                  flow, net worth — and the plan shows whether you&apos;re still
                  on track for your goals. Then close the month and live your
                  life; an optional email nudges you when the next one is ready.
                </FinaleText>
              </FinaleCard>
            </Step>
          </LoopList>
        </Loop>
      </Flow>
    </Section>
  );
}
