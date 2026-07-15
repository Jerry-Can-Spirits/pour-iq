# The Signal Box — demo fixtures

Fixture assets for the permanent demo venue (account "Demo Venue",
display identity "The Signal Box" — a fictional wet-led neighbourhood
free house). Everything here is fictional except Expedition Spiced Rum,
which is priced at its real trade price.

## The pre-canned scan

`harrier-invoice-hws-10832.pdf` is the demo's live RIPPLE moment: a
fresh Harrier Wines & Spirits invoice, 12 lines, dated 2026-07-14 (the
natural next fortnightly delivery after the seeded history), with two
price rises against the venue's committed history:

- Golden Rum 70cl: £19.80 → **£21.40** (+8.1%) — ripples Rum Punch and
  Golden rum & cola
- Ginger Beer (serve): £0.80 → **£0.88** — ripples Dark & Stormy

The other ten lines are steady. Net £668.08, VAT £133.62, gross £801.70.

`harrier-invoice-hws-10832.extraction.json` is the captured output of
running that PDF through the real extraction pipeline once
(2026-07-15), against the seeded Signal Box library: all 12 lines
extracted exactly, both rises intact, and every line auto-matched
(`match.kind: "auto"`) to its library entry.

**This invoice is deliberately NOT committed to the venue's data.** It
is the demo's future live moment: upload it (or replay the captured
extraction), watch the two rises flag in review, and commit it in front
of the visitor to show the ripple land. If it ever gets committed
during a demo, delete the invoice through the product afterwards to
reset the moment.
