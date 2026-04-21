#!/usr/bin/env bash
# Build doc/RxStation UserGuide.docx from Markdown + SVG mockups.
#
# Requires:
#   pandoc        (apt: pandoc)
#   rsvg-convert  (apt: librsvg2-bin)
#
# Steps:
#   1. Render each SVG in images/ to a 1800px-wide PNG in images/png/.
#   2. Rewrite image links in the Markdown so pandoc picks up the PNGs.
#   3. Run pandoc md -> docx with TOC, keep output in doc/ (one level up).

set -euo pipefail
cd "$(dirname "$0")"

SRC_MD="RxStation-UserGuide.md"
TMP_MD="RxStation-UserGuide.pandoc.md"
OUT_DOCX="../RxStation UserGuide.docx"

mkdir -p images/png

shopt -s nullglob
svg_count=0
for svg in images/*.svg; do
    name=$(basename "$svg" .svg)
    rsvg-convert -w 1800 "$svg" -o "images/png/$name.png"
    svg_count=$((svg_count + 1))
done
shopt -u nullglob
echo "Rendered $svg_count SVG mockup(s) to PNG."

# Rewrite image paths for pandoc (images/foo.svg -> images/png/foo.png).
sed 's|images/\([^)[:space:]]*\)\.svg|images/png/\1.png|g' "$SRC_MD" > "$TMP_MD"

pandoc "$TMP_MD" \
    --from=gfm \
    --to=docx \
    --toc --toc-depth=2 \
    --output="$OUT_DOCX"

rm "$TMP_MD"
echo "Built: $OUT_DOCX"
