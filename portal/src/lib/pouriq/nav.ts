export interface NavItem { label: string; href: string }
export interface NavGroup { label: string; items: NavItem[] }

const HOME = '/'

// Slice 1 of the UI redesign: only items with a destination today. Deferred
// items (Dashboard, Sales & performance, Tasks & alerts, a global Cocktails &
// spec cards, Imports, Team & locations) are added as their screens ship.
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Operate', items: [
    { label: 'Dashboard', href: HOME },
    { label: 'Variance', href: '/variance' },
    { label: 'Stock', href: '/stock' },
  ] },
  { label: 'Build', items: [
    { label: 'Menus', href: '/menus' },
    { label: 'Ingredients', href: '/library' },
    { label: 'Serves', href: '/serves' },
    { label: 'Suppliers & invoices', href: '/invoices' },
  ] },
  { label: 'Connect', items: [
    { label: 'Integrations', href: '/settings/integrations' },
  ] },
  { label: 'Settings', items: [
    { label: 'Voice profile', href: '/settings/voice-profile' },
    { label: 'Help', href: '/help' },
    { label: 'Quickstart', href: '/onboarding' },
  ] },
]

// The home item matches only its exact path; every other item also matches its
// sub-routes (e.g. /library/new highlights Ingredients). trailingSlash is on,
// so pathnames arrive as / — strip the slash before comparing.
export function isNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (href === HOME) return path === HOME
  return path === href || path.startsWith(href + '/')
}

// True on the authenticated Pour IQ app (its own chrome), false on marketing
// routes and the public /trade entry pages (login/apply/landing).
export function isPourIqAppRoute(pathname: string | null): boolean {
  return pathname != null && (pathname === HOME || pathname.startsWith(HOME + '/'))
}
