import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Thinkle",
  description:
    "Learn how Thinkle, operated by 3RZ d.o.o., collects, uses, and protects your personal information across the app and API.",
};

const supportEmail = "rene@3rz.eu";
const mailingAddress = "3RZ d.o.o., Suzanicev put 35, 51221 Kostrena, Croatia";

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="text-sm text-foreground/70">Effective date: March 1, 2025</p>
        <p>
          Thinkle (&ldquo;Thinkle,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), operated by
          3RZ d.o.o., provides a daily thinking trainer that delivers reflections, evaluates responses with
          AI, and tracks personal progress. This Privacy Policy explains how we collect, use, share, and
          protect information when you use our website, mobile experiences, or FastAPI backend
          (collectively, the &ldquo;Services&rdquo;).
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Information We Collect</h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong>Account and profile data.</strong> Name, email, password hash, avatar, timezone,
            and learning goals that you choose to provide.
          </li>
          <li>
            <strong>Content submissions.</strong> Answers to guided reflections, attachments, and
            feedback you generate through the Services. We treat this as user-generated content.
          </li>
          <li>
            <strong>Usage and device signals.</strong> Log data (IP address, browser type, referring
            URLs, pages viewed, approximate location, timestamps), crash reports, and diagnostic
            events that help us maintain and secure the Services.
          </li>
          <li>
            <strong>Cookies and local storage.</strong> Session tokens, preference flags, and
            analytics identifiers stored in your browser when you consent.
          </li>
          <li>
            <strong>Third-party sources.</strong> If you connect services (e.g., Google or Apple for
            sign-in), we receive the basic profile data they make available under your authorization.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">How We Use Information</h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>Authenticate you and deliver core product functionality.</li>
          <li>Generate guided reflections, evaluate answers, and serve personalized insights.</li>
          <li>Improve the effectiveness, safety, and reliability of the Services.</li>
          <li>Provide customer support and respond to requests.</li>
          <li>Monitor for fraud, abuse, and violations of our Terms of Service.</li>
          <li>Comply with legal obligations and enforce our agreements.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Legal Bases for Processing (EEA/UK)</h2>
        <p>
          When applicable laws require a legal basis, we process personal data under the following
          grounds: (a) your consent, (b) performance of a contract (providing the Services),
          (c) legitimate interests (maintaining and improving the Services, securing our systems),
          and (d) compliance with legal obligations.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">How We Share Information</h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong>Vendors and service providers.</strong> Hosting, storage, analytics, customer
            support, security tooling, and communication platforms that help us operate the Services.
          </li>
          <li>
            <strong>AI model providers.</strong> Third-party LLM vendors (such as OpenAI) process
            reflection/response content to deliver feedback and scoring.
          </li>
          <li>
            <strong>Business transfers.</strong> In connection with a merger, acquisition, financing,
            or sale of assets, provided the recipient honors this Policy.
          </li>
          <li>
            <strong>Legal requirements.</strong> If required by law, subpoena, or government request,
            or to protect rights, property, and safety.
          </li>
          <li>
            <strong>With your direction.</strong> We share data with third parties when you ask us to
            or authorize integrations.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">International Data Transfers</h2>
        <p>
          Our infrastructure may be located in the United States and other jurisdictions. When we
          transfer personal data internationally, we rely on appropriate safeguards such as Standard
          Contractual Clauses, data processing agreements, or an adequacy decision where available.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Data Retention</h2>
        <p>
          We keep personal data for as long as needed to provide the Services, comply with legal
          obligations, resolve disputes, and enforce agreements. Content you submit may be retained
          until you delete it or close your account unless law requires longer retention.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Your Rights and Choices</h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            Access, correct, or delete your data via in-product settings or by contacting us.
          </li>
          <li>Withdraw consent for optional processing (analytics, marketing) at any time.</li>
          <li>Opt out of marketing emails by using the unsubscribe link or contacting support.</li>
          <li>
            Request data portability or restriction of processing where applicable under GDPR/UK GDPR.
          </li>
          <li>Lodge a complaint with your local data protection authority.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Children</h2>
        <p>
          The Services are not directed to individuals under the age of 13 (or the minimum age in
          your jurisdiction). We do not knowingly collect personal data from children. If you believe
          a child provided data, contact us and we will take steps to delete it.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Security</h2>
        <p>
          We implement administrative, technical, and physical safeguards to protect personal data.
          Despite these measures, no system is perfectly secure, and we cannot guarantee absolute
          security.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the revised version and
          update the effective date. If changes materially impact your rights, we will provide notice
          (e.g., via email or in-app notification) and obtain consent where required.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Contact Us</h2>
        <p>
          For privacy requests, contact us at{" "}
          <a className="underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>{" "}
          or by mail at {mailingAddress}. You may also submit a data subject request through your
          account dashboard if available.
        </p>
      </section>
    </section>
  );
}
