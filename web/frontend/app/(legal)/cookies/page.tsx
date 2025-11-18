import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — ThinkDeeper",
  description:
    "Understand how ThinkDeeper uses cookies, tracking technologies, and your consent choices.",
};

export default function CookiePolicyPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold">Cookie Policy</h1>
        <p className="text-sm text-foreground/70">Effective date: March 1, 2025</p>
        <p>
          This Cookie Policy explains how ThinkDeeper (&ldquo;we,&rdquo; &ldquo;our,&rdquo;) uses
          cookies, local storage, and similar technologies when you visit our website or use the
          Services. It should be read together with our Privacy Policy.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">What Are Cookies?</h2>
        <p>
          Cookies are small text files that a website stores on your device when you visit. Local
          storage and similar technologies allow data to persist in your browser to enable core
          functionality or analytics.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Cookies We Use</h2>
        <table className="w-full table-auto border border-foreground/10 text-sm">
          <thead className="bg-foreground/5">
            <tr>
              <th className="border border-foreground/10 px-3 py-2 text-left">Category</th>
              <th className="border border-foreground/10 px-3 py-2 text-left">Purpose</th>
              <th className="border border-foreground/10 px-3 py-2 text-left">Examples</th>
              <th className="border border-foreground/10 px-3 py-2 text-left">Storage Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-foreground/10 px-3 py-2 font-medium">Essential</td>
              <td className="border border-foreground/10 px-3 py-2">
                Required to authenticate users, maintain sessions, prevent abuse, and remember privacy
                preferences.
              </td>
              <td className="border border-foreground/10 px-3 py-2">
                `session_id`, `csrf_token`, `consent_status`
              </td>
              <td className="border border-foreground/10 px-3 py-2">Session or up to 12 months</td>
            </tr>
            <tr>
              <td className="border border-foreground/10 px-3 py-2 font-medium">Functional</td>
              <td className="border border-foreground/10 px-3 py-2">
                Remember timers, streaks, UI preferences, and last-viewed reflections to personalize your
                experience.
              </td>
              <td className="border border-foreground/10 px-3 py-2">
                `timer_state`, `reflection_history`, `theme`
              </td>
              <td className="border border-foreground/10 px-3 py-2">Up to 12 months</td>
            </tr>
            <tr>
              <td className="border border-foreground/10 px-3 py-2 font-medium">Analytics</td>
              <td className="border border-foreground/10 px-3 py-2">
                Measure product usage, identify popular reflections, and guide product improvements.
              </td>
              <td className="border border-foreground/10 px-3 py-2">
                `analytics_id`, `feature_flags`, `ab_test_group`
              </td>
              <td className="border border-foreground/10 px-3 py-2">Up to 13 months (consent required)</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm text-foreground/70">
          We do not currently serve advertising or engage in cross-site tracking.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Managing Cookies</h2>
        <ul className="list-disc space-y-3 pl-6">
          <li>
            You can adjust consent preferences through the in-product cookie banner or within your
            account settings.
          </li>
          <li>
            Most browsers let you delete cookies or block future storage. Doing so may impact certain
            features (e.g., keeping you signed in).
          </li>
          <li>
            For analytics, you can use industry opt-out portals such as{" "}
            <a className="underline" href="https://optout.networkadvertising.org" target="_blank" rel="noopener noreferrer">
              NAI
            </a>{" "}
            or{" "}
            <a className="underline" href="https://youradchoices.com" target="_blank" rel="noopener noreferrer">
              AdChoices
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Third-Party Technologies</h2>
        <p>
          We may use hosted infrastructure (e.g., Vercel, AWS, Render) and analytics tools (e.g.,
          PostHog, Google Analytics) that set their own cookies when you consent. These partners act as
          our processors under a data processing agreement.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Updates</h2>
        <p>
          We will update this Cookie Policy to reflect changes to our practices or applicable law. We
          will post the revised version with a new effective date and, where required, ask for your
          consent again.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Contact</h2>
        <p>
          Questions about this Cookie Policy can be directed to{" "}
          <a className="underline" href="mailto:privacy@thinkdeeper.app">
            privacy@thinkdeeper.app
          </a>
          .
        </p>
      </section>
    </section>
  );
}
