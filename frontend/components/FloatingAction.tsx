import Link from "next/link";

type FloatingActionProps = {
  href: string;
  label: string;
  variant?: 'solid' | 'ghost';
};

export function FloatingAction({ href, label, variant = 'solid' }: FloatingActionProps) {
  const base =
    'inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition shadow';
  const solid =
    'border-zinc-200/70 bg-white/80 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100';
  const ghost =
    'border-transparent bg-transparent text-zinc-500 hover:text-zinc-900 hover:underline dark:text-zinc-300';
  return (
    <Link href={href} className={`${base} ${variant === 'solid' ? solid : ghost}`}>
      {label}
    </Link>
  );
}
