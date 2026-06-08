import { SectionHeading } from "@/components/marketing/SectionHeading";
import {
  Badge,
  Branch,
  BranchCard,
  BranchText,
  BranchTitle,
  Fork,
  Merge,
  Node,
  NodeKey,
  NodeText,
  Section,
  Stem,
  Tree,
} from "./HowItWorks.styled";

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading
        eyebrow="How it works"
        title="One simple path. You pick how hands-on."
        lead="Set things up once, then choose how your numbers get in. Balanced guides you either way — and you can switch whenever you like."
      />
      <Tree>
        <Node>
          <NodeKey>Step 1 · Set up</NodeKey>
          <NodeText>
            Add your accounts and the categories that match how you actually
            spend. Balanced suggests a sensible starting set.
          </NodeText>
        </Node>
        <Stem />
        <Node>
          <NodeKey>Step 2 · Enter your values — two ways</NodeKey>
          <NodeText>
            Choose the approach that suits you. Both fill in the same budget and
            balance, so the rest of the app just works.
          </NodeText>
        </Node>
        <Stem />
        <Fork />
        <Branch>
          <BranchCard>
            <Badge $accent>Option A · Transactions on</Badge>
            <BranchTitle>Let your statements do the work</BranchTitle>
            <BranchText>
              Import a bank statement and Balanced sorts every transaction into
              categories, then fills your budget actuals and balances for you.
              &ldquo;Where did it all go?&rdquo; answers itself.
            </BranchText>
          </BranchCard>
          <BranchCard>
            <Badge>Option B · Manual</Badge>
            <BranchTitle>Type the figures in yourself</BranchTitle>
            <BranchText>
              Prefer to stay hands-on, or not connect a bank? Enter your numbers
              straight into the budget and balance sheets. No imports — just a
              clean, guided place to keep them.
            </BranchText>
          </BranchCard>
        </Branch>
        <Merge />
        <Stem />
        <Node $solid>
          <NodeKey $onDark>Step 3 · See where you stand</NodeKey>
          <NodeText $onDark>
            Either way, the same dashboard lights up: your spending breakdown,
            cash flow, budget variance and net worth — all kept up to date for
            you.
          </NodeText>
        </Node>
      </Tree>
    </Section>
  );
}
