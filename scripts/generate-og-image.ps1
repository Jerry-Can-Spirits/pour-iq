# Generates public/og.png — the single static Open Graph image referenced by
# lib/metadata.ts. Run once and commit the output; the site never generates
# images at runtime (OpenNext/Workers compatibility risk).
#
#   pwsh scripts/generate-og-image.ps1
#
# Requires Windows (System.Drawing/GDI+) and network access on first run to
# fetch the brand fonts from Google Fonts (cached in the system temp dir).
# Colour values mirror lib/design-tokens.ts — update both together.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $repoRoot 'public/og.png'
$fontCacheDir = Join-Path ([IO.Path]::GetTempPath()) 'pour-iq-og-fonts'
New-Item -ItemType Directory -Force $fontCacheDir | Out-Null

# The legacy user agent makes the Google Fonts CSS API return static TTF
# instances (GDI+ cannot load the woff2 served to modern browsers).
function Get-GoogleFontTtf([string]$Family, [int]$Weight) {
  $file = Join-Path $fontCacheDir "$($Family -replace ' ', '')-$Weight.ttf"
  if (-not (Test-Path $file)) {
    $cssUrl = "https://fonts.googleapis.com/css2?family=$($Family -replace ' ', '+'):wght@$Weight"
    $css = (Invoke-WebRequest -Uri $cssUrl -UserAgent 'Mozilla/4.0' -UseBasicParsing).Content
    $ttfUrl = [regex]::Match($css, 'url\((https://[^)]+)\)').Groups[1].Value
    if (-not $ttfUrl) { throw "No font URL in Google Fonts CSS response for $Family $Weight" }
    Invoke-WebRequest -Uri $ttfUrl -OutFile $file -UseBasicParsing
  }
  return $file
}

# Collections must outlive the fonts created from them, so keep them all.
$script:fontCollections = @()
function New-PrivateFont([string]$TtfPath, [float]$SizePx) {
  $collection = New-Object System.Drawing.Text.PrivateFontCollection
  $collection.AddFontFile($TtfPath)
  $script:fontCollections += $collection
  $family = $collection.Families[0]
  foreach ($style in @([System.Drawing.FontStyle]::Regular, [System.Drawing.FontStyle]::Bold)) {
    if ($family.IsStyleAvailable($style)) {
      return New-Object System.Drawing.Font($family, $SizePx, $style, [System.Drawing.GraphicsUnit]::Pixel)
    }
  }
  throw "No usable style in $TtfPath"
}

$displayTtf = Get-GoogleFontTtf 'Bricolage Grotesque' 800
$bodyTtf = Get-GoogleFontTtf 'Instrument Sans' 400

# lib/design-tokens.ts colours
$cellar = [System.Drawing.ColorTranslator]::FromHtml('#0F1D18')
$backbar = [System.Drawing.ColorTranslator]::FromHtml('#172A23')
$chalk = [System.Drawing.ColorTranslator]::FromHtml('#F2EFE6')
$slate = [System.Drawing.ColorTranslator]::FromHtml('#9BA79E')
$measure = [System.Drawing.ColorTranslator]::FromHtml('#D98E2B')

$bmp = New-Object System.Drawing.Bitmap(1200, 630)
$g = [System.Drawing.Graphics]::FromImage($bmp)
try {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear($cellar)

  # Hairline frame, echoing the site's backbar card borders.
  $framePen = New-Object System.Drawing.Pen($backbar, 2)
  $g.DrawRectangle($framePen, 1, 1, 1197, 627)

  $chalkBrush = New-Object System.Drawing.SolidBrush($chalk)
  $slateBrush = New-Object System.Drawing.SolidBrush($slate)
  $measureBrush = New-Object System.Drawing.SolidBrush($measure)

  # GenericTypographic drops GDI+'s default side padding so the measured
  # width matches the glyphs and the underline can align with them.
  $format = [System.Drawing.StringFormat]::GenericTypographic

  $displayFont = New-PrivateFont $displayTtf 148
  $bodyFont = New-PrivateFont $bodyTtf 42

  $left = 100.0
  $wordmark = 'Pour IQ'
  $wordmarkY = 200.0
  $wordmarkSize = $g.MeasureString($wordmark, $displayFont, [System.Drawing.PointF]::new(0, 0), $format)

  # The pour mark beside the wordmark, vertically centred against it.
  # Geometry mirrors public/brand/pour-mark.svg (64 box: vertical x30 y0
  # w4 h42, horizontal x6 y48 w52 h6 - centred pour, strokes never
  # touching, 2:3 weight ratio), scaled 2.5x for the card.
  $s = 2.5
  $markY = $wordmarkY + ($wordmarkSize.Height - 64 * $s) / 2
  $g.FillRectangle($measureBrush, $left + 30 * $s, $markY, 4 * $s, 42 * $s)
  $g.FillRectangle($measureBrush, $left + 6 * $s, $markY + 48 * $s, 52 * $s, 6 * $s)

  # Wordmark to the right of the mark's 64-unit box, plus a gap.
  $textX = $left + 64 * $s + 40
  $g.DrawString($wordmark, $displayFont, $chalkBrush, $textX, $wordmarkY, $format)

  $tagline = 'Menu and cost engineering for UK bars.'
  $g.DrawString($tagline, $bodyFont, $slateBrush, $textX, $wordmarkY + $wordmarkSize.Height + 40, $format)

  New-Item -ItemType Directory -Force (Split-Path -Parent $outPath) | Out-Null
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $g.Dispose()
  $bmp.Dispose()
}

Write-Host "Wrote $outPath"
