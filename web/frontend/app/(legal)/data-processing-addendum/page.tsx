import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Addendum — ThinkDeeper",
  description:
    "Supplemental terms governing ThinkDeeper's processing of personal data as a processor for customers.",
};

const dpaVersion = "1.0";

export default function DataProcessingAddendumPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold">Data Processing Addendum</h1>
        <p className="text-sm text-foreground/70">
          Version {dpaVersion} &middot; Effective date: March 1, 2025
        </p>
        <p>
          This Data Processing Addendum (&ldquo;DPA&rdquo;) supplements the Terms of Service (the
          &ldquo;Agreement&rdquo;) between ThinkDeeper (&ldquo;Processor&rdquo;) and the customer
          subscribing to the Services (&ldquo;Controller&rdquo;). Capitalized terms have the meanings
          set out in the Agreement unless otherwise defined in this DPA.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">1. Scope</h2>
        <p>
          This DPA applies to the extent ThinkDeeper processes Personal Data subject to the General
          Data Protection Regulation (EU) 2016/679 (&ldquo;GDPR&rdquo;), the UK GDPR, the California
          Consumer Privacy Act (CCPA), or other similar privacy laws on behalf of the Controller.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">2. Roles &amp; Responsibilities</h2>
        <p>
          Controller determines the purposes and means of processing Personal Data. Processor
          processes Personal Data only on documented instructions from Controller, including with
          respect to cross-border transfers, subject to this DPA and applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">3. Processing Instructions</h2>
        <p>
          Processor will process Personal Data solely to provide, maintain, and improve the Services,
          prevent or address technical and security issues, and comply with legal obligations. If
          Processor is required by law to process Personal Data beyond Controller instructions, it will
          inform Controller unless prohibited.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">4. Confidentiality</h2>
        <p>
          Processor ensures personnel with access to Personal Data are bound by confidentiality
          obligations and receive appropriate training on privacy and security requirements.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">5. Security</h2>
        <p>
          Processor implements technical and organizational measures to protect Personal Data against
          unauthorized or unlawful processing, accidental loss, destruction, or damage. Such measures
          include access controls, encryption in transit, audit logging, vulnerability management, and
          regular risk assessments.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">6. Subprocessors</h2>
        <p>
          Controller authorizes Processor to engage subprocessors necessary to deliver the Services,
          including hosting, data storage, analytics, customer support, and AI infrastructure vendors.
          Processor will ensure subprocessors are subject to obligations no less protective than this
          DPA and will remain liable for their performance. Processor will provide Controller with a
          list of current subprocessors upon request and notify Controller of material changes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">7. Data Subject Requests</h2>
        <p>
          Taking into account the nature of processing, Processor will assist Controller in responding
          to data subject requests to exercise their rights under applicable privacy laws. If a request
          is made directly to Processor, it will promptly notify Controller and await instructions,
          unless prohibited by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">8. Incident Response</h2>
        <p>
          Processor will notify Controller without undue delay after becoming aware of a Personal Data
          Breach. The notification will include reasonable details to enable Controller to comply with
          its own notification obligations. Processor will cooperate with Controller and take steps to
          remediate the incident.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">9. Data Transfers</h2>
        <p>
          Where Processor transfers Personal Data outside the originating jurisdiction, it will ensure
          appropriate safeguards are in place, such as Standard Contractual Clauses or an adequacy
          decision. Processor will assist Controller in ensuring compliance with cross-border transfer
          requirements.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">10. Audits</h2>
        <p>
          Upon reasonable written request and subject to confidentiality obligations, Processor will
          provide information necessary to demonstrate compliance with this DPA and allow for audits by
          Controller or an independent auditor, provided such audits occur no more than once per year
          and during normal business hours.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">11. Return or Deletion</h2>
        <p>
          Upon termination of the Services, Processor will delete or return Personal Data in accordance
          with Controller instructions and applicable law, unless retention is required by law. Processor
          may retain aggregated or anonymized data that does not identify Controller or data subjects.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">12. Liability</h2>
        <p>
          Each party&apos;s liability under this DPA is subject to the limitations set forth in the
          Agreement, except to the extent prohibited by applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">13. Conflict</h2>
        <p>
          If there is any inconsistency between the Agreement and this DPA, this DPA prevails to the
          extent of the conflict with respect to data protection obligations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">14. Contact</h2>
        <p>
          Data protection inquiries should be directed to{" "}
          <a className="underline" href="mailto:privacy@thinkdeeper.app">
            privacy@thinkdeeper.app
          </a>
          .
        </p>
      </section>
    </section>
  );
}
