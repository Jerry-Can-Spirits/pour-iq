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
$ctaTtf = Get-GoogleFontTtf 'Instrument Sans' 500

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

  $chalkBrush = New-Object System.Drawing.SolidBrush($chalk)
  $slateBrush = New-Object System.Drawing.SolidBrush($slate)
  $measureBrush = New-Object System.Drawing.SolidBrush($measure)

  # GenericTypographic drops GDI+'s default side padding so the measured
  # width matches the glyphs and the underline can align with them.
  $format = [System.Drawing.StringFormat]::GenericTypographic

  $displayFont = New-PrivateFont $displayTtf 148
  $bodyFont = New-PrivateFont $bodyTtf 42
  $ctaFont = New-PrivateFont $ctaTtf 36

  # The logotype: the wordmark with the pour integrated, as the hero and
  # the lockup SVG. Measure underline spanning the wordmark's width, clear
  # below the Q descender; vertical pour stroke (2:3 weight ratio, 7:10
  # here) descending into the underline's left end from roughly cap-height
  # above the wordmark. The whole block is optically centred with balanced
  # margins; no full-canvas framing lines.
  $wordmark = 'Pour IQ'
  $tagline = 'Menu and cost engineering for UK bars.'
  $cta = 'Book a demo'
  $wordmarkSize = $g.MeasureString($wordmark, $displayFont, [System.Drawing.PointF]::new(0, 0), $format)
  $taglineSize = $g.MeasureString($tagline, $bodyFont, [System.Drawing.PointF]::new(0, 0), $format)
  $ctaSize = $g.MeasureString($cta, $ctaFont, [System.Drawing.PointF]::new(0, 0), $format)

  $capAbove = 106.0   # ~cap height at 148px: bounded drop, not the canvas edge
  $ulClear = 16.0     # visible clearance below the Q descender
  $ulH = 10.0
  $tagGap = 48.0

  # The CTA pill mirrors the site's CtaLink: measure fill, cellar text,
  # established "Book a demo" copy. Padding and radius scale the site's
  # px-4 py-2 rounded-md proportions to the 36px CTA face.
  $ctaGap = 56.0
  $ctaPadX = 40.0
  $ctaPadY = 20.0
  $ctaRadius = 12.0
  $pillW = $ctaSize.Width + 2 * $ctaPadX
  $pillH = $ctaSize.Height + 2 * $ctaPadY

  $blockW = [Math]::Max($wordmarkSize.Width, $taglineSize.Width)
  $blockH = $capAbove + $wordmarkSize.Height + $ulClear + $ulH + $tagGap + $taglineSize.Height + $ctaGap + $pillH
  $left = (1200 - $blockW) / 2
  $wordmarkY = (630 - $blockH) / 2 + $capAbove
  $underlineY = $wordmarkY + $wordmarkSize.Height + $ulClear

  # Pour strokes first so the vertical travels behind the glyphs.
  $g.FillRectangle($measureBrush, $left, $wordmarkY - $capAbove, 7, $underlineY + $ulH - ($wordmarkY - $capAbove))
  $g.FillRectangle($measureBrush, $left, $underlineY, $wordmarkSize.Width, $ulH)
  $g.DrawString($wordmark, $displayFont, $chalkBrush, $left, $wordmarkY, $format)
  $g.DrawString($tagline, $bodyFont, $slateBrush, $left, $underlineY + $ulH + $tagGap, $format)

  $pillY = $underlineY + $ulH + $tagGap + $taglineSize.Height + $ctaGap
  $pill = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $ctaRadius
  $pill.AddArc($left, $pillY, $d, $d, 180, 90)
  $pill.AddArc($left + $pillW - $d, $pillY, $d, $d, 270, 90)
  $pill.AddArc($left + $pillW - $d, $pillY + $pillH - $d, $d, $d, 0, 90)
  $pill.AddArc($left, $pillY + $pillH - $d, $d, $d, 90, 90)
  $pill.CloseFigure()
  $g.FillPath($measureBrush, $pill)
  $cellarBrush = New-Object System.Drawing.SolidBrush($cellar)
  $g.DrawString($cta, $ctaFont, $cellarBrush, $left + $ctaPadX, $pillY + $ctaPadY, $format)

  New-Item -ItemType Directory -Force (Split-Path -Parent $outPath) | Out-Null
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $g.Dispose()
  $bmp.Dispose()
}

Write-Host "Wrote $outPath"
