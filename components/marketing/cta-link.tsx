import Link from 'next/link'

// The measure-on-cellar call-to-action used by the header and the hero, so
// the primary CTA renders identically everywhere.
export function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md bg-measure px-4 py-2 text-small font-medium whitespace-nowrap text-cellar transition-opacity duration-(--pour-duration-fast) ease-pour hover:opacity-90"
    >
      {children}
    </Link>
  )
}
