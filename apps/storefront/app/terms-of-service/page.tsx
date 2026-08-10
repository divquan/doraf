import type { Metadata } from "next"
import { LegalSectionNav } from "@/components/legal-section-nav"
import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeader } from "@/components/marketing-header"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that apply when you use Dashchecker to buy or sell WAEC result checkers in Ghana.",
}

const sections = [
  ["about", "About Dashchecker"],
  ["definitions", "Key definitions"],
  ["accounts", "Accounts and access"],
  ["buyers", "Buying checkers"],
  ["payments", "Payments"],
  ["delivery", "Delivery and recovery"],
  ["refunds", "Refunds and replacements"],
  ["agents", "Agents and earnings"],
  ["withdrawals", "Withdrawals"],
  ["acceptable-use", "Acceptable use"],
  ["suspension", "Suspension and termination"],
  ["liability", "Disclaimers and liability"],
  ["changes", "Changes to these Terms"],
  ["law", "Governing law"],
  ["contact", "Contact"],
  ["privacy", "Data protection and privacy"],
] as const

export default function TermsOfServicePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border/70 bg-muted/35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_36%)]" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              The fine print, made readable
            </p>
            <h1 className="mt-5 max-w-3xl font-heading text-5xl leading-[1] font-semibold tracking-[-0.045em] text-balance sm:text-6xl">
              Terms of Service
            </h1>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>Last updated August 8, 2026</span>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <span>Applies to Dashchecker buyers and agents</span>
            </div>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
              These Terms explain the rules for using Dashchecker to buy or sell
              digital WAEC result checkers in Ghana. Please read them before you
              create an agent account or complete a purchase.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-16 lg:py-24">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="lg:hidden">
              <details className="group rounded-2xl border border-border/70 bg-card px-4">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                  On this page
                  <span className="text-lg font-normal text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <LegalSectionNav
                  label="Terms of Service sections"
                  sections={sections}
                />
              </details>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                On this page
              </p>
              <LegalSectionNav
                label="Terms of Service sections"
                sections={sections}
              />
            </div>
          </aside>

          <article className="max-w-3xl min-w-0 pb-[50vh]">
            <div className="mb-12 rounded-3xl bg-foreground px-6 py-7 text-background sm:px-8">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                Read this first
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-background/75 sm:text-base">
                Dashchecker is a platform operated by Kewry Limited. It helps
                independent agents sell checker products through personal
                storefront links and helps buyers receive purchased checkers by
                SMS and, where provided, email.
              </p>
            </div>

            <TermsSection id="about" number="1" title="About Dashchecker">
              <p>
                These Terms of Service (the &quot;Terms&quot;) govern your
                access to and use of the Dashchecker website, agent storefronts,
                checkout, buyer recovery tools, agent workspace, wallet ledger,
                and related services (together, the &quot;Platform&quot;).
              </p>
              <p>
                The Platform is operated by Kewry Limited (the
                &quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or
                &quot;our&quot;). By accessing or using the Platform, you agree
                to these Terms. If you do not agree, do not use the Platform.
              </p>
              <p>
                Dashchecker is not WAEC, Paystack, a Mobile Money network, or a
                government body. Any third-party names and marks belong to their
                respective owners.
              </p>
            </TermsSection>

            <TermsSection id="definitions" number="2" title="Key definitions">
              <Definition term="Agent">
                An individual who has registered to sell checker products
                through a Dashchecker storefront.
              </Definition>
              <Definition term="Buyer">
                A person who purchases a checker through an Agent&apos;s
                storefront or another Dashchecker checkout.
              </Definition>
              <Definition term="Checker">
                A digital WAEC result-checking voucher containing the serial and
                PIN supplied for a supported examination type.
              </Definition>
              <Definition term="Margin">
                The difference between the effective platform base price and the
                retail price that an Agent is permitted to set for a completed
                sale.
              </Definition>
              <Definition term="Wallet">
                The internal Platform ledger that records an Agent&apos;s sales
                earnings, holds, fees, payouts, reversals, and adjustments. It
                is not a bank account, deposit account, or general-purpose
                electronic-money account.
              </Definition>
              <Definition term="Manual payout">
                A payout approved by an Administrator and paid outside the
                Paystack transfer workflow, after which the Administrator
                records the payment reference and confirms the amount in the
                Platform.
              </Definition>
            </TermsSection>

            <TermsSection id="accounts" number="3" title="Accounts and access">
              <p>
                Agents must be individuals located in Ghana who are at least 18
                years old, or otherwise have the legal capacity required to
                enter into these Terms. Registration requires a valid Ghana
                phone number. We may request additional information or evidence
                where necessary for security, fraud prevention, compliance, or
                payout review.
              </p>
              <p>
                Buyers do not need to create a formal account. A Buyer must,
                however, provide accurate delivery details, including a phone
                number and, if chosen, an email address.
              </p>
              <p>
                Keep your phone, OTPs, recovery codes, and other account access
                details private. You are responsible for activity carried out
                through your account. Tell us promptly if you believe your
                account or OTP has been exposed.
              </p>
            </TermsSection>

            <TermsSection id="buyers" number="4" title="Buying checkers">
              <p>
                Before paying, review the checker product, supported examination
                type, quantity, price, and delivery details. Each checker
                supports three result checks for one candidate and examination
                year after first use. A checker must only be used for the
                examination scope shown for that product.
              </p>
              <p>
                Once an order is created, its price and delivery destination are
                fixed. Check the phone number and optional email address
                carefully before confirming. Dashchecker may not be able to
                redirect a checker sent to details entered incorrectly by the
                Buyer.
              </p>
              <p>
                An order is subject to product availability and successful
                payment verification. Creating an order or seeing a payment
                window does not, by itself, mean that a purchase has been
                completed.
              </p>
            </TermsSection>

            <TermsSection id="payments" number="5" title="Payments">
              <p>
                Payment details are collected through Paystack&apos;s hosted
                checkout. Mobile Money is the current payment method offered by
                the Platform, but available payment methods may change.
              </p>
              <p>
                Dashchecker confirms payment on the server by checking the
                provider result against the expected order reference, amount,
                and currency. A browser callback or an apparent success message
                alone does not complete an order.
              </p>
              <p>
                We may investigate and correct duplicate charges, incorrect
                amounts, payment reversals, chargebacks, or other disputed
                transactions. Where a payment is reversed or disputed, we may
                delay delivery, suspend related earnings, reverse an Agent
                credit, or apply an amount against future earnings while the
                matter is reviewed.
              </p>
            </TermsSection>

            <TermsSection
              id="delivery"
              number="6"
              title="Delivery and recovery"
            >
              <p>
                After successful payment verification, Dashchecker creates the
                checker delivery process. SMS delivery to the confirmed phone
                number is required. A Buyer may also provide an email address
                for an additional delivery channel.
              </p>
              <p>
                Delivery attempts may be retried when a network or provider
                error occurs. A delivery problem does not automatically cancel a
                paid order or return a sold checker to inventory.
              </p>
              <p>
                If you paid but cannot find your checker, use the buyer recovery
                flow with your order reference and the delivery phone number. If
                recovery does not resolve the issue, contact
                <a href="mailto:support@dashchecker.com">
                  support@dashchecker.com
                </a>
                with the order reference. Never send your PIN in a support
                message.
              </p>
            </TermsSection>

            <TermsSection
              id="refunds"
              number="7"
              title="Refunds and replacements"
            >
              <p>
                Because checkers are digital credentials, a valid checker that
                has been delivered or used is generally not eligible for a
                refund, exchange, or replacement. This does not limit any
                consumer right that cannot lawfully be excluded.
              </p>
              <p>
                If payment succeeded but a valid checker was not delivered, we
                will investigate the order and may provide replacement inventory
                or a refund where the order cannot be fulfilled. Duplicate
                charges, irrecoverably unfulfilled paid orders, and other
                payment errors are reviewed individually.
              </p>
              <p>
                A replacement or refund may not be available where the wrong
                product was selected, the delivery details were entered
                incorrectly, the checker has already been exposed or used, or
                the issue resulted from an unsupported use of the checker.
              </p>
            </TermsSection>

            <TermsSection id="agents" number="8" title="Agents and earnings">
              <p>
                An Agent is an independent seller, not an employee, partner,
                representative, or legal agent of Kewry Limited. An Agent may
                not make commitments on our behalf, describe themselves as WAEC
                or Paystack, or claim to have authority that they do not have.
              </p>
              <p>
                Agents may set retail prices only within the effective pricing
                range and other rules shown by the Platform. Dashchecker may set
                or adjust minimum and maximum retail-price rules, including
                temporary maximum caps during peak WAEC seasons or other
                periods, to prevent predatory or excessive pricing. Agents must
                follow the limits shown in the Platform at the time of each
                sale.
              </p>
              <p>
                Agents are responsible for truthful marketing, lawful
                communications, and the claims they make to prospective Buyers.
              </p>
              <p>
                A verified, completed sale may credit the Agent&apos;s Margin to
                the Wallet. A delivery retry or delivery failure does not by
                itself remove a valid sale credit. Refunds, payment reversals,
                chargebacks, fraud findings, corrections, fees, or other valid
                adjustments may create a debit or reduce the amount available
                for withdrawal.
              </p>
              <p>
                The Wallet cannot be topped up, used to pay for unrelated goods
                or services, transferred to another user, or treated as a
                deposit or investment account. Agents are responsible for
                understanding and meeting their own tax obligations. Dashchecker
                will not withhold taxes on an Agent&apos;s behalf unless
                required by applicable law or mandated by the Ghana Revenue
                Authority (GRA).
              </p>
            </TermsSection>

            <TermsSection id="withdrawals" number="9" title="Withdrawals">
              <p>
                Agents may request a withdrawal of eligible Wallet earnings to
                their registered Ghana Mobile Money number and selected network.
                The request must pass the Platform&apos;s eligibility checks and
                a fresh SMS OTP verification. The GHS 1 withdrawal fee applies
                to both Paystack and manual payouts.
              </p>
              <p>
                Every withdrawal is subject to Administrator approval. When
                approving a withdrawal, the Administrator may choose either:
              </p>
              <ul>
                <li>
                  <strong>Paystack transfer:</strong> the approved payout is
                  submitted through the applicable Paystack transfer workflow
                  and remains subject to provider processing and status updates.
                </li>
                <li>
                  <strong>Manual payout:</strong> the Administrator pays the
                  Agent outside the Paystack transfer workflow, then records a
                  transaction reference and confirms the exact approved net
                  amount in the Platform.
                </li>
              </ul>
              <p>
                The payout amount and fee are held against the Wallet while the
                withdrawal is pending. A pending manual payout may be cancelled
                by an Administrator, which releases the hold. A confirmed manual
                payout is recorded as paid and is terminal in the current
                workflow; manual payout reversals are not currently supported.
              </p>
              <p>
                We do not guarantee immediate payout. We may delay, reject,
                cancel, or place a hold on a withdrawal for security review,
                insufficient eligible funds, payment reversal exposure, provider
                limits, inaccurate destination details, suspected fraud, or
                legal and compliance reasons.
              </p>
            </TermsSection>

            <TermsSection
              id="acceptable-use"
              number="10"
              title="Acceptable use"
            >
              <p>You must not:</p>
              <ul>
                <li>
                  use the Platform for fraud, deception, or unlawful activity;
                </li>
                <li>
                  bypass, probe, reverse engineer, or manipulate the payment,
                  wallet, inventory, delivery, or recovery systems;
                </li>
                <li>
                  share or expose unused checker credentials, OTPs, or another
                  person&apos;s private information;
                </li>
                <li>
                  impersonate WAEC, Dashchecker, Paystack, Kewry Limited, an
                  Agent, or another person or organization;
                </li>
                <li>
                  use false, misleading, abusive, or spam marketing to promote a
                  storefront;
                </li>
                <li>
                  upload malware, interfere with the Platform, or access
                  accounts and data that are not yours; or
                </li>
                <li>
                  use a checker outside its supported examination scope or usage
                  limits.
                </li>
              </ul>
            </TermsSection>

            <TermsSection
              id="suspension"
              number="11"
              title="Suspension and termination"
            >
              <p>
                We may limit, suspend, or terminate access to the Platform when
                we reasonably believe that these Terms have been breached, an
                account presents a security or fraud risk, a payment is
                disputed, or action is needed to comply with law or a provider
                requirement.
              </p>
              <p>
                We may also place a temporary hold on an Agent&apos;s Wallet or
                withdrawal while reviewing refunds, reversals, chargebacks,
                delivery disputes, security issues, or other outstanding
                exposure. We will aim to release legitimate, undisputed amounts
                after the relevant review or hold period, subject to applicable
                law and valid adjustments.
              </p>
              <p>
                You may stop using the Platform at any time. Ending use does not
                remove obligations that arose before termination, including
                payment disputes, confidentiality, acceptable-use obligations,
                and amounts properly owed.
              </p>
            </TermsSection>

            <TermsSection
              id="liability"
              number="12"
              title="Disclaimers and liability"
            >
              <p>
                The Platform is provided on an &quot;as available&quot; basis.
                We work to keep it reliable, but access may be interrupted by
                maintenance, internet connectivity, Mobile Money networks,
                Paystack, SMS or email providers, hosting providers, WAEC
                systems, or events outside our reasonable control.
              </p>
              <p>
                We take reasonable steps to source and manage checker inventory,
                but we do not guarantee uninterrupted access to a third-party
                verification portal or a result outcome. If a checker is invalid
                or a paid order cannot be fulfilled because of a Platform issue,
                contact support so we can investigate and provide an appropriate
                remedy under these Terms.
              </p>
              <p>
                To the maximum extent permitted by Ghanaian law, Kewry Limited
                will not be liable for indirect, incidental, special,
                consequential, or punitive loss arising from your use of the
                Platform. Nothing in these Terms excludes liability or a
                consumer right that cannot lawfully be excluded.
              </p>
            </TermsSection>

            <TermsSection
              id="changes"
              number="13"
              title="Changes to these Terms"
            >
              <p>
                We may update these Terms when the Platform, law, provider
                requirements, or our operating practices change. We will publish
                the updated version with a new &quot;Last updated&quot; date and
                may notify Agents through the Platform or by SMS when a change
                is material.
              </p>
              <p>
                The updated Terms apply from their stated effective date. If you
                do not agree with a change, stop using the Platform. Continued
                use after the effective date means you accept the updated Terms
                to the extent permitted by law.
              </p>
            </TermsSection>

            <TermsSection id="law" number="14" title="Governing law">
              <p>
                These Terms are governed by the laws of the Republic of Ghana.
                Subject to any mandatory consumer protections or dispute process
                that applies, disputes relating to the Platform will be handled
                by the courts of Ghana.
              </p>
            </TermsSection>

            <TermsSection id="contact" number="15" title="Contact">
              <p>
                For questions about a purchase, delivery issue, withdrawal, or
                these Terms, contact Dashchecker at
                <a href="mailto:support@dashchecker.com">
                  support@dashchecker.com
                </a>
                . Include your order reference or Agent phone number where
                relevant, but do not include checker PINs or OTPs in your
                message.
              </p>
              <p>
                Kewry Limited may publish additional legal or operational
                notices through the Platform when a matter requires more detail
                than these Terms provide.
              </p>
            </TermsSection>

            <TermsSection
              id="privacy"
              number="16"
              title="Data protection and privacy"
            >
              <p>
                Dashchecker collects and uses personal data such as phone
                numbers, email addresses, order details, delivery details,
                account information, payout details, and security records to
                operate and protect the Platform. We use reasonable technical
                and organisational safeguards to protect this information
                against unauthorised access, loss, misuse, or disclosure.
              </p>
              <p>
                We handle personal data in accordance with applicable Ghanaian
                data protection requirements, including the Data Protection Act,
                2012 (Act 843), and our separate
                <a href="/privacy-policy">Privacy Policy</a>. The Privacy Policy
                explains what information we collect, why we collect it, the
                providers who help us deliver the Platform, how long we retain
                it, and the rights and choices available to data subjects.
              </p>
              <p>
                The Privacy Policy is a separate document and should be read
                before using the Platform. It will be published at
                <a href="/privacy-policy">
                  dashchecker.com/privacy-policy
                </a>{" "}
                once available.
              </p>
            </TermsSection>
          </article>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}

function TermsSection({
  children,
  id,
  number,
  title,
}: {
  children: React.ReactNode
  id: string
  number: string
  title: string
}) {
  return (
    <section
      className="scroll-mt-8 border-t border-border/70 pt-10 first:border-t-0 first:pt-0"
      id={id}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-primary tabular-nums">
          {number}
        </span>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h2>
      </div>
      <div className="mt-5 space-y-4 text-[0.98rem] leading-7 text-pretty text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  )
}

function Definition({
  children,
  term,
}: {
  children: React.ReactNode
  term: string
}) {
  return (
    <p>
      <strong>{term}:</strong> {children}
    </p>
  )
}
