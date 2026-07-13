// Every customer-facing string on the contact page, in one place.
// Copy supplied by Dan 2026-07-13 and implemented byte-exact per
// CLAUDE.md — do not edit wording here without a supplied change.
// Messages that carry the email escape hatch are split around the
// address so it renders as a mailto link without altering the text.

export interface EmailSplitCopy {
  before: string
  address: string
  after: string
}

export const contactCopy = {
  heroLabel: 'CONTACT',
  heroTitle: 'Book a demo.',
  heroIntro:
    'Twenty minutes, a working venue inside Pour IQ, and your questions answered by the founder. Fill this in and Dan will come back to you within one working day.',

  fields: {
    name: 'Name',
    venue: 'Venue name',
    email: 'Email',
    phone: 'Phone (optional)',
    message: 'Message (optional)',
    // "I'm happy for Pour IQ to hold these details to arrange the
    // demo. Privacy policy." — the words "Privacy policy" carry the
    // link to /privacy-policy.
    consentBefore: "I'm happy for Pour IQ to hold these details to arrange the demo. ",
    consentLink: 'Privacy policy',
    consentAfter: '.',
  },

  submit: 'Send it',
  submitting: 'Sending',

  emailAlternative: {
    before: 'Prefer email? ',
    address: 'hello@pour-iq.co.uk',
    after: ' reaches the same person.',
  } satisfies EmailSplitCopy,

  success: {
    heading: 'Done. You will hear from Dan within one working day.',
    body: 'Usually sooner. If it is urgent, say so in the message and it gets read first.',
  },

  errors: {
    nameRequired: 'Your name is needed so Dan knows who to reply to.',
    venueRequired: 'The venue name helps Dan prepare before the call.',
    emailRequired: 'An email address is needed to arrange the demo.',
    emailInvalid: 'That email address does not look right. Check it and try again.',
    consentRequired: 'Tick the consent box so we can hold your details to arrange the demo.',
    tooLong: 'That is longer than the form can take. Trim it down and try again.',

    failedHeading: 'That did not send. Nothing was lost, try again in a moment.',
    failedBody: {
      before: 'If it keeps failing, email ',
      address: 'hello@pour-iq.co.uk',
      after: ' directly.',
    } satisfies EmailSplitCopy,
    unavailable: {
      before: 'The form is taking a break. Email ',
      address: 'hello@pour-iq.co.uk',
      after: ' and Dan will get straight back to you.',
    } satisfies EmailSplitCopy,
    rateLimited: {
      before: 'That is a few attempts in quick succession. Give it ten minutes, or email ',
      address: 'hello@pour-iq.co.uk',
      after: '.',
    } satisfies EmailSplitCopy,
  },
} as const
