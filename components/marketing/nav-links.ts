// Shared by the desktop nav (server-rendered in SiteHeader) and the mobile
// disclosure menu (client island), so the two can never drift apart.

export const navLinks = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Proof', href: '/case-studies' },
  { label: 'FAQ', href: '/faq' },
] as const

export type NavLink = (typeof navLinks)[number]
