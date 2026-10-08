#!/usr/bin/env bash
# Prints the two engineering HTML files to PDF with headless Chrome (set CHROME to override).
set -euo pipefail
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
for f in engineering-approach-concise engineering-approach; do
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD/$f.pdf" "file://$PWD/$f.html" >/dev/null 2>&1
  echo "wrote $f.pdf"
done
