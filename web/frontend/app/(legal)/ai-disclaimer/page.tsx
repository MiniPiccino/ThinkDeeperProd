import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI & Content Disclaimer — ThinkDeeper",
  description: "Important information about AI-generated content and responsibility when using ThinkDeeper.",
};

export default function AIDisclaimerPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold">AI &amp; Content Disclaimer</h1>
        <p className="text-sm text-foreground/70">Effective date: March 1, 2025</p>
        <p>
          ThinkDeeper uses large language models and other machine learning techniques to deliver
          feedback, reflections, and guidance. We strive to provide accurate and supportive insights,
          but AI-generated output can contain errors, omissions, or biased results.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">No Professional Advice</h2>
        <p>
          The Services do not provide medical, psychological, legal, financial, or other professional
          advice. AI-generated content should not be relied upon as a substitute for professional
          judgment. If you need expert guidance, consult a qualified professional.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">User Responsibility</h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>Review AI feedback critically before acting on it.</li>
          <li>Do not submit sensitive personal data, health information, or confidential business materials.</li>
          <li>Use the Services in ways that comply with applicable laws and ethical standards.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Model Transparency</h2>
        <p>
          ThinkDeeper relies on third-party AI providers (such as OpenAI) to process reflection content.
          These models may retain aggregated telemetry to improve their services. See our Privacy
          Policy and Data Processing Addendum for details about data handling.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Limitation of Liability</h2>
        <p>
          ThinkDeeper is not liable for harm or losses resulting from reliance on AI-generated
          content. Use the Services at your own discretion and risk.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Report Issues</h2>
        <p>
          If you encounter problematic output or suspect an error, contact us at{" "}
          <a className="underline" href="mailto:support@thinkdeeper.app">
            support@thinkdeeper.app
          </a>{" "}
          so we can investigate and improve the experience.
        </p>
      </section>
    </section>
  );
}
