// Generates the brand vector and raster assets. The identity is the
// logotype: the "Pour IQ" wordmark with the pour integrated, matching the
// site hero (measure underline beneath the wordmark, vertical pour stroke
// descending into its left end). Where space is too tight for the full
// wordmark, the IQ tile carries the same treatment. Run and commit:
//
//   pnpm brand:generate
//
// Outputs:
//   public/brand/pour-iq-lockup.svg  the logotype (outlined wordmark + pour)
//   public/brand/iq-tile.svg         IQ on the cellar tile, true letterforms
//   public/icon.svg                  copy of iq-tile.svg (SVG favicon)
//   public/favicon.ico               16 (from iq-tile-16.svg), 32, 48
//   public/apple-touch-icon.png      180x180 tile, flattened (no alpha)
//   public/icon-192.png              manifest icon
//   public/icon-512.png              manifest icon; also the JSON-LD logo
//
// public/brand/iq-tile-16.svg is the hand-tuned committed source for the
// 16px ICO slice only. Letterforms are outlined from Bricolage Grotesque
// 800 (the header face) so everything renders with no font dependency;
// the TTF is fetched from Google Fonts on first run and cached in the
// system temp dir. Colours are token values from lib/design-tokens.ts:
// chalk #F2EFE6, measure #D98E2B, cellar #0F1D18.

import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const brandDir = join(repoRoot, 'public', 'brand')
const publicDir = join(repoRoot, 'public')

const CHALK = '#F2EFE6'
const MEASURE = '#D98E2B'
const CELLAR = '#0F1D18'

// --- Fetch the wordmark face (static TTF instance, cached) ---------------

async function getBricolageTtf() {
  const cacheDir = join(tmpdir(), 'pour-iq-og-fonts')
  const file = join(cacheDir, 'BricolageGrotesque-800.ttf')
  if (!existsSync(file)) {
    await mkdir(cacheDir, { recursive: true })
    // The legacy user agent makes the CSS API return static TTF instances.
    const cssUrl = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800'
    const css = await (await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/4.0' } })).text()
    const ttfUrl = css.match(/url\((https:\/\/[^)]+)\)/)?.[1]
    if (!ttfUrl) throw new Error('No font URL in Google Fonts CSS response')
    const ttf = await (await fetch(ttfUrl)).arrayBuffer()
    await writeFile(file, Buffer.from(ttf))
  }
  return file
}

// Outline text glyph by glyph with manual advances and kerning: the font's
// GSUB ccmp lookups use a subtable format opentype.js cannot shape, and
// our strings need no substitutions. Returns path data, the advance width,
// and the outline's lowest point (the Q descender) in SVG y-down coords.
function outlineText(font, text, x0, baseline, fontSize) {
  const scale = fontSize / font.unitsPerEm
  let x = x0
  let prev = null
  let maxY = baseline
  const pathData = []
  for (const ch of text) {
    const glyph = font.charToGlyph(ch)
    if (prev) x += font.getKerningValue(prev, glyph) * scale
    const path = glyph.getPath(x, baseline, fontSize)
    const d = path.toPathData(2)
    if (d) {
      pathData.push(d)
      maxY = Math.max(maxY, path.getBoundingBox().y2)
    }
    x += glyph.advanceWidth * scale
    prev = glyph
  }
  return { d: pathData.join(' '), advance: x - x0, maxY }
}

function capHeightOf(font, fontSize) {
  const scale = fontSize / font.unitsPerEm
  const capUnits = font.tables.os2?.sCapHeight || font.charToGlyph('H').getMetrics().yMax
  return capUnits * scale
}

// --- The logotype: wordmark with the pour integrated ----------------------

async function generateLogotype(font) {
  const fontSize = 46
  const cap = capHeightOf(font, fontSize)

  // The vertical pour stroke starts roughly one cap-height above the
  // wordmark's top (bounded, not the canvas edge), so the wordmark's cap
  // line sits at y = cap and the baseline at 2 * cap.
  const textX = 8
  const baseline = Math.round(2 * cap)
  const text = outlineText(font, 'Pour IQ', textX, baseline, fontSize)

  // Underline clear below the Q descender - the tail must not touch it.
  const ulTop = Math.round(text.maxY + 5)
  const ulH = 6
  const vW = 4 // 2:3 stroke ratio, as the hero pour CSS
  const width = Math.ceil(textX + text.advance + 8)
  const height = ulTop + ulH + 4

  const svg = `<!--
  The Pour IQ logotype: the wordmark with the pour integrated, matching
  the site hero - measure underline beneath the wordmark, vertical pour
  stroke descending into its left end (corner join, bottoms flush), 2:3
  stroke ratio. The underline spans the wordmark's width and sits clear
  of the Q descender; the vertical drops from roughly cap-height above
  the wordmark. Wordmark outlined from Bricolage Grotesque 800 (no font
  dependency). Generated by scripts/generate-brand-assets.mjs - do not
  edit by hand. Colours from lib/design-tokens.ts: chalk ${CHALK},
  measure ${MEASURE}.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pour IQ">
  <rect fill="${MEASURE}" x="${textX}" y="0" width="${vW}" height="${ulTop + ulH}"/>
  <rect fill="${MEASURE}" x="${textX}" y="${ulTop}" width="${Math.round(text.advance)}" height="${ulH}"/>
  <path fill="${CHALK}" d="${text.d}"/>
</svg>
`
  await writeFile(join(brandDir, 'pour-iq-lockup.svg'), svg)
  return { width, height }
}

// --- The IQ tile: true letterforms, for 32px and above ---------------------

async function generateIqTile(font) {
  // No vertical pour stroke here: that stroke appears only in assets
  // carrying the word "Pour" (lockup, OG card) - standalone it reads as
  // the letter L. The tile is the letters plus the measure underline.
  const ulH = 6
  const gap = 3 // clearance under the Q descender - the tail stays visible

  // Fit the letters large: fill the tile width inside comfortable margins,
  // shrinking only if the stacked block would overflow the height.
  const probe = outlineText(font, 'IQ', 0, 0, 100)
  const capRatio = capHeightOf(font, 100) / 100
  const descRatio = probe.maxY / 100
  let fontSize = Math.floor((48 / probe.advance) * 100)
  const maxByHeight = Math.floor((64 - 12 - gap - ulH) / (capRatio + descRatio))
  fontSize = Math.min(fontSize, maxByHeight)

  const cap = capHeightOf(font, fontSize)
  const text = outlineText(font, 'IQ', 0, 0, fontSize)
  const blockH = cap + text.maxY + gap + ulH
  const dx = (64 - text.advance) / 2
  const baseline = (64 - blockH) / 2 + cap
  const t = outlineText(font, 'IQ', dx, baseline, fontSize)
  const ulTop = (baseline + text.maxY + gap).toFixed(1)

  const svg = `<!--
  The Pour IQ favicon/app tile: "IQ" in Bricolage Grotesque 800 outlines
  above a measure underline spanning the letters' width, clear of the Q
  descender. Deliberately no vertical pour stroke: that stroke appears
  only in assets carrying the word "Pour" (the lockup and OG card).
  True letterforms: use at 32px and above; the 16px ICO slice uses the
  hand-tuned iq-tile-16.svg instead. Generated by
  scripts/generate-brand-assets.mjs - do not edit by hand.
  Colours from lib/design-tokens.ts: cellar ${CELLAR}, chalk ${CHALK},
  measure ${MEASURE}. Corner radius 8 is the radius-md token.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Pour IQ">
  <rect fill="${CELLAR}" x="0" y="0" width="64" height="64" rx="8"/>
  <rect fill="${MEASURE}" x="${dx.toFixed(1)}" y="${ulTop}" width="${text.advance.toFixed(1)}" height="${ulH}"/>
  <path fill="${CHALK}" d="${t.d}"/>
</svg>
`
  await writeFile(join(brandDir, 'iq-tile.svg'), svg)
}

// --- Favicons and app icons -------------------------------------------------

async function generateIcons() {
  const tile = await readFile(join(brandDir, 'iq-tile.svg'))
  const tile16 = await readFile(join(brandDir, 'iq-tile-16.svg'))
  const render = (src, size) => sharp(src, { density: (72 * size) / 64 }).resize(size, size)

  // SVG favicon is the tile itself.
  await copyFile(join(brandDir, 'iq-tile.svg'), join(publicDir, 'icon.svg'))

  // 16px uses the simplified drawing; 32 and 48 the true letterforms.
  const icoPngs = await Promise.all([
    render(tile16, 16).png().toBuffer(),
    render(tile, 32).png().toBuffer(),
    render(tile, 48).png().toBuffer(),
  ])
  await writeFile(join(publicDir, 'favicon.ico'), await pngToIco(icoPngs))

  // Apple applies its own corner mask and dislikes alpha: flatten the
  // tile's transparent corners onto cellar for a solid square.
  await render(tile, 180)
    .flatten({ background: CELLAR })
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'))

  await render(tile, 192).png().toFile(join(publicDir, 'icon-192.png'))
  await render(tile, 512).png().toFile(join(publicDir, 'icon-512.png'))
}

const font = opentype.parse((await readFile(await getBricolageTtf())).buffer)
const { width, height } = await generateLogotype(font)
await generateIqTile(font)
await generateIcons()
console.log(
  `Wrote lockup (viewBox 0 0 ${width} ${height}), iq-tile.svg, icon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png`,
)
