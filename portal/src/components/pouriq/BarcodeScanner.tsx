'use client'

import { useEffect, useId, useRef, useState } from 'react'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

// html5-qrcode is imported dynamically so the ~70KB bundle only loads
// when a bar manager actually opens the scanner. Camera access requires
// HTTPS (or localhost); in production both conditions are met.

export function BarcodeScanner({ onScan, onClose }: Props) {
  const regionId = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false
    let stopped = false
    type Html5QrcodeInstance = InstanceType<typeof import('html5-qrcode').Html5Qrcode>
    let scanner: Html5QrcodeInstance | null = null

    async function safeStop() {
      if (stopped || !scanner) return
      stopped = true
      try { await scanner.stop() } catch { /* already stopping */ }
    }

    async function start() {
      try {
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== 'function'
        ) {
          setError(
            'Camera scanning is not supported in this browser. Scan on a phone instead, or type the barcode into the field above.'
          )
          setStarting(false)
          return
        }

        const mod = await import('html5-qrcode')
        if (cancelled) return
        const Html5Qrcode = mod.Html5Qrcode
        const formats = [
          mod.Html5QrcodeSupportedFormats.EAN_13,
          mod.Html5QrcodeSupportedFormats.EAN_8,
          mod.Html5QrcodeSupportedFormats.UPC_A,
          mod.Html5QrcodeSupportedFormats.UPC_E,
          mod.Html5QrcodeSupportedFormats.CODE_128,
          mod.Html5QrcodeSupportedFormats.CODE_39,
          mod.Html5QrcodeSupportedFormats.QR_CODE,
        ]
        scanner = new Html5Qrcode(regionId, { formatsToSupport: formats, verbose: false })

        const onDecoded = (decoded: string) => {
          if (cancelled) return
          safeStop()
          onScan(decoded)
        }
        // qrbox sized dynamically. Linear barcodes (EAN-13, Code 128)
        // need a wide horizontal region — narrow qrbox crops them out
        // before the decoder ever sees them. Take 90% of the viewfinder
        // width and a 35%-of-width height so 1D codes scan from any
        // reasonable distance, while QR codes still fit.
        const qrbox = (vfw: number, vfh: number) => {
          const w = Math.floor(Math.min(vfw, vfh > 0 ? vfh * 2 : vfw) * 0.9)
          const h = Math.floor(w * 0.4)
          return { width: w, height: h }
        }
        const config = { fps: 15, qrbox, aspectRatio: 1.333 }

        // Try the rear camera first. On phones that don't expose a
        // distinct rear camera (rare), fall back to any available camera.
        try {
          await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => {})
        } catch (rearErr) {
          if (cancelled) return
          const rearMsg = (rearErr as Error)?.message || ''
          // Permission / no-secure-context errors are terminal — re-throw
          // so the outer catch surfaces the right message. Only fall back
          // on 'no rear camera' kinds of failures.
          if (/permission|denied|notallowed|secure/i.test(rearMsg)) {
            throw rearErr
          }
          await scanner.start({ video: true } as MediaTrackConstraints, config, onDecoded, () => {})
        }
        if (!cancelled) setStarting(false)
      } catch (e) {
        if (cancelled) return
        const err = e as { name?: string; message?: string }
        const name = err?.name ?? ''
        const msg = err?.message ?? ''
        const lower = `${name} ${msg}`.toLowerCase()
        if (/notallowed|permission|denied/.test(lower)) {
          const isStandalone = typeof window !== 'undefined' && (
            window.matchMedia?.('(display-mode: standalone)').matches ||
            // iOS Safari quirk: the standalone flag lives on the navigator
            ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
          )
          if (isStandalone) {
            setError(
              "Camera access is blocked. You're using the installed app: open your phone's Settings, find Jerry Can Spirits (Android) or Safari (iPhone) → Camera → Allow. Then reopen the app."
            )
          } else {
            setError(
              'Camera access was blocked. Tap the padlock icon in the address bar → Permissions → Camera → Allow. Then reload the page and try again.'
            )
          }
        } else if (/notfound|nodevice|noavailable/.test(lower)) {
          setError(
            'No camera was found on this device. Scan on a phone instead, or type the barcode into the field above.'
          )
        } else if (/notreadable|trackstart|aborted/.test(lower)) {
          setError('The camera is in use by another app or tab. Close other apps using the camera and try again.')
        } else if (/secure/.test(lower) || (typeof window !== 'undefined' && !window.isSecureContext)) {
          setError('Camera access needs HTTPS. Open this page in your normal browser (not an in-app browser like Instagram or Facebook).')
        } else {
          setError(
            'We could not open a camera. Check that camera access is allowed in your browser settings, or scan on a phone instead. You can also type the barcode into the field above.'
          )
        }
        setStarting(false)
      }
    }

    start()

    return () => {
      cancelled = true
      safeStop()
    }
  }, [onScan, regionId])

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-label="Scan a barcode">
      <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-md w-full mt-8 sm:mt-0">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900">Scan a barcode</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
        </div>
        <div id={regionId} ref={containerRef} className="w-full aspect-4/3 bg-black rounded-lg overflow-hidden" />
        {starting && !error && (
          <p className="mt-3 text-xs text-slate-500">Starting camera… you may be asked to allow access.</p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Point the camera at the barcode on the back of the bottle. We support EAN-13, UPC, Code 128 and QR.
        </p>
        {error && (
          <p className="mt-2 text-xs text-slate-400">
            Tip: in-app browsers (Instagram, Facebook, Twitter) block camera access. Open this page in Safari or Chrome directly.
          </p>
        )}
      </div>
    </div>
  )
}
