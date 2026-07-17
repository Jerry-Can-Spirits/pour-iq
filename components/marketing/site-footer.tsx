import Link from 'next/link'

const footerColumns = [
  {
    heading: 'Company',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Sign in', href: 'https://app.pour-iq.co.uk' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy-policy' },
      { label: 'Terms', href: '/terms-of-service' },
    ],
  },
] as const

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-backbar bg-cellar">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <p className="font-display text-heading font-extrabold text-chalk">Pour IQ</p>
            <p className="mt-2 text-small text-slate">
              Menu and cost engineering for independent UK bars. Built by Jerry Can Spirits Ltd.
            </p>
          </div>
          <div className="flex gap-16">
            {footerColumns.map((column) => (
              <div key={column.heading}>
                <h2 className="font-mono text-mono-label font-medium uppercase text-slate">
                  {column.heading}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => {
                    // The app subdomain is a plain anchor: same product
                    // family, so no new-tab or rel semantics, but not a
                    // client-side route either.
                    const LinkComponent = link.href.startsWith('https://') ? 'a' : Link
                    return (
                      <li key={link.href}>
                        <LinkComponent
                          href={link.href}
                          className="text-small text-chalk transition-colors duration-(--pour-duration-fast) ease-pour hover:text-measure"
                        >
                          {link.label}
                        </LinkComponent>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-backbar pt-6">
          <p className="text-small text-slate">
            &copy; {year} Jerry Can Spirits Ltd. All rights reserved.
          </p>
          <p className="text-small text-slate">
            Pour IQ is a trademark of Jerry Can Spirits Ltd. UK trade mark application
            UK00004387466.
          </p>
        </div>
      </div>
    </footer>
  )
}
