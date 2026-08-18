"use client";

import {
  LegalAnchor,
  LegalBody,
  LegalHeading,
  LegalLink,
  LegalPage,
  LegalSection,
} from "@/components/legal/LegalPage";

export function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="18 August 2026">
      <LegalBody>
        These terms govern your use of Balanced Money (&ldquo;the
        Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an
        account or using the Service you agree to these terms. If you do not
        agree, do not use the Service.
      </LegalBody>

      <LegalSection>
        <LegalHeading>Who we are</LegalHeading>
        <LegalBody>
          Balanced Money is a personal finance service operated from the United
          Kingdom and available at balanced.money. You can contact us about
          anything in these terms at{" "}
          <LegalAnchor href="mailto:hello@balanced.money">
            hello@balanced.money
          </LegalAnchor>
          .
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>The Service</LegalHeading>
        <LegalBody>
          Balanced Money is a personal finance tracking tool. It lets you record
          budgets, balances, transactions, and plans, and view reports based on
          the figures you enter. The Service is currently provided free of
          charge.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Fees</LegalHeading>
        <LegalBody>
          The Service is free. We hold no payment details, there are no
          subscriptions, and nothing renews. If we ever introduce paid features,
          we will tell you clearly in advance, any charge will require your
          explicit agreement, nothing will auto-renew without a reminder sent
          before it does, and cancelling will never take more effort than
          signing up did.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Not financial advice</LegalHeading>
        <LegalBody>
          The Service is a record-keeping and visualisation tool only. Nothing
          in the Service constitutes financial, investment, tax, or legal
          advice, and no output should be relied on as such. Charts, forecasts,
          and calculations are derived entirely from the data you enter and may
          contain errors. Verify any figure independently before making
          financial decisions, and consult a qualified adviser where
          appropriate.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Your account</LegalHeading>
        <LegalBody>
          You must provide accurate registration details and keep your sign-in
          credentials confidential. You are responsible for all activity under
          your account. You must be at least 18 years old, or the age of
          majority where you live, to use the Service.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Your data</LegalHeading>
        <LegalBody>
          You retain ownership of the data you enter. You grant us the limited
          right to store and process it solely to provide the Service to you.
          You are solely responsible for the content you save, including its
          accuracy and lawfulness. Enter only personal information that is
          necessary for your own use of the Service, and do not enter personal
          information about other people unless you have the right to do so. We
          accept no responsibility for the content you choose to save.
        </LegalBody>
        <LegalBody>
          The Service is not a backup service, and we do not guarantee that your
          data will be retained, available, or free from loss or corruption. You
          can export your data at any time from Settings &rarr; Your data, and
          you are responsible for keeping your own copies of anything you cannot
          afford to lose. Clearing data or deleting your account is permanent
          and cannot be undone. To the maximum extent permitted by law, we
          accept no liability for any loss of, damage to, or unauthorised access
          to data you store in the Service.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Intellectual property</LegalHeading>
        <LegalBody>
          The Service — its code, design, and content, other than the data you
          enter — belongs to us or our licensors. We grant you a personal,
          non-exclusive, non-transferable right to use it for managing your own
          finances. You may not copy, resell, or offer the Service to others as
          your own.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Acceptable use</LegalHeading>
        <LegalBody>
          You agree not to use the Service for any unlawful purpose, attempt to
          access other users&rsquo; data or accounts, probe or disrupt the
          Service or its infrastructure, or use automated means to scrape or
          overload it. We may suspend or terminate accounts that breach these
          terms.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Availability and changes to the Service</LegalHeading>
        <LegalBody>
          The Service is provided with no availability commitment. We may
          change, suspend, or discontinue any part of the Service at any time
          without notice. If we discontinue the Service entirely, we will make
          reasonable efforts to give you an opportunity to export your data
          first, but we are not obliged to do so.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>No warranty</LegalHeading>
        <LegalBody>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without any warranty of any kind, express or
          implied, including fitness for a particular purpose, accuracy, or
          uninterrupted or error-free operation, except where such warranties
          cannot be excluded by law.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Limitation of liability</LegalHeading>
        <LegalBody>
          Nothing in these terms excludes or limits liability for death or
          personal injury caused by negligence, for fraud or fraudulent
          misrepresentation, or for any other liability that cannot be excluded
          or limited under applicable law. Your statutory rights as a consumer
          are unaffected.
        </LegalBody>
        <LegalBody>
          Subject to the paragraph above, and to the maximum extent permitted by
          law: we are not liable for any indirect or consequential loss, loss of
          profit, or loss of, damage to, or corruption of data arising from your
          use of, or inability to use, the Service; and our total aggregate
          liability arising out of or in connection with the Service is limited
          to the amount you have paid us for it in the twelve months before the
          claim arose (which, while the Service is free, is nil).
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Termination</LegalHeading>
        <LegalBody>
          You may stop using the Service and delete your account at any time
          from Settings &rarr; Your data. We may suspend or terminate your
          access if you breach these terms or if we discontinue the Service.
          Sections of these terms that by their nature should survive
          termination (including &ldquo;Limitation of liability&rdquo;) do so.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Privacy</LegalHeading>
        <LegalBody>
          Our handling of personal data is described in the{" "}
          <LegalLink href="/privacy">Privacy Policy</LegalLink> and{" "}
          <LegalLink href="/cookies">Cookie Policy</LegalLink>, which form part
          of your agreement with us.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Changes to these terms</LegalHeading>
        <LegalBody>
          We may update these terms from time to time. Changes take effect when
          the updated terms are posted on this page with a new effective date.
          Continuing to use the Service after a change means you accept the
          updated terms; if you do not, stop using the Service and delete your
          account.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Governing law</LegalHeading>
        <LegalBody>
          These terms are governed by the law of England and Wales, and the
          courts of England and Wales have exclusive jurisdiction, except where
          the law of the country you live in provides otherwise for consumers.
        </LegalBody>
      </LegalSection>

      <LegalSection>
        <LegalHeading>Contact</LegalHeading>
        <LegalBody>
          Questions about these terms:{" "}
          <LegalAnchor href="mailto:hello@balanced.money">
            hello@balanced.money
          </LegalAnchor>
          .
        </LegalBody>
      </LegalSection>
    </LegalPage>
  );
}
