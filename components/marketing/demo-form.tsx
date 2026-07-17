'use client'

// The demo booking form — the one justified client island on the
// marketing site. useActionState wires the server action for inline
// submission with JS; without JS the same form posts natively and the
// page re-renders with the same returned state, so both paths share
// one component and one set of copy. React resets the fields after an
// action round-trip, so defaultValue from the returned state is what
// preserves user input on error.

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { submitDemoRequest, type DemoFormState, type DemoFormValues } from '@/app/(marketing)/contact/actions'
import { contactCopy, type EmailSplitCopy } from '@/lib/contact-copy'

const initialState: DemoFormState = { status: 'idle' }

const inputClasses =
  'mt-2 w-full rounded-md border border-slate/40 bg-backbar px-3 py-2.5 text-body text-chalk aria-[invalid=true]:border-leak'
const labelClasses = 'block text-small font-medium text-chalk'
// Error copy must stay readable: leak is 3.9:1 on cellar — below AA for body
// text — so error TEXT is chalk, and leak appears only as a NON-TEXT marker
// (the invalid field's border above; the alert's left border below). Do not
// reach for text-leak on error messages. See lib/design-tokens.ts (leak).
const errorClasses = 'mt-2 text-small text-chalk'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className={errorClasses}>
      {message}
    </p>
  )
}

// Renders a copy string split around the email address, so the escape
// hatch is a live mailto link without altering the supplied text.
function EmailLine({ copy }: { copy: EmailSplitCopy }) {
  return (
    <>
      {copy.before}
      <a
        href={`mailto:${copy.address}`}
        className="text-chalk underline decoration-measure decoration-2 underline-offset-4"
      >
        {copy.address}
      </a>
      {copy.after}
    </>
  )
}

export function DemoForm() {
  const [state, formAction, pending] = useActionState(submitDemoRequest, initialState)

  // Move focus to the first invalid field after a failed submit, so keyboard
  // and screen-reader users land on the error instead of hunting for it.
  useEffect(() => {
    if (state.status !== 'invalid' || !state.fieldErrors) return
    const order: (keyof DemoFormValues)[] = ['name', 'venue', 'email', 'phone', 'message', 'consent']
    const first = order.find((key) => state.fieldErrors?.[key])
    if (first) document.getElementById(`contact-${first}`)?.focus()
  }, [state])

  if (state.status === 'success') {
    return (
      <div aria-live="polite">
        <h2 className="font-display text-heading font-bold text-chalk">
          {contactCopy.success.heading}
        </h2>
        <p className="mt-4 max-w-[38rem] text-slate">{contactCopy.success.body}</p>
      </div>
    )
  }

  const errors = state.fieldErrors ?? {}
  const values = state.values

  return (
    <form action={formAction} className="max-w-[38rem]">
      {/* Honeypot: hidden from real users and assistive tech; bots that
          fill it are discarded silently server-side. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="contact-name" className={labelClasses}>
          {contactCopy.fields.name}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          defaultValue={values?.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'contact-name-error' : undefined}
          className={inputClasses}
        />
        <FieldError id="contact-name-error" message={errors.name} />
      </div>

      <div className="mt-6">
        <label htmlFor="contact-venue" className={labelClasses}>
          {contactCopy.fields.venue}
        </label>
        <input
          id="contact-venue"
          name="venue"
          type="text"
          required
          maxLength={120}
          autoComplete="organization"
          defaultValue={values?.venue}
          aria-invalid={errors.venue ? true : undefined}
          aria-describedby={errors.venue ? 'contact-venue-error' : undefined}
          className={inputClasses}
        />
        <FieldError id="contact-venue-error" message={errors.venue} />
      </div>

      <div className="mt-6">
        <label htmlFor="contact-email" className={labelClasses}>
          {contactCopy.fields.email}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          defaultValue={values?.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'contact-email-error' : undefined}
          className={inputClasses}
        />
        <FieldError id="contact-email-error" message={errors.email} />
      </div>

      <div className="mt-6">
        <label htmlFor="contact-phone" className={labelClasses}>
          {contactCopy.fields.phone}
        </label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          maxLength={30}
          autoComplete="tel"
          defaultValue={values?.phone}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? 'contact-phone-error' : undefined}
          className={inputClasses}
        />
        <FieldError id="contact-phone-error" message={errors.phone} />
      </div>

      <div className="mt-6">
        <label htmlFor="contact-message" className={labelClasses}>
          {contactCopy.fields.message}
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          maxLength={2000}
          defaultValue={values?.message}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          className={inputClasses}
        />
        <FieldError id="contact-message-error" message={errors.message} />
      </div>

      <div className="mt-6">
        <div className="flex items-start gap-3">
          <input
            id="contact-consent"
            name="consent"
            type="checkbox"
            required
            defaultChecked={values?.consent}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'contact-consent-error' : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-(--pour-colour-measure)"
          />
          <label htmlFor="contact-consent" className="text-small text-slate">
            {contactCopy.fields.consentBefore}
            <Link
              href="/privacy-policy"
              className="text-chalk underline decoration-measure decoration-2 underline-offset-4"
            >
              {contactCopy.fields.consentLink}
            </Link>
            {contactCopy.fields.consentAfter}
          </label>
        </div>
        <FieldError id="contact-consent-error" message={errors.consent} />
      </div>

      {state.status === 'error' && state.errorKind === 'failed' && (
        <div role="alert" className="mt-6 border-l-2 border-leak pl-3">
          <p className="font-medium text-chalk">{contactCopy.errors.failedHeading}</p>
          <p className="mt-2 text-small text-slate">
            <EmailLine copy={contactCopy.errors.failedBody} />
          </p>
        </div>
      )}
      {state.status === 'error' && state.errorKind === 'unavailable' && (
        <p role="alert" className="mt-6 border-l-2 border-leak pl-3 text-small text-chalk">
          <EmailLine copy={contactCopy.errors.unavailable} />
        </p>
      )}
      {state.status === 'error' && state.errorKind === 'rate-limited' && (
        <p role="alert" className="mt-6 border-l-2 border-leak pl-3 text-small text-chalk">
          <EmailLine copy={contactCopy.errors.rateLimited} />
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 rounded-md bg-measure px-4 py-2.5 text-small font-medium text-cellar transition-opacity duration-(--pour-duration-fast) ease-pour hover:opacity-90 disabled:opacity-60"
      >
        {pending ? contactCopy.submitting : contactCopy.submit}
      </button>
    </form>
  )
}
