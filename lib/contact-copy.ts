// Every customer-facing string on the contact page, in one place so the
// supplied copy drops in byte-exact.
//
// ── BLOCKED ON COPY ─────────────────────────────────────────────────
// Strings marked [AWAITING COPY] are placeholders. Per CLAUDE.md, copy
// is decided in conversation and implemented byte-exact — this page
// must not ship until every marked string is replaced with the
// supplied block. "CONTACT" and "Book a demo." were supplied in the
// task; the rest were not.
// ────────────────────────────────────────────────────────────────────

export const contactCopy = {
  heroLabel: 'CONTACT',
  heroTitle: 'Book a demo.',
  heroIntro: '[AWAITING COPY] Intro paragraph as supplied.',

  fields: {
    name: 'Name',
    venue: 'Venue name',
    email: 'Email',
    phone: 'Phone (optional)',
    message: 'Message (optional)',
    // The consent sentence; {privacy} marks where the "Privacy policy"
    // link text sits. Link target: /privacy-policy.
    consentBefore: '[AWAITING COPY] Consent label text before the ',
    consentLink: 'Privacy policy',
    consentAfter: ' link, as supplied.',
  },

  submit: '[AWAITING COPY] Submit button label.',
  submitting: '[AWAITING COPY] Submitting state label.',

  emailAlternative: {
    before: '[AWAITING COPY] Email-alternative line before the address, as supplied. ',
    address: 'hello@pour-iq.co.uk',
    after: '',
  },

  success: {
    heading: '[AWAITING COPY] Success heading, as supplied.',
    body: '[AWAITING COPY] Success body, as supplied.',
  },

  errors: {
    // Per-field validation messages, announced inline via
    // aria-describedby.
    nameRequired: '[AWAITING COPY] Name required.',
    venueRequired: '[AWAITING COPY] Venue name required.',
    emailRequired: '[AWAITING COPY] Email required.',
    emailInvalid: '[AWAITING COPY] Email invalid.',
    consentRequired: '[AWAITING COPY] Consent required.',
    tooLong: '[AWAITING COPY] Field too long.',
    // Whole-form failure states.
    submitFailed: '[AWAITING COPY] Error state copy, as supplied.',
    unavailable: '[AWAITING COPY] Temporarily-unavailable (503) copy.',
    rateLimited: '[AWAITING COPY] Generic slow-down message.',
  },
} as const
