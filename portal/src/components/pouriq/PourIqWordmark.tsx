// The Pour IQ wordmark: the one serif touch (Playfair, already loaded) as a
// quiet family cue to Jerry Can Spirits, with an optional attribution subline.
// No JCS logo — attribution is a text microline only.

export function PourIqWordmark({ attribution = true }: { attribution?: boolean }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span className="font-serif font-extrabold text-slate-900 text-lg tracking-tight">
        Pour IQ<span className="align-super text-[0.6em] font-semibold">™</span>
      </span>
      {attribution && (
        <span className="text-[10px] text-slate-400 mt-0.5">Built by Jerry Can Spirits</span>
      )}
    </span>
  )
}
