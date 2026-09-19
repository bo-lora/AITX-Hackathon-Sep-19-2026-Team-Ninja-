#!/usr/bin/env bash
# Pack the MV3 folder into a zip judges can unzip and Load unpacked.
# No compile step — the extension is already Chrome-ready JS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/packages/extension"
STAGE="$(mktemp -d)"
NAME="contextninja-extension"
DEST="$STAGE/$NAME"

mkdir -p "$DEST/icons"
cp "$SRC/manifest.json" "$SRC/background.js" "$SRC/content.js" \
  "$SRC/popup.html" "$SRC/popup.js" "$SRC/popup.css" "$SRC/INSTALL.txt" "$DEST/"
cp "$SRC/icons/icon16.png" "$SRC/icons/icon48.png" "$SRC/icons/icon128.png" "$DEST/icons/"

OUT_LANDING="$ROOT/packages/webapp/landing-page/public/contextninja-extension.zip"
OUT_SKILLS="$ROOT/packages/webapp/skill-manager/public/contextninja-extension.zip"
rm -f "$OUT_LANDING" "$OUT_SKILLS"
(cd "$STAGE" && zip -r -q "$OUT_LANDING" "$NAME")
cp "$OUT_LANDING" "$OUT_SKILLS"
rm -rf "$STAGE"

echo "packed $OUT_LANDING"
unzip -l "$OUT_LANDING"
