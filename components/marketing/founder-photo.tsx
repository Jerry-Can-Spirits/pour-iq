import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Image from 'next/image'

// The About page photo slot. The fs probe runs at build time only (every
// page is statically prerendered), never on the Worker: drop
// public/founder.jpg into the repo and rebuild to swap the placeholder
// for the photo. Images render unoptimised because the OpenNext/Workers
// deployment has no image optimiser configured - the raw static file is
// served, same as every other public asset.
const hasPhoto = existsSync(join(process.cwd(), 'public', 'founder.jpg'))

export function FounderPhoto() {
  return (
    <div className="relative aspect-[4/5] w-full max-w-[24rem] overflow-hidden rounded-lg bg-backbar">
      {hasPhoto ? (
        <Image
          src="/founder.jpg"
          alt="Dan, founder of Pour IQ"
          fill
          unoptimized
          className="object-cover"
        />
      ) : (
        // Intentional placeholder: the IQ tile at modest scale on the
        // backbar surface.
        <div className="flex h-full items-center justify-center">
          <Image src="/brand/iq-tile.svg" alt="" width={96} height={96} unoptimized />
        </div>
      )}
    </div>
  )
}
