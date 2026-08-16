import Link from 'next/link'
import { CtaLink } from './cta-link'
import { MobileMenu } from './mobile-menu'
import { navLinks } from './nav-links'

// Server component; the mobile menu is the only client island. The header
// itself is the positioning context for the menu panel (sticky elements are
// positioned), so the panel can overlay the page full-width without shifting
// layout.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-backbar bg-cellar">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-display text-xl font-extrabold text-chalk">
          Pour IQ<span className="align-super text-[0.6em] font-semibold">®</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-slate transition-colors duration-(--pour-duration-fast) ease-pour hover:text-chalk"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://app.pour-iq.co.uk"
            className="mr-2 hidden font-medium text-slate decoration-measure decoration-2 underline-offset-4 transition-colors duration-(--pour-duration-fast) ease-pour hover:text-chalk hover:underline lg:block"
          >
            Sign in
          </a>
          <CtaLink href="/contact">Book a demo</CtaLink>
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  )
}
