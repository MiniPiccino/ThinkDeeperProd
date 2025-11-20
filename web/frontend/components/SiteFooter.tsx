export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/5 px-6 py-8 text-sm text-foreground/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-foreground/70">
          &copy; {new Date().getFullYear()} Thinkle. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center gap-4">
          <a className="underline-offset-4 hover:underline" href="/privacy">
            Privacy Policy
          </a>
          <a className="underline-offset-4 hover:underline" href="/terms">
            Terms of Service
          </a>
          <a className="underline-offset-4 hover:underline" href="/cookies">
            Cookie Policy
          </a>
          <a className="underline-offset-4 hover:underline" href="/ai-disclaimer">
            AI &amp; Content Disclaimer
          </a>
          <a className="underline-offset-4 hover:underline" href="/data-processing-addendum">
            Data Processing Addendum
          </a>
        </nav>
      </div>
    </footer>
  );
}
