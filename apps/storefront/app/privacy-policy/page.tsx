import type { Metadata } from "next"
import { LegalSectionNav } from "@/components/legal-section-nav"
import { MarketingFooter } from "@/components/marketing-footer"
import { MarketingHeader } from "@/components/marketing-header"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Dashchecker collects, uses, shares, and protects personal data for buyers, agents, and website visitors.",
}

const sections = [
  ["scope", "Who we are and what this covers"],
  ["collect", "Information we collect"],
  ["use", "How we use information"],
  ["share", "How we share information"],
  ["payments", "Payments and Paystack"],
  ["security", "Security"],
  ["retention", "Data retention"],
  ["transfers", "International processing"],
  ["cookies", "Cookies and similar technologies"],
  ["rights", "Your rights and choices"],
  ["children", "Children and young buyers"],
  ["incidents", "Security incidents"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact and complaints"],
] as const

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MarketingHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border/70 bg-muted/35">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_36%)]" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Your data, in plain language
            </p>
            <h1 className="mt-5 max-w-3xl font-heading text-5xl leading-[1] font-semibold tracking-[-0.045em] text-balance sm:text-6xl">
              Privacy Policy
            </h1>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>Last updated August 9, 2026</span>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <span>Applies to buyers, agents, and website visitors</span>
            </div>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl">
              This policy explains what personal data Dashchecker collects, why
              we need it, who helps us process it, and the choices available to
              you.
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
                  label="Privacy Policy sections"
                  sections={sections}
                />
              </details>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                On this page
              </p>
              <LegalSectionNav
                label="Privacy Policy sections"
                sections={sections}
              />
            </div>
          </aside>

          <article className="max-w-3xl min-w-0 pb-[50vh]">
            <div className="mb-12 rounded-3xl bg-foreground px-6 py-7 text-background sm:px-8">
              <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                The short version
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-background/75 sm:text-base">
                We collect the information needed to create agent accounts, take
                orders, deliver checkers, process withdrawals, provide support,
                and keep the Platform safe. We do not sell personal data, and we
                do not store Mobile Money PINs, card numbers, CVVs, or full
                payment credentials.
              </p>
            </div>

            <PrivacySection
              id="scope"
              number="1"
              title="Who we are and what this covers"
            >
              <p>
                Dashchecker is operated by Kewry Limited (the
                &quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or
                &quot;our&quot;). For personal data where we decide why and how
                it is processed, Kewry Limited is the data controller.
              </p>
              <p>
                This Privacy Policy applies to the Dashchecker website, public
                agent storefronts, web checkout, buyer recovery tools, agent
                workspace, and support services. It applies to Dashchecker
                buyers, agents, and people who browse the website.
              </p>
              <p>
                USSD is not part of the current public MVP. If Dashchecker
                introduces a USSD channel, we will update this policy before
                using personal data through that channel.
              </p>
              <p>
                This policy should be read with our
                <a href="/terms-of-service">Terms of Service</a> and any notices
                shown at the point where information is collected. Our practices
                are intended to follow the Data Protection Act, 2012 (Act 843)
                and guidance from the
                <a
                  href="https://dataprotection.org.gh/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Ghana Data Protection Commission
                </a>
                .
              </p>
            </PrivacySection>

            <PrivacySection
              id="collect"
              number="2"
              title="Information we collect"
            >
              <p>
                We collect information that is reasonably necessary for the
                purpose explained at the time of collection. The information we
                collect depends on whether you are an Agent, a Buyer, a visitor,
                or someone contacting support.
              </p>

              <PrivacySubheading>From Agents</PrivacySubheading>
              <ul>
                <li>
                  <strong>Account information:</strong> your name, registered
                  Ghana phone number, account status, OTP challenge metadata,
                  and account timestamps.
                </li>
                <li>
                  <strong>Storefront information:</strong> your permanent sales
                  link, store name, tagline, logo or banner you choose to
                  upload, pricing settings, announcement text, theme selection,
                  and any WhatsApp contact number you choose to display.
                </li>
                <li>
                  <strong>Earnings and payout information:</strong> sales,
                  margins, Wallet ledger entries, withdrawal requests,
                  registered Mobile Money number and network, payout status,
                  transaction references, and related audit records.
                </li>
                <li>
                  <strong>Security information:</strong> sign-in and withdrawal
                  events, session metadata, recovery evidence, and records
                  needed to investigate abuse or disputes.
                </li>
              </ul>

              <PrivacySubheading>From Buyers</PrivacySubheading>
              <ul>
                <li>
                  <strong>Delivery information:</strong> the required phone
                  number for SMS delivery and the optional email address you
                  provide for additional delivery.
                </li>
                <li>
                  <strong>Order information:</strong> order reference,
                  storefront attribution, product, quantity, price, payment
                  status, delivery status, and checker allocation records.
                </li>
                <li>
                  <strong>Recovery and support information:</strong> information
                  you provide when recovering a purchase, reporting a delivery
                  problem, or asking us to investigate a dispute.
                </li>
              </ul>

              <PrivacySubheading>From visitors and devices</PrivacySubheading>
              <ul>
                <li>
                  <strong>Technical data:</strong> IP address, browser and
                  device type, operating system, language, timestamps, referring
                  page, and basic security signals.
                </li>
                <li>
                  <strong>Operational logs:</strong> page and checkout events,
                  failed requests, error details, rate-limit events, and other
                  information needed to keep the Platform available and secure.
                </li>
              </ul>

              <PrivacySubheading>Information from providers</PrivacySubheading>
              <p>
                We receive payment references, status events, transfer results,
                and other limited transaction metadata from Paystack. We may
                also receive delivery status and provider message references
                from SMS or email providers. These providers may collect
                additional information directly under their own privacy notices.
              </p>
            </PrivacySection>

            <PrivacySection id="use" number="3" title="How we use information">
              <p>We use personal data for the following purposes:</p>
              <ul>
                <li>
                  <strong>Provide the Platform:</strong> create and secure Agent
                  accounts, publish storefronts, attribute sales, maintain the
                  Wallet ledger, and operate buyer recovery.
                </li>
                <li>
                  <strong>Complete purchases:</strong> create orders, confirm
                  payment, allocate checkers, and deliver them to the
                  destination confirmed at checkout.
                </li>
                <li>
                  <strong>Process withdrawals:</strong> verify requests, apply
                  holds and fees, process Paystack transfers, record manual
                  payouts, and maintain an auditable payout history.
                </li>
                <li>
                  <strong>Communicate:</strong> send sign-in and withdrawal
                  OTPs, order and delivery notifications, recovery messages,
                  security alerts, and important Platform updates.
                </li>
                <li>
                  <strong>Support and disputes:</strong> locate orders,
                  investigate failed delivery, resolve payment disputes, and
                  assess replacement or refund requests without exposing checker
                  secrets unnecessarily.
                </li>
                <li>
                  <strong>Security and fraud prevention:</strong> detect abuse,
                  protect accounts and payment flows, investigate suspicious
                  activity, and enforce our Terms.
                </li>
                <li>
                  <strong>Legal and operational obligations:</strong> maintain
                  accounting, tax, audit, compliance, and business records, and
                  respond to lawful requests.
                </li>
                <li>
                  <strong>Improve the Platform:</strong> understand aggregate
                  usage, troubleshoot errors, improve reliability, and evaluate
                  product performance. We do not use buyer contact details for
                  advertising by default.
                </li>
              </ul>
            </PrivacySection>

            <PrivacySection
              id="share"
              number="4"
              title="How we share information"
            >
              <p>
                We do not sell, rent, or trade personal data. We share only the
                information needed for the purpose described below and require
                service providers to handle it under appropriate instructions
                and safeguards.
              </p>
              <ul>
                <li>
                  <strong>Payment and transfer providers:</strong> Paystack for
                  hosted checkout, payment verification, and eligible Agent
                  transfers.
                </li>
                <li>
                  <strong>Messaging providers:</strong> SMS and email providers
                  for OTPs, checker delivery, recovery, and transactional
                  notices.
                </li>
                <li>
                  <strong>Infrastructure providers:</strong> hosting, databases,
                  encrypted object storage, monitoring, security, and support
                  tools that help us operate the Platform.
                </li>
                <li>
                  <strong>Professional advisers:</strong> auditors, accountants,
                  lawyers, insurers, or other advisers where access is necessary
                  and appropriately restricted.
                </li>
                <li>
                  <strong>Authorities and other parties:</strong> courts,
                  regulators, law-enforcement bodies, or other parties where
                  disclosure is required by law, legal process, or necessary to
                  protect people, property, or the Platform.
                </li>
                <li>
                  <strong>Business changes:</strong> a successor or adviser in a
                  merger, acquisition, financing, restructuring, or sale of part
                  of the business, subject to applicable confidentiality
                  obligations.
                </li>
              </ul>
              <p>
                We do not share checker serials or PINs in ordinary logs,
                analytics, URLs, or routine support views. Access to sensitive
                voucher data is limited and audited.
              </p>
            </PrivacySection>

            <PrivacySection
              id="payments"
              number="5"
              title="Payments and Paystack"
            >
              <p>
                Dashchecker uses Paystack&apos;s hosted payment collection.
                Paystack may collect the payer&apos;s Mobile Money or other
                payment details directly in its checkout and processes them
                under its own privacy terms. Dashchecker does not ask for or
                store Mobile Money PINs, card numbers, CVVs, or full payment
                credentials.
              </p>
              <p>
                To initialize and reconcile a payment, Dashchecker may send
                Paystack the order amount, currency, reference, and a provider
                contact value. For guest web checkout, the provider email can be
                a synthetic merchant-controlled value generated from the
                normalized delivery phone; it is not treated as the Buyer&apos;s
                email address.
              </p>
              <p>
                Dashchecker receives and retains limited payment and transfer
                metadata, such as references, status, amount, currency, provider
                identifiers, and timestamps. We use this information to verify
                transactions, fulfill orders, reconcile transfers, and
                investigate disputes.
              </p>
            </PrivacySection>

            <PrivacySection id="security" number="6" title="Security">
              <p>
                We use reasonable technical and organisational measures
                appropriate to the sensitivity of the information and the risks
                of processing. These measures include, where applicable:
              </p>
              <ul>
                <li>HTTPS and encrypted network connections;</li>
                <li>
                  encryption and protected handling for sensitive contact and
                  voucher data;
                </li>
                <li>
                  one-way OTP verification records rather than storing raw OTP
                  values;
                </li>
                <li>
                  server-side payment verification, idempotency, rate limits,
                  and abuse controls;
                </li>
                <li>
                  access controls, least-privilege support tools, and audit
                  trails for sensitive actions; and
                </li>
                <li>
                  monitoring, incident response, secret management, and backup
                  protection appropriate to the service.
                </li>
              </ul>
              <p>
                No internet service can be guaranteed completely secure. Protect
                your phone, sessions, OTPs, and recovery information, and
                contact us immediately if you suspect unauthorised access.
              </p>
            </PrivacySection>

            <PrivacySection id="retention" number="7" title="Data retention">
              <p>
                We retain personal data only for as long as it is reasonably
                needed for the purpose collected, including to provide the
                Platform, resolve disputes, protect against fraud, maintain
                financial records, meet legal obligations, and enforce
                agreements.
              </p>
              <ul>
                <li>
                  <strong>Agent records:</strong> kept while the account is
                  active and afterward where needed for sales, Wallet, payout,
                  tax, audit, security, or legal records.
                </li>
                <li>
                  <strong>Buyer records:</strong> order, delivery, payment, and
                  recovery records kept for fulfillment, support, disputes,
                  reconciliation, and required record keeping.
                </li>
                <li>
                  <strong>Security records:</strong> OTP challenge metadata,
                  audit events, and operational logs retained for periods
                  appropriate to security investigations and compliance.
                </li>
                <li>
                  <strong>Support evidence:</strong> retained only as long as
                  needed to resolve the issue, document the decision, or meet a
                  legal or audit requirement.
                </li>
              </ul>
              <p>
                When data is no longer needed, we delete it, anonymise it, or
                place it beyond ordinary operational use, subject to lawful
                retention requirements and technical backup cycles.
              </p>
            </PrivacySection>

            <PrivacySection
              id="transfers"
              number="8"
              title="International processing"
            >
              <p>
                Some providers that help us operate Dashchecker may process
                personal data outside Ghana. Where this happens, we share only
                what is necessary for the service and use appropriate
                contractual, organisational, and technical safeguards required
                by applicable law. Provider privacy notices may explain their
                own locations and processing practices in more detail.
              </p>
            </PrivacySection>

            <PrivacySection
              id="cookies"
              number="9"
              title="Cookies and similar technologies"
            >
              <p>
                Dashchecker may use strictly necessary cookies or similar
                storage for session continuity, security, fraud prevention, and
                basic site preferences such as theme settings. These
                technologies help the Platform work and are not used to sell
                your information.
              </p>
              <p>
                We may use limited, aggregated operational measurement to
                understand reliability and improve the experience. If we
                introduce optional analytics or marketing technologies that
                require a separate choice, we will provide the relevant notice
                and controls before using them.
              </p>
              <p>
                You can manage cookies through your browser settings. Blocking
                strictly necessary cookies may prevent sign-in, checkout,
                recovery, or other parts of the Platform from working correctly.
              </p>
            </PrivacySection>

            <PrivacySection
              id="rights"
              number="10"
              title="Your rights and choices"
            >
              <p>
                Subject to the Data Protection Act, 2012 (Act 843), you may have
                the right to:
              </p>
              <ul>
                <li>
                  <strong>Access:</strong> ask whether we process your personal
                  data, what we hold, why we use it, and the recipients or
                  categories of recipients who may receive it.
                </li>
                <li>
                  <strong>Correct:</strong> ask us to update inaccurate or
                  incomplete information.
                </li>
                <li>
                  <strong>Object or restrict:</strong> ask us to stop or limit a
                  particular use where the law gives you that right.
                </li>
                <li>
                  <strong>Withdraw optional consent:</strong> change your choice
                  for optional communications or processing based on consent.
                  Critical transactional and security messages may still be sent
                  when needed to provide the service.
                </li>
                <li>
                  <strong>Request deletion:</strong> ask us to delete
                  information where it is no longer needed or where the law
                  permits, subject to legal, accounting, security, and
                  dispute-retention obligations.
                </li>
                <li>
                  <strong>Complain:</strong> contact the Ghana Data Protection
                  Commission if you believe your data has been mishandled.
                </li>
              </ul>
              <p>
                To make a request, email
                <a href="mailto:support@dashchecker.com?subject=Privacy%20request">
                  support@dashchecker.com
                </a>
                with the subject &quot;Privacy request&quot;. We may ask for
                information needed to verify your identity and protect another
                person&apos;s data. We will respond within the timeframe
                required by applicable law or, where no specific timeframe
                applies, within a reasonable period.
              </p>
            </PrivacySection>

            <PrivacySection
              id="children"
              number="11"
              title="Children and young buyers"
            >
              <p>
                Agent accounts are intended for people who are at least 18 years
                old or otherwise have the legal capacity required to use the
                service. Dashchecker may be used to purchase education-related
                checkers for a student by a parent, guardian, school, or other
                authorised adult.
              </p>
              <p>
                If you believe a child has provided personal data to Dashchecker
                without appropriate authorisation, contact us at
                <a href="mailto:support@dashchecker.com">
                  support@dashchecker.com
                </a>
                so we can review the situation and take appropriate action.
              </p>
            </PrivacySection>

            <PrivacySection
              id="incidents"
              number="12"
              title="Security incidents"
            >
              <p>
                If we discover a security compromise involving personal data, we
                will investigate, contain, and remediate it. Where required by
                applicable law, we will notify the Ghana Data Protection
                Commission and affected data subjects, and we may also notify
                relevant providers or authorities.
              </p>
              <p>
                We may contact you using the contact details associated with the
                affected account or order. Keep those details current and do not
                include OTPs or checker PINs when reporting an incident.
              </p>
            </PrivacySection>

            <PrivacySection
              id="changes"
              number="13"
              title="Changes to this policy"
            >
              <p>
                We may update this policy when our data practices, Platform
                features, providers, or legal requirements change. We will
                update the date at the top of this page and publish the new
                version here. If a change materially affects how we use personal
                data, we may also notify Agents through the Platform or by SMS
                and provide any additional choice required by law.
              </p>
            </PrivacySection>

            <PrivacySection
              id="contact"
              number="14"
              title="Contact and complaints"
            >
              <p>
                For privacy questions, access or correction requests, deletion
                requests, or concerns about how we handle your data, contact:
              </p>
              <div className="rounded-2xl bg-muted/60 p-5">
                <p className="font-semibold text-foreground">Kewry Limited</p>
                <p className="mt-1 text-muted-foreground">
                  Email:{" "}
                  <a href="mailto:support@dashchecker.com">
                    support@dashchecker.com
                  </a>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Subject line: Privacy request
                </p>
              </div>
              <p>
                You may also contact the
                <a
                  href="https://dataprotection.org.gh/for-individuals/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Ghana Data Protection Commission
                </a>
                if you believe your rights under Act 843 have been infringed.
              </p>
            </PrivacySection>
          </article>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}

function PrivacySection({
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
      <div className="mt-5 space-y-4 text-[0.98rem] leading-7 text-pretty text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}

function PrivacySubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-3 font-heading text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h3>
  )
}
